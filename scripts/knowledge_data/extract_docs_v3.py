"""校史/基础信息 文档全文提取（2026-09-26 用户要求"知识清单每一条都详细录入"）。

源：数据清单/一、学校基础信息 + 二、学校校史资料 下全部 .doc/.docx/.pptx
（跳过 ~$ 锁文件、~WRL 自动备份、.tmp）。Word COM 逐个打开取正文文本；
pptx 走 PowerPoint COM 取每页文本框。

产出 docs_text_v3/：镜像目录树，每个文档一个 .txt（含来源路径头）；
stdout 汇总每文件字符数，字符数≪预期者（纯图扫描件）标记 NEED_VISION。
只落地文本，不进 git（含师生姓名 PII）。
"""
import json
import sys
from pathlib import Path

import win32com.client

sys.stdout.reconfigure(encoding="utf-8")
SRC = Path(r"D:/SRP/AI_school/数据清单/数据清单")
OUT = Path(__file__).resolve().parent / "docs_text_v3"
ROOTS = [
    SRC / "一、学校基础信息【必需】",
    SRC / "二、学校校史资料【必需】",
]
SKIP_PREFIX = ("~$", "~WRL", "._", ".DS")
SKIP_SUFFIX = (".tmp",)


def com_text(path: Path, word, ppt) -> tuple[str, str]:
    """返回 (文本, 备注)。"""
    ext = path.suffix.lower()
    if ext == ".pptx":
        pres = ppt.Presentations.Open(str(path), ReadOnly=True, WithWindow=False)
        parts = []
        for slide in pres.Slides:
            lines = []
            for shape in slide.Shapes:
                if shape.HasTextFrame and shape.TextFrame.HasText:
                    lines.append(shape.TextFrame.TextRange.Text.strip())
            parts.append(f"--- 第{slide.SlideIndex}页 ---\n" + "\n".join(
                l for l in lines if l))
        pres.Close()
        return "\n\n".join(parts), ""
    doc = word.Documents.Open(str(path), ReadOnly=True)
    text = doc.Content.Text
    tables = []
    try:
        for i, tbl in enumerate(doc.Tables, 1):
            cells = []
            for r in range(1, tbl.Rows.Count + 1):
                row = []
                for c in range(1, tbl.Columns.Count + 1):
                    try:
                        row.append(tbl.Cell(r, c).Range.Text.replace("\r\x07", "").strip())
                    except Exception:
                        row.append("")
                cells.append(" | ".join(row))
            tables.append(f"--- 表格{i} ---\n" + "\n".join(cells))
    except Exception:
        pass
    doc.Close(False)
    text = text.replace("\r", "\n").replace("\x07", "\n")
    body = text.strip()
    if tables:
        body = (body + "\n\n" if body else "") + "\n\n".join(tables)
    return body, ""


def main():
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    try:
        ppt = win32com.client.Dispatch("PowerPoint.Application")
    except Exception:
        ppt = None

    jobs = []
    for root in ROOTS:
        for p in sorted(root.rglob("*")):
            if not p.is_file() or p.suffix.lower() not in (".doc", ".docx", ".pptx"):
                continue
            if p.name.startswith(SKIP_PREFIX) or p.name.endswith(SKIP_SUFFIX):
                continue
            jobs.append(p)

    index = []
    for p in jobs:
        rel = p.relative_to(SRC)
        dst = OUT / rel.with_suffix(".txt")
        dst.parent.mkdir(parents=True, exist_ok=True)
        note = ""
        try:
            text, note = com_text(p, word, ppt)
        except Exception as ex:
            note = f"EXTRACT_FAIL: {ex}"
            text = ""
        dst.write_text(
            f"【来源】{rel}\n【提取】Word/PPT COM 全文（2026-09-26）\n\n{text}",
            encoding="utf-8")
        index.append({"path": str(rel), "chars": len(text), "note": note})
        flag = " <<< NEED_VISION" if len(text) < 200 and p.stat().st_size > 500_000 else ""
        print(f"{len(text):>7}  {rel}{flag}")

    (OUT / "_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(x["chars"] for x in index)
    print(f"\n共 {len(index)} 个文档，合计 {total} 字符 → {OUT}")


if __name__ == "__main__":
    main()
