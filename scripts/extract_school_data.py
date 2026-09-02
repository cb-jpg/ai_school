"""数据清单提取脚本：把学校提供的数据清单转为结构化 JSON，供服务器灌库。

输出: scripts/knowledge_data/extracted.json
  [{title, category, tags, summary, content, source_dir}, ...]
- docx: zipfile 提取 word/document.xml 纯文本
- .doc(老格式): 跳过并记录（OLE 二进制，含大量内嵌图，需单独处理）
- pdf: pypdf 按页提取
- xls: xlrd 全单元格文本
- 荣誉照片: 文件名即荣誉名，生成条目（去除序号前缀/扩展名/Thumbs.db）
"""

import json
import re
import sys
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

DATA_ROOT = Path(r"D:/SRP/AI_school/数据清单/数据清单")
OUT = Path(r"D:/SRP/AI_school/Open-LLM-VTuber/scripts/knowledge_data/extracted.json")

# 目录 → (category, tags)
DIR_CATEGORY = [
    ("五、学校知识库资料", "school_intro", ["知识库", "核心"]),
    ("一、学校基础信息", "school_intro", ["基础信息"]),
    ("二、学校校史资料", "history", ["校史"]),
    ("三、学校荣誉及办学成果资料", "honors", ["荣誉", "办学成果"]),
    ("四、学习标兵", "students", ["学习标兵", "优秀学生"]),
    ("八、资料有效性", "rules", ["作息时间", "规章制度"]),
]


def classify(rel_dir: str):
    for prefix, cat, tags in DIR_CATEGORY:
        if rel_dir.startswith(prefix):
            return cat, tags
    return "other", []


def docx_text(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8", "ignore")
    except Exception as e:
        return f"[提取失败: {e}]"
    xml = re.sub(r"</w:p>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\n{3,}", "\n\n", text).strip()


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
    return pages


def xls_text(path: Path) -> str:
    """xls 用 xlrd，xlsx 用 openpyxl"""
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


def clean_title(stem: str) -> str:
    t = re.sub(r"^\d+[、.．]\s*", "", stem)  # 去序号前缀
    t = re.sub(r"[（(]\d+[)）]", "", t)       # 去尾括号副本号
    return t.strip()


def main():
    entries = []
    skipped = []
    photo_groups = {}  # 父目录路径 -> {"names": [(清理后文件名, rel)], "dir": rel_dir}
    for path in sorted(DATA_ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(DATA_ROOT)
        rel_dir = str(rel.parent)
        if rel_dir == ".":  # 根目录散件（目录 pdf、画册 rar、散图）单独处理
            continue
        if "Thumbs.db" in path.name or path.name.startswith("~$"):
            continue
        cat, tags = classify(rel_dir)

        if path.suffix.lower() == ".docx":
            text = docx_text(path)
            if len(text) < 20:
                skipped.append((str(rel), "docx 空文本"))
                continue
            entries.append({
                "title": clean_title(path.stem),
                "category": cat,
                "tags": tags + ["官方资料"],
                "summary": text[:80].replace("\n", " "),
                "content": text,
                "source_dir": rel_dir,
            })
        elif path.suffix.lower() == ".doc":
            skipped.append((str(rel), "老 .doc 格式，需单独转换"))
        elif path.suffix.lower() == ".pdf":
            pages = pdf_text(path)
            total = sum(len(t) for _, t in pages)
            if total < 50:
                skipped.append((str(rel), f"pdf 文本过少({total}字)，可能为纯图版"))
                continue
            entries.append({
                "title": clean_title(path.stem),
                "category": cat,
                "tags": tags + ["画册", "PDF"],
                "summary": f"共 {len(pages)} 页含文本，{total} 字",
                "content": "\n\n".join(f"[第{p}页]\n{t}" for p, t in pages),
                "source_dir": rel_dir,
            })
        elif path.suffix.lower() in (".xls", ".xlsx"):
            try:
                text = xls_text(path)
            except Exception as e:
                skipped.append((str(rel), f"xls 解析失败 {e}"))
                continue
            if len(text) < 20:
                skipped.append((str(rel), "xls 空文本"))
                continue
            entries.append({
                "title": clean_title(path.stem),
                "category": cat,
                "tags": tags + ["表格"],
                "summary": text[:80].replace("\n", " "),
                "content": text,
                "source_dir": rel_dir,
            })
        elif path.suffix.lower() in (".png", ".jpg", ".jpeg"):
            name = re.sub(r"^\d+-?\s*", "", clean_title(path.stem))  # 去序号
            group_key = str(rel.parent)
            photo_groups.setdefault(group_key, {"dir": rel_dir, "names": []})
            photo_groups[group_key]["names"].append((name, str(rel)))
        # .txt 空文件、.rar、.mp4 跳过

    # ---- 照片条目生成：荣誉证书类逐条，其他按目录合并 ----
    HONOR_DIRS = ("1.国家级荣誉", "2.省级荣誉", "3.市级荣誉", "4.区级荣誉",
                  "5.镇级荣誉", "6.荣誉获得时间（全校）")
    MEANINGLESS = re.compile(r"^(IMG|DSC|image|photo|微信|WeChat|photo[_-]?\d+|[\d\s_-]+)$",
                             re.IGNORECASE)
    for group_key, g in photo_groups.items():
        parent = Path(group_key).name
        meaningful = [(n, r) for n, r in g["names"] if n and not MEANINGLESS.match(n)]
        if parent in HONOR_DIRS:
            # 荣誉证书：文件名即荣誉名，逐条入库（高价值）
            for n, r in meaningful:
                entries.append({
                    "title": f"荣誉：{n}",
                    "category": "honors",
                    "tags": ["荣誉", "证书"],
                    "summary": f"{parent}：{n}",
                    "content": f"佛山市南海区石实实验学校荣获「{n}」（{parent}）。"
                               f"该荣誉证书/牌匾照片由学校提供存档。",
                    "source_dir": g["dir"],
                })
        elif meaningful:
            # 有语义文件名的照片组：合并为一条
            names = "、".join(n for n, _ in meaningful[:20])
            entries.append({
                "title": f"图片资料：{parent}",
                "category": "history",
                "tags": ["照片", "存档"],
                "summary": f"{parent}（{len(g['names'])} 张）：{names[:60]}",
                "content": f"学校提供的「{parent}」图片资料共 {len(g['names'])} 张，"
                           f"包括：{names}。",
                "source_dir": g["dir"],
            })
        else:
            # 全部为相机命名：按目录名生成一条存档说明
            dir_semantic = g["dir"].replace(os.sep, " / ")
            entries.append({
                "title": f"图片存档：{parent}",
                "category": "history",
                "tags": ["照片", "存档"],
                "summary": f"{dir_semantic}（{len(g['names'])} 张照片存档）",
                "content": f"学校提供的图片资料「{dir_semantic}」共 {len(g['names'])} 张"
                           f"（文件名为相机编号，具体内容需人工整理或 OCR 后补充）。",
                "source_dir": g["dir"],
            })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"entries: {len(entries)}  ->  {OUT}")
    print(f"skipped: {len(skipped)}")
    for f, why in skipped:
        print(f"  - {f}: {why}")


SCHOOL_HEADER = "佛山市南海区石实实验学校荣获"
main()
