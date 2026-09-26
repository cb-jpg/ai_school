"""从两个荣誉台账 xls 生成 v3 详细条目（2026-09-26 用户要求"知识清单每一条都详细录入"）。

源：
1. 学校综合荣誉统计（11.7）(定稿)(3)(2).xls —— 校级综合荣誉 113 项（2002-2024，
   含时间+颁发单位），按 国/省/市/区 四级全录。
2. .../6.荣誉获得时间（全校）/2022-2023下/2022-2023学年奖状登记(地理).xls
   （文件名带"地理"，实为全校台账）—— 教师 448 行 + 学生 581 行获奖记录。

产出 v3_new_entries.json：
- 综合荣誉 5 条（总览+四级全表）
- 教师获奖 203 条（按 科目×竞赛 分组，全字段）
- 学生获奖 146 条（按 竞赛×作品 分组，全字段）
- 师生获奖总览 2 条
注意：*.json 已 gitignore（PII：师生姓名），只灌服务器不进 git。
"""
import json
import sys
from collections import Counter, OrderedDict
from pathlib import Path

import xlrd

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).resolve().parent
SRC = Path("D:/SRP/AI_school/数据清单/数据清单")

XLS_SUM = SRC / "学校综合荣誉统计（11.7）(定稿)(3)(2).xls"
XLS_REG = (SRC / "三、学校荣誉及办学成果资料【必需】/1、学校荣誉/6.荣誉获得时间（全校）"
                "/2022-2023下/2022-2023学年奖状登记(地理).xls")

LEVEL_ORDER = ["国家级", "省级", "市级", "镇级", "区级", "校级"]


def cell(sh, r, c):
    if c >= sh.ncols:
        return ""
    v = sh.cell_value(r, c)
    if isinstance(v, float) and v == int(v):
        v = int(v)
    return str(v).strip()


def fmt_level(levels):
    return "、".join(l for l in LEVEL_ORDER if l in levels) or "其他"


# ---------- 1. 学校综合荣誉统计 ----------
def extract_summary(out):
    wb = xlrd.open_workbook(str(XLS_SUM))
    per_level = {}   # level -> [ (name, time, issuer) ]
    total = []
    for sn in ["国家级荣誉12项", "省级荣誉21项", "市级荣誉18项", "区级荣誉62项"]:
        sh = wb.sheet_by_name(sn)
        level = sn.split("荣誉")[0] + "荣誉"  # 国家级荣誉/省级荣誉/…
        rows = []
        for r in range(sh.nrows):
            name = cell(sh, r, 1)
            if not name or name == "学校综合荣誉":
                continue
            rows.append((name, cell(sh, r, 2), cell(sh, r, 3)))
        per_level[level] = rows
        total.extend((level, *x) for x in rows)

    counts = Counter(l for l, *_ in total)
    ov = ["石实实验学校建校以来获校级以上综合荣誉共 %d 项（截至2024年11月，学校综合荣誉统计表）。" % len(total),
          "级别分布：" + "；".join(f"{k}{v}项" for k, v in counts.items()) + "。",
          "时间跨度 2002年至2024年，最早一项为2002年8月教育部基础教育司颁发的"
          "「第三届全国中小学电脑制作活动最佳组织奖」。",
          "各级别完整清单见条目：学校综合荣誉·国家级全录 / 省级全录 / 市级全录 / 区级全录。"]
    out.append({
        "title": "学校综合荣誉总览（113项，2002-2024）",
        "category": "honors",
        "tags": ["学校荣誉", "综合荣誉统计", "荣誉清单"],
        "summary": f"建校以来校级以上综合荣誉共{len(total)}项的级别分布与时间跨度。",
        "content": "\n".join(ov),
        "source_dir": "学校综合荣誉统计（11.7）定稿.xls",
    })

    for level, rows in per_level.items():
        lines = [f"石实实验学校「{level}」共 {len(rows)} 项，逐项如下（荣誉名称｜获得时间｜颁发单位）：", ""]
        for i, (name, t, issuer) in enumerate(rows, 1):
            lines.append(f"{i}. {name.replace(chr(10), '')}｜{t}｜{issuer}")
        lines += ["", "来源：学校综合荣誉统计表（2024年11月定稿）。"]
        key = level.replace("荣誉", "")
        out.append({
            "title": f"学校综合荣誉·{key}全录（{len(rows)}项）",
            "category": "honors",
            "tags": ["学校荣誉", key, "综合荣誉统计"],
            "summary": f"{level}共{len(rows)}项的完整清单（名称/时间/颁发单位）。",
            "content": "\n".join(lines),
            "source_dir": "学校综合荣誉统计（11.7）定稿.xls",
        })
    return len(total)


# ---------- 2. 2022-2023 师生获奖台账 ----------
def extract_registry(out):
    wb = xlrd.open_workbook(str(XLS_REG))
    yr = "2022-2023学年"

    # 教师：按 (科目, 竞赛) 分组
    sh = wb.sheet_by_name("教师")
    t_groups = OrderedDict()
    subj_counter = Counter(); lv_counter = Counter()
    for r in range(1, sh.nrows):
        subj = cell(sh, r, 0)
        comp = cell(sh, r, 1)
        if not comp or comp == "竞赛准确全称":
            continue
        row = {
            "组别": cell(sh, r, 2), "奖项/称号": cell(sh, r, 4),
            "获奖教师": cell(sh, r, 5), "时间": cell(sh, r, 6), "授予单位": cell(sh, r, 7),
        }
        t_groups.setdefault((subj, comp), []).append(row)
        subj_counter[subj] += 1
        lv_counter[row["组别"]] += 1

    for (subj, comp), rows in t_groups.items():
        lv = fmt_level({x["组别"] for x in rows})
        lines = [f"石实实验学校{yr}教师获奖：「{comp}」（科目：{subj}；级别：{lv}），"
                 f"共 {len(rows)} 人次：", ""]
        for x in rows:
            line = f"- {x['奖项/称号'] or comp}｜{x['获奖教师']}｜{x['时间']}"
            if x["授予单位"]:
                line += f"｜授予单位：{x['授予单位']}"
            if x["组别"]:
                line += f"｜{x['组别']}"
            lines.append(line)
        lines += ["", f"来源：{yr}教师获奖登记表（全校）。"]
        out.append({
            "title": f"教师获奖·{subj}·{comp[:60]}（{yr}）",
            "category": "honors",
            "tags": ["师生获奖", yr, "教师获奖", subj, lv.split("、")[0]],
            "summary": f"{yr}{subj}学科教师获「{comp[:40]}」的完整获奖名单。",
            "content": "\n".join(lines),
            "source_dir": "2022-2023学年奖状登记(地理).xls/教师",
        })

    ov = [f"石实实验学校{yr}教师获奖共 {sum(subj_counter.values())} 人次，覆盖 {len(subj_counter)} 个学科组：", ""]
    for subj, n in subj_counter.most_common():
        ov.append(f"- {subj}：{n} 人次")
    ov += ["", "级别分布：" + "；".join(f"{k}{v}人次" for k, v in lv_counter.items() if k) + "。",
           f"每项竞赛的完整名单见「教师获奖·科目·竞赛名（{yr}）」系列条目。"]
    out.append({
        "title": f"教师获奖总览（{yr}，{sum(subj_counter.values())}人次）",
        "category": "honors",
        "tags": ["师生获奖", yr, "教师获奖", "总览"],
        "summary": f"{yr}教师获奖人次按学科与级别分布的总览。",
        "content": "\n".join(ov),
        "source_dir": "2022-2023学年奖状登记(地理).xls/教师",
    })

    # 学生：按 (竞赛, 作品) 分组
    sh = wb.sheet_by_name("学生")
    s_groups = OrderedDict()
    s_comp = Counter(); s_lv = Counter()
    for r in range(1, sh.nrows):
        comp = cell(sh, r, 1)
        work = cell(sh, r, 3)
        if not comp or comp == "竞赛准确全称":
            continue
        row = {
            "科目": cell(sh, r, 0), "组别": cell(sh, r, 2), "作品": work,
            "奖项": cell(sh, r, 4), "指导教师": cell(sh, r, 5),
            "获奖学生": cell(sh, r, 7), "时间": cell(sh, r, 8), "授予单位": cell(sh, r, 9),
        }
        key = (comp, work) if work else (comp, f"◇{cell(sh, r, 4)}")
        s_groups.setdefault(key, []).append(row)
        s_comp[comp] += 1
        s_lv[row["组别"]] += 1

    for (comp, work), rows in s_groups.items():
        lv = fmt_level({x["组别"] for x in rows})
        lines = [f"石实实验学校{yr}学生获奖：「{comp}」（级别：{lv}）", ""]
        if not work:
            # 无作品名的奖项（个人奖类）：按奖项归并成学生名单
            by_award = OrderedDict()
            for x in rows:
                by_award.setdefault(x["奖项"] or "获奖", []).append(x)
            for award, xs in by_award.items():
                names = "、".join(x["获奖学生"] for x in xs if x["获奖学生"])
                meta = xs[0]
                lines.append(f"- {award}（{len(xs)}人）：{names}")
                extra = []
                if meta["指导教师"]:
                    extra.append(f"指导教师：{meta['指导教师']}")
                if meta["时间"]:
                    extra.append(f"时间：{meta['时间']}")
                if meta["授予单位"]:
                    extra.append(f"授予单位：{meta['授予单位']}")
                if extra:
                    lines.append("  " + "｜".join(extra))
        seen = set()
        for x in rows:
            sig = (x["作品"], x["奖项"], x["获奖学生"])
            if sig in seen:
                continue
            seen.add(sig)
            lines.append(f"- 作品：{x['作品'] or '（集体/个人）'}｜奖项：{x['奖项']}")
            if x["获奖学生"]:
                lines.append(f"  获奖学生：{x['获奖学生']}")
            if x["指导教师"]:
                lines.append(f"  指导教师：{x['指导教师']}")
            when = x["时间"] or (rows[0]["时间"] if rows else "")
            if when:
                lines.append(f"  时间：{when}")
            if x["授予单位"]:
                lines.append(f"  授予单位：{x['授予单位']}")
        lines += ["", f"来源：{yr}学生获奖登记表（全校）。"]
        sub = work if work else f"获奖名单（{rows[0]['奖项'] or '按奖项分列'}）"
        out.append({
            "title": f"学生获奖·{comp[:50]}·{sub[:40]}（{yr}）",
            "category": "honors",
            "tags": ["师生获奖", yr, "学生获奖", lv.split("、")[0]],
            "summary": f"{yr}学生在「{comp[:40]}」中获奖作品与学生的完整名单。",
            "content": "\n".join(lines),
            "source_dir": "2022-2023学年奖状登记(地理).xls/学生",
        })

    ov2 = [f"石实实验学校{yr}学生获奖共 {sum(s_comp.values())} 人次，主要竞赛及获奖人次：", ""]
    for comp, n in s_comp.most_common(20):
        ov2.append(f"- {comp}：{n} 人次")
    ov2 += ["", "级别分布：" + "；".join(f"{k}{v}人次" for k, v in s_lv.items() if k) + "。",
            f"每项作品的完整名单见「学生获奖·竞赛名·作品名（{yr}）」系列条目。"]
    out.append({
        "title": f"学生获奖总览（{yr}，{sum(s_comp.values())}人次）",
        "category": "honors",
        "tags": ["师生获奖", yr, "学生获奖", "总览"],
        "summary": f"{yr}学生获奖人次按竞赛与级别分布的总览。",
        "content": "\n".join(ov2),
        "source_dir": "2022-2023学年奖状登记(地理).xls/学生",
    })
    return len(t_groups), len(s_groups)


def main():
    out = []
    n_total = extract_summary(out)
    n_t, n_s = extract_registry(out)
    dst = HERE / "v3_new_entries.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"综合荣誉 {n_total} 项 → 5 条；教师竞赛组 {n_t} 条；学生作品组 {n_s} 条")
    print(f"共 {len(out)} 条 → {dst.name}")
    lens = sorted(len(e["content"]) for e in out)
    print(f"content 长度 min/med/max = {lens[0]}/{lens[len(lens)//2]}/{lens[-1]}")


if __name__ == "__main__":
    main()
