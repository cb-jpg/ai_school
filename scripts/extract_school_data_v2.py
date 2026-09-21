"""数据清单提取 v2：补全 09-02 首轮导入的缺口，并纳入 09-20 新增「小石同学」数据。

v1（extract_school_data.py）的缺口，本版补齐：
- 老 .doc 全部跳过          → 本版走 Word COM 提取（本机 Office 16）
- 扫版 PDF（纯图）跳过      → 本版 fitz 渲染 220dpi + RapidOCR（单文件 >60 页跳过并记录）
- 数据清单/小石同学（09-20 新增：优秀学生推荐材料/四级荣誉/校史资料）从未入库

输出: scripts/knowledge_data/extracted_v2.json
合并: 与 merged.json 按标题去重（旧优先）→ merged_v2.json → seed_via_api.py 灌库

隐私：students 类条目对手机号/身份证号脱敏后再入库（对话系统面向公众）。
"""

import faulthandler  # 原生层（fitz/onnxruntime/Word COM）崩溃时打印 Python 栈，定位崩溃文件
import hashlib
import gc
import json
import re
import sys
from pathlib import Path

faulthandler.enable()
sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
ROOT_NEW = Path(r"D:/SRP/AI_school/数据清单/小石同学/数据需求")
ROOT_OLD = Path(r"D:/SRP/AI_school/数据清单/数据清单")
OUT_V2 = HERE / "extracted_v2.json"
OUT_MERGED = HERE / "merged_v2.json"
MERGED_OLD = HERE / "knowledge_data" / "merged.json"

OCR_PAGE_CAP = 60          # 单文件 OCR 页数上限（182 页绿色校园培训类直接跳过）
OCR_DPI = 220
MIN_TEXT = 20              # 文本类最低字数（低于则尝试 OCR/记录 skip）

# ---------- 单文件提取缓存（崩溃续跑：OCR/Word 提取一次后落盘，重跑直接命中） ----------

CACHE_DIR = HERE / "knowledge_data" / "extract_cache_v2"


def _cache_path(path: Path, kind: str) -> Path:
    st = path.stat()
    key = f"{kind}:{path}|{st.st_size}|{st.st_mtime_ns}"
    return CACHE_DIR / (hashlib.sha1(key.encode("utf-8")).hexdigest()[:16] + ".json")


def cache_get(path: Path, kind: str):
    try:
        return json.loads(_cache_path(path, kind).read_text(encoding="utf-8"))
    except Exception:
        return None


def cache_put(path: Path, kind: str, payload) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        p = _cache_path(path, kind)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(p)
    except Exception as e:  # 缓存失败不阻断主流程
        print(f"    缓存写入失败 {path.name}: {e}", flush=True)

# ---------- 文本提取 ----------

def docx_text(path: Path) -> str:
    try:
        import zipfile
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8", "ignore")
    except Exception as e:
        return f"[提取失败: {e}]"
    xml = re.sub(r"</w:p>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\n{3,}", "\n\n", text).strip()


class WordBatch:
    """复用单个 Word 进程批量提取 .doc/.docx 文本（含老 OLE 格式）。"""

    def __init__(self):
        self._app = None

    def _ensure(self):
        if self._app is None:
            import win32com.client
            app = win32com.client.DispatchEx("Word.Application")
            app.Visible = False
            app.DisplayAlerts = 0
            self._app = app
        return self._app

    def text(self, path: Path) -> str:
        hit = cache_get(path, "word")
        if isinstance(hit, str):
            return hit
        app = self._ensure()
        doc = app.Documents.Open(str(path.resolve()), ReadOnly=True,
                                 ConfirmConversions=False, AddToRecentFiles=False)
        try:
            t = doc.Content.Text or ""
        finally:
            doc.Close(False)
        t = t.replace("\r\x07", "\n").replace("\r", "\n").replace("\x07", "\n")
        t = t.replace("\x0b", "\n").replace("\x1a", "")
        t = re.sub(r"\n{3,}", "\n\n", t).strip()
        cache_put(path, "word", t)
        return t

    def quit(self):
        if self._app is not None:
            self._app.Quit()
            self._app = None


def pdf_text(path: Path):
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    pages = []
    for i, page in enumerate(reader.pages):
        try:
            t = (page.extract_text() or "").strip()
        except Exception:
            t = ""
        if t:
            pages.append((i + 1, t))
    return pages, len(reader.pages)


_ocr = None

def ocr_pdf(path: Path):
    """扫版 PDF：fitz 渲染 + RapidOCR。返回 ([(页码, 文本)], 总页数, 是否被跳过)。"""
    global _ocr
    import fitz
    import numpy as np
    doc = fitz.open(str(path))
    total = doc.page_count
    if total > OCR_PAGE_CAP:
        doc.close()
        return [], total, True
    hit = cache_get(path, "ocr")
    if isinstance(hit, dict) and hit.get("total") == total:
        doc.close()
        return [(p, t) for p, t in hit["pages"]], total, False
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    pages = []
    for i in range(total):
        pix = doc[i].get_pixmap(dpi=OCR_DPI)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            img = img[:, :, :3]
        elif pix.n == 1:
            img = np.repeat(img, 3, axis=2)
        result, _ = _ocr(np.ascontiguousarray(img[:, :, ::-1]))  # RGB→BGR
        pages.append((i + 1, _lines_from_ocr(result or [])))
        del pix, img, result
        if (i + 1) % 10 == 0:
            print(f"    OCR 进度 {path.name}: {i+1}/{total}", flush=True)
    doc.close()
    gc.collect()
    pages = [(p, t) for p, t in pages if t.strip()]
    cache_put(path, "ocr", {"total": total, "pages": pages})
    return pages, total, False


def _lines_from_ocr(result) -> str:
    """把 OCR 框按行聚合（y 聚类 + 行内 x 排序），接近原始阅读顺序。"""
    items = []
    for box, text, _score in result:
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        items.append((min(ys), min(xs), max(xs), text))
    items.sort(key=lambda it: it[0])
    lines: list[list[tuple]] = []
    for it in items:
        if lines and it[0] - lines[-1][0][0] <= 14:  # 与当前行首框顶部差 ≤14px 视为同行
            lines[-1].append(it)
        else:
            lines.append([it])
    out = []
    for line in lines:
        line.sort(key=lambda it: it[1])
        out.append("".join(t for _, _, _, t in line))
    return "\n".join(out)


def xls_text(path: Path) -> str:
    out = []
    if path.suffix.lower() == ".xlsx":
        import openpyxl
        wb = openpyxl.load_workbook(str(path), data_only=True, read_only=True)
        for sh in wb.worksheets:
            out.append(f"## 工作表: {sh.title}")
            for row in sh.iter_rows(values_only=True):
                cells = [str(v).strip() for v in row if v not in ("", None)]
                if cells:
                    out.append(" | ".join(cells))
        wb.close()
    else:
        import xlrd
        wb = xlrd.open_workbook(str(path))
        for sh in wb.sheets():
            out.append(f"## 工作表: {sh.name}")
            for r in range(sh.nrows):
                row = []
                for c in range(sh.ncols):
                    v = sh.cell_value(r, c)
                    if v not in ("", None):
                        row.append(str(v).strip())
                if row:
                    out.append(" | ".join(row))
    return "\n".join(out)


def pptx_text(path: Path) -> str:
    from pptx import Presentation
    prs = Presentation(str(path))
    out = []
    for i, slide in enumerate(prs.slides, 1):
        parts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                t = shape.text_frame.text.strip()
                if t:
                    parts.append(t)
        if parts:
            out.append(f"[第{i}页] " + " / ".join(parts))
    return "\n".join(out)


# ---------- 清洗 / 脱敏 ----------

ZW_RE = re.compile("[​‌‍⁠﻿]")

ID_RE = re.compile(r"(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)")
ID15_RE = re.compile(r"(?<!\d)\d{15}(?!\d)")
MOBILE_RE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")


def redact(text: str, students: bool) -> str:
    text = ID_RE.sub("〔身份证号已隐去〕", text)
    if students:
        text = MOBILE_RE.sub("〔手机号已隐去〕", text)
    return text


def base_clean(text: str) -> str:
    return ZW_RE.sub("", text)


def clean_title(stem: str) -> str:
    t = re.sub(r"^\d+[、.．]\s*", "", stem)
    t = re.sub(r"[（(]\d+[)）]", "", t)
    t = re.sub(r"[-_ ]?副本$", "", t)
    return t.strip()


# ---------- 分类 ----------

# 新文件夹（小石同学/数据需求）
NEW_MAP = [
    ("1.优秀学生照片、过往经历、简介、视频等信息/南海区优秀学生干部", "students", ["优秀学生干部", "南海区"]),
    ("1.优秀学生照片、过往经历、简介、视频等信息/南海区优秀学生", "students", ["优秀学生", "南海区"]),
    ("1.优秀学生照片、过往经历、简介、视频等信息", "students", ["优秀学生"]),
    ("2.学校荣誉（升学率、竞赛奖项等）", "honors", ["荣誉", "办学成果"]),
    ("3. 学校简介、校史、学校成就是否有校方的视频介绍", "history", ["校史", "校方资料"]),
]

# 旧文件夹中 v1 跳过的类型按原分类补录
OLD_MAP = [
    ("四、学习标兵", "students", ["学习标兵", "优秀学生"]),
    ("二、学校校史资料", "history", ["校史"]),
    ("三、学校荣誉及办学成果资料", "honors", ["荣誉", "办学成果"]),
    ("一、学校基础信息", "school_intro", ["基础信息"]),
    ("五、学校知识库资料", "school_intro", ["知识库", "核心"]),
    ("八、资料有效性", "rules", ["作息时间", "规章制度"]),
]


def classify(rel_dir: str, mapping):
    for prefix, cat, tags in mapping:
        if rel_dir.startswith(prefix):
            return cat, tags
    return "other", []


# ---------- 条目生成 ----------

def make_entry(title, cat, tags, content, source_dir, summary=None, students=False):
    content = base_clean(redact(content, students))
    if len(content) < MIN_TEXT:
        return None
    return {
        "title": title[:120],
        "category": cat,
        "tags": tags,
        "summary": (summary or content[:80].replace("\n", " ")),
        "content": content,
        "source_dir": source_dir,
    }


def student_pdf_title(rel: Path, root: Path):
    """60010+10+张卓尔+优秀学生推荐材料.pdf → (南海区优秀学生（2027届）：张卓尔, 是否干部)"""
    ganbu = "优秀学生干部" in str(rel)
    cohort = next((p.name for p in rel.parents if re.fullmatch(r"\d{4}届", p.name)), "")
    kind = "南海区优秀学生干部" if ganbu else "南海区优秀学生"
    m = re.match(r"\d+\+(.+?)\+(.+)\+优秀学生(干部)?推荐材料", rel.stem)
    if m:
        name = m.group(2)
    else:
        name = clean_title(rel.stem)
    title = f"{kind}（{cohort}）：{name}" if cohort else f"{kind}：{name}"
    return title, ganbu


def main():
    entries: list[dict] = []
    skipped: list[tuple[str, str]] = []
    seen_titles: set[str] = set()
    word = WordBatch()

    def add(e):
        if e is None:
            return False
        if e["title"] in seen_titles:
            skipped.append((e["title"], "标题重复，保留先入库者"))
            return False
        seen_titles.add(e["title"])
        entries.append(e)
        return True

    def handle_doclike(path: Path, rel_dir: str, cat: str, tags, students=False, title=None):
        try:
            text = word.text(path)
        except Exception as e:
            skipped.append((str(path), f"Word COM 失败 {e}"))
            return
        title = title or clean_title(path.stem)
        add(make_entry(title, cat, tags + ["官方资料"], text, rel_dir,
                       students=students))

    def handle_pdf(path: Path, rel_dir: str, cat: str, tags, title=None, students=False):
        try:
            pages, total = pdf_text(path)
        except Exception as e:
            skipped.append((str(path), f"pdf 读取失败 {e}"))
            return
        text_total = sum(len(t) for _, t in pages)
        if text_total < 50:  # 扫版 → OCR
            ocr_pages, ocr_total, too_many = ocr_pdf(path)
            if too_many:
                skipped.append((str(path), f"扫版 PDF {ocr_total} 页超过 OCR 上限 {OCR_PAGE_CAP}，跳过"))
                return
            pages = ocr_pages
            got = sum(len(t) for _, t in pages)
            print(f"  OCR {path.name}: {ocr_total} 页提取 {got} 字", flush=True)
            if got < 50:
                skipped.append((str(path), f"OCR 后仍近乎无文本({got}字)"))
                return
        content = "\n\n".join(f"[第{p}页]\n{t}" for p, t in pages)
        title = title or clean_title(path.stem)
        tag_extra = ["画册", "PDF"] if path.suffix.lower() == ".pdf" else []
        add(make_entry(title, cat, tags + tag_extra, content, rel_dir, students=students))

    # ============ 新文件夹 ============
    print("== 新文件夹：小石同学/数据需求 ==", flush=True)
    for path in sorted(ROOT_NEW.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT_NEW)
        rel_dir = str(rel.parent)
        name = path.name
        if name.startswith("~$") or name == "Thumbs.db" or name == "数据需求.docx":
            continue
        cat, tags = classify(rel_dir, NEW_MAP)
        suffix = path.suffix.lower()
        students = cat == "students"
        print(f"· {rel}", flush=True)  # 崩溃定位：日志最后一行即肇事文件

        if suffix == ".docx":
            if "二维码" in name:
                skipped.append((str(rel), "二维码文档，无知识价值"))
                continue
            try:
                text = docx_text(path)
            except Exception as e:
                skipped.append((str(rel), f"docx 失败 {e}"))
                continue
            if len(text) < MIN_TEXT:
                try:
                    text = word.text(path)
                except Exception:
                    pass
            add(make_entry(clean_title(path.stem), cat, tags + ["官方资料"], text, rel_dir,
                           students=students))
        elif suffix == ".doc":
            stu_title = None
            if students:
                stu_title, _g = student_pdf_title(rel, ROOT_NEW)
                stu_title += "（个人简介）"
            handle_doclike(path, rel_dir, cat, tags, students, title=stu_title)
        elif suffix == ".pdf":
            title, _ = student_pdf_title(rel, ROOT_NEW) if students else (None, False)
            handle_pdf(path, rel_dir, cat, tags, title=title, students=students)
        elif suffix in (".xls", ".xlsx"):
            try:
                text = xls_text(path)
            except Exception as e:
                skipped.append((str(rel), f"xls 失败 {e}"))
                continue
            add(make_entry(clean_title(path.stem), cat, tags + ["表格", "获奖登记"], text, rel_dir))
        elif suffix == ".pptx":
            try:
                text = pptx_text(path)
            except Exception as e:
                skipped.append((str(rel), f"pptx 失败 {e}"))
                continue
            t = "优秀学生展示：徐博通" if "徐博通" in name else clean_title(path.stem)
            add(make_entry(t, cat, tags + ["演示文稿"], text, rel_dir, students=students))
        elif suffix in (".png", ".jpg", ".jpeg"):
            pass  # 校园图片（文件夹4）末尾合并为一条；百佳之星单独逐条；无其他照片目录

    # 校园图片（文件夹4，09-20 重发）：语义命名的合并为一条设施/活动存档条目（照片本身供前端用）
    campus_root = next((d for d in ROOT_NEW.iterdir() if d.name.startswith("4.")), None)
    if campus_root:
        CAM_RE = re.compile(r"^[A-Za-z0-9_\-()（）\s]+$")
        named = []
        for img in sorted(campus_root.rglob("*.jp*g")):
            n = clean_title(img.stem)
            if n and not CAM_RE.match(n):
                named.append(n)
        if named:
            names = "、".join(named)
            add(make_entry(
                "校园实景与活动图片存档（2026 重发）",
                "history", ["照片", "校园风光", "存档"],
                f"学校提供的校园实景与活动照片共 {len(named)} 张（语义命名），包括：{names}。"
                f"照片文件供数字人界面背景与官网展示使用。",
                campus_root.name))

    # 百佳之星：语义文件名逐条（奖项+班级+姓名）
    hundred_root = ROOT_NEW / "1.优秀学生照片、过往经历、简介、视频等信息/校级百佳之星"
    if hundred_root.exists():
        n_hundred = 0
        for cohort_dir in sorted(hundred_root.iterdir()):
            if not cohort_dir.is_dir():
                continue
            for star_dir in sorted(cohort_dir.iterdir()):
                if not star_dir.is_dir():
                    continue
                for img in sorted(star_dir.glob("*.jp*g")):
                    star = star_dir.name
                    person = clean_title(img.stem)
                    title = f"百佳之星·{star}（{cohort_dir.name}）：{person}"
                    content = (f"佛山市南海区石实实验学校{cohort_dir.name}校级「百佳之星」评选中，"
                               f"{person} 同学荣获「{star}」称号，学校存档其展示照片。")
                    if add(make_entry(title, "students", ["百佳之星", "校级荣誉"], content,
                                      f"校级百佳之星/{cohort_dir.name}/{star}")):
                        n_hundred += 1
        print(f"百佳之星条目: {n_hundred}", flush=True)

    # ============ 旧文件夹：仅补 v1 跳过的 .doc / .pdf ============
    print("== 旧文件夹：补 .doc 与扫版 PDF ==", flush=True)
    for path in sorted(ROOT_OLD.rglob("*")):
        if not path.is_file() or path.name.startswith("~$"):
            continue
        rel = path.relative_to(ROOT_OLD)
        rel_dir = str(rel.parent)
        suffix = path.suffix.lower()
        if suffix not in (".doc", ".pdf"):
            continue
        if "数据清单目录" in path.name:  # 目录索引文件，非知识
            skipped.append((str(rel), "目录索引文件"))
            continue
        cat, tags = classify(rel_dir, OLD_MAP)
        print(f"· 旧/{rel}", flush=True)  # 崩溃定位
        if suffix == ".doc":
            handle_doclike(path, rel_dir, cat, tags)
        else:
            handle_pdf(path, rel_dir, cat, tags)

    word.quit()

    OUT_V2.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nextracted_v2 条目: {len(entries)}  ->  {OUT_V2}")
    print(f"skipped: {len(skipped)}")
    for f, why in skipped:
        print(f"  - {f}: {why}")

    # ============ 与 merged.json 合并（旧优先，按标题去重） ============
    old_entries = json.loads(MERGED_OLD.read_text(encoding="utf-8"))
    old_titles = {e["title"] for e in old_entries}
    appended = [e for e in entries if e["title"] not in old_titles]
    merged = old_entries + appended
    OUT_MERGED.write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nmerged_v2: 原有 {len(old_entries)} + 新增 {len(appended)} = {len(merged)} 条 -> {OUT_MERGED}")


if __name__ == "__main__":
    main()
