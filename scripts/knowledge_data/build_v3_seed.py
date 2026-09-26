"""v3 灌库计划构建器（2026-09-26）。

汇总本轮全部新素材 → v3_seed_plan.json {replaces, creates}：
- replaces：12 名优秀学生干部详版（裁掉家长PII）、学校简介（双语权威版）、
  招生简章（2026 六大亮点整合版，招生办手机号按约定不入库）、
  芝兰玉树总览、25周年校庆重量级嘉宾图片（嘉宾名单详版）
- creates：报纸杂志报道 15 条（press_vision_notes）、宣传材料/理念图示 9 条
  （promo_vision_notes）、芝兰玉树详情 5 条（students_zhilan_notes）、
  综合荣誉分组 7 条（v3_new_entries 中标题含 总览/全录 者）

PII 护栏：任何 content 命中手机号正则即报错退出；家长/监护人信息整段裁除。
产出只落地 JSON，不进 git（.gitignore scripts/knowledge_data/*.json）。
"""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).resolve().parent
PHONE_RE = re.compile(r"1[3-9]\d{9}")


def guard(content: str, ctx: str) -> str:
    """手机号脱敏：替换为占位符并记日志（座机不匹配正则，不受影响）。"""
    hits = PHONE_RE.findall(content)
    if hits:
        print(f"[脱敏] {ctx}: 隐去手机号 {len(hits)} 处")
        content = PHONE_RE.sub("〔手机号已隐去〕", content)
    return content


def strip_parents(basic: str) -> str:
    # 「；父亲张全月（…），母亲李海彬（…）〔联系方式已隐去〕」整段裁除
    for kw in ("父亲", "母亲", "监护人", "家长联系"):
        i = basic.find(kw)
        if i != -1:
            basic = basic[:i].rstrip("；;，, ")
    return basic


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def main():
    plan = {"replaces": [], "creates": []}

    # ---------- 1. 12 名优秀学生干部详版（replace） ----------
    cadre_titles = {
        "2025届": {
            "张乐意": "南海区优秀学生干部（2025届）：张乐意",
            "何文昊": "南海区优秀学生干部（2025届）：何文昊",
            "张子熙": "南海区优秀学生干部（2025届）：张子熙",
            "贾兆琦": "南海区优秀学生干部（2025届）：贾兆琦",
            "陈蕾雯": "南海区优秀学生干部（2025届）：陈蕾雯",
        },
        "2026届": {
            "余嘉琪": "南海区优秀学生干部（2026届）：余嘉琪",
            "梁政彪": "南海区优秀学生干部（2026届）：梁政彪",
            "陈浚林": "南海区优秀学生干部（2026届）：陈浚林",
            "陈璟雯": "南海区优秀学生干部（2026届）：陈璟雯（个人简介）",
        },
        "2027届": {
            "梁以晴": "南海区优秀学生干部（2027届）：梁以晴",
            "陈彤菲": "南海区优秀学生干部（2027届）：陈彤菲",
            "马佳莹": "南海区优秀学生干部（2027届）：马佳莹",
        },
    }
    cadre = load("cadre_transcripts.json")["students"]
    for s in cadre:
        old_title = cadre_titles.get(s["届别"], {}).get(s["name"])
        if not old_title:
            raise SystemExit(f"干部条目标题映射缺失：{s['届别']} {s['name']}")
        lines = [
            f"南海区优秀学生干部（{s['届别']}，{s['学年']}评选）申报表全录：{s['name']}，石实实验学校学生。",
            "",
            f"【基本信息】{strip_parents(s.get('基本信息', ''))}",
        ]
        awards = s.get("获奖情况") or []
        if awards:
            lines.append("【获奖情况】")
            lines += [f"- {a}" for a in awards]
        if s.get("德育考核"):
            lines.append(f"【德育考核】{s['德育考核']}")
        if s.get("主要事迹"):
            lines.append(f"【主要事迹】{s['主要事迹']}")
        if s.get("评选流程"):
            lines.append(f"【评选流程】{s['评选流程']}")
        lines.append(f"（来源：南海区优秀学生干部申报表扫描件 {s.get('pages', '?')} 页，2026-09 vision 逐页识读）")
        content = guard("\n".join(lines), f"cadre:{s['name']}")
        new_title = old_title.replace("（个人简介）", "")
        plan["replaces"].append({
            "match_title": old_title,
            "entry": {
                "title": new_title,
                "category": "students",
                "tags": ["优秀学生干部", "南海区", s["届别"]],
                "summary": f"{s['name']}（{s['届别']}）南海区优秀学生干部申报材料全录",
                "content": content,
            },
        })

    # ---------- 2. 报纸杂志报道 15 条（create） ----------
    press = load("press_vision_notes.json")["newspapers"]
    for n, p in enumerate(press, 1):
        title = p["title"] or "无题版面"
        kb_title = f"媒体报道：{p['outlet']}·{title}"[:200]
        lines = [
            f"【媒体】{p['outlet']}",
            f"【版面/日期】{p['date']}",
            f"【标题】{title}",
        ]
        if p.get("author"):
            lines.append(f"【作者/署名】{p['author']}")
        lines.append("【内容要点】")
        lines += [f"- {k}" for k in p["key_points"]]
        lines.append("（来源：校史资料《2018-2020年学校报纸及杂志（扫描件）》原件，2026-09 vision 识读；'辨认存疑'为原件小字不确定处）")
        plan["creates"].append({
            "title": kb_title,
            "category": "history",
            "tags": ["媒体报道", p["outlet"]],
            "summary": f"{p['outlet']}关于石实的报道：{title}"[:200],
            "content": guard("\n".join(lines), f"press#{n}"),
        })

    # ---------- 3. 宣传材料/理念图示 9 条（create） ----------
    promo_cat = {
        "2024年宣纸折页（正面）1.png": ("school_intro", ["宣传材料", "折页", "中考成绩"]),
        "2024年宣纸折页（背面）2.png": ("school_intro", ["宣传材料", "折页", "师资", "硬件"]),
        "招生简章.pdf（p1，2026年招生简章，六折页正面）": ("school_intro", ["招生简章", "荣誉", "品牌"]),
        "招生简章.pdf（p2，2026年招生简章）": ("school_intro", ["招生简章", "师资", "竞赛"]),
        "一、学校基础信息【必需】/10、育人目标/学校育人体系建设.jpg": ("philosophy", ["育人体系", "扬长教育"]),
        "一、学校基础信息【必需】/石实教学理念/石实拔尖创新人才培养体系.png": ("philosophy", ["拔尖创新人才", "一院两平台四班四中心六赛道"]),
        "一、学校基础信息【必需】/石实教学理念/扬长课程体系结构图.pptx（单页全图，经PowerPoint转PDF渲染识读）": ("philosophy", ["课程体系", "两主两翼三阶八域"]),
        "二、学校校史资料【必需】/宣传栏展示1.jpg": ("school_intro", ["宣传栏", "师资", "名师"]),
        "二、学校校史资料【必需】/宣传栏展示2.jpg": ("honors", ["宣传栏", "2025成果", "信息学"]),
    }
    promo = load("promo_vision_notes.json")["materials"]
    for p in promo:
        cat, tags = promo_cat.get(p["file"], ("school_intro", ["宣传材料"]))
        kb_title = f"{p['kind']}：{p['title']}"[:200]
        lines = [f"【材料】{p['kind']}"] + [f"- {k}" for k in p["key_points"]]
        lines.append("（来源：数据清单原件，2026-09 vision 识读；'辨认存疑'为原件小字不确定处，口径冲突处已并列标注）")
        plan["creates"].append({
            "title": kb_title,
            "category": cat,
            "tags": tags,
            "summary": p["title"][:200],
            "content": guard("\n".join(lines), f"promo:{kb_title}"),
        })

    # ---------- 4. 芝兰玉树 1 总览（replace）+ 5 详情（create） ----------
    zh = load("students_zhilan_notes.json")["sections"]
    by_title = {s["title"]: s for s in zh}
    sec = by_title["中考杰出榜（2003-2024届，共40人）"]
    plan["replaces"].append({
        "match_title": "优秀学生（芝兰玉树电子版展示）",
        "entry": {
            "title": "优秀学生展示：芝兰玉树（25周年画册学生篇总览）",
            "category": "students",
            "tags": ["优秀学生", "芝兰玉树", "校庆画册"],
            "summary": "25周年画册第三篇'芝兰玉树·学生'：中考杰出榜40人+顶尖名校生52人+学术翘楚/政商精英/文艺之星，详情见分组条目",
            "content": guard(
                "石实实验学校25周年校庆画册第三篇《芝兰玉树·学生》收录校方公开展示的优秀学子：\n"
                "- 中考杰出榜（2003-2024届40人，各届中考佼佼者）\n"
                "- 顶尖名校生（52人：清华、北大、港大、港科大、港中文、新加坡国立、南洋理工、伦敦政经、宾夕法尼亚、华盛顿、墨尔本、匹兹堡等）\n"
                "- 学术翘楚（10位博士校友：剑桥/港科大/港大/海德堡/北大/南洋理工/港中文等）\n"
                "- 政商精英（知名校友：日丰集团副总裁许腾徽、环嘉资产董事长邹俊毅、联合国秘书处翻译龚田田等）\n"
                "- 文艺之星（伯克利音乐学院、北京电影学院、清华美院、中央美院、UCL等）\n\n"
                "各分组名单与简介详见条目：芝兰玉树·中考杰出榜 / 芝兰玉树·顶尖名校生 / 芝兰玉树·学术翘楚 / 芝兰玉树·政商精英 / 芝兰玉树·文艺之星。\n"
                "（来源：『优秀学生（芝兰玉树电子版展示）.pdf』8页，校方公开展示版，2026-09 vision 识读）",
                "zhilan:总览"),
        },
    })
    zh_plan = [
        ("中考杰出榜（2003-2024届，共40人）", "芝兰玉树·中考杰出榜（2003-2024届40人名单）",
         "【中考杰出榜】（画册篇首语）扬长教育，人人出彩。每年中考成绩均居佛山最前列。\n" + "\n".join(f"- {x}" for x in sec["names"]) + f"\n（{sec.get('note','')}）"),
        ("顶尖名校生（p040-047，52人，附个人简介）", "芝兰玉树·顶尖名校生（52人简介）",
         "【顶尖名校生】为党育人，为国育才。石实学子壮志凌云，行健致远，凭借卓越的成绩与全面的素养脱颖而出，赢得国内外顶尖学府青睐。\n\n【重点简介】\n"
         + "\n".join(f"- {x}" for x in by_title["顶尖名校生（p040-047，52人，附个人简介）"]["highlights"])
         + "\n\n【其余名校生（届别/大学）】\n" + "\n".join(f"- {x}" for x in by_title["顶尖名校生（p040-047，52人，附个人简介）"]["others_university"])),
        ("学术翘楚（p050，博士校友10人）", "芝兰玉树·学术翘楚（10位博士校友）",
         "【学术翘楚】\n" + "\n".join(f"- {x}" for x in by_title["学术翘楚（p050，博士校友10人）"]["people"])),
        ("政商精英（p051，校友9人）", "芝兰玉树·政商精英（知名校友）",
         "【政商精英】（头衔为画册刊载时点信息）\n" + "\n".join(f"- {x}" for x in by_title["政商精英（p051，校友9人）"]["people"])),
        ("知名校友·文艺之星（p049，6人）", "芝兰玉树·文艺之星（知名校友）",
         "【知名校友·文艺之星】才艺辈出，奋斗不息。石实校友以追求卓越为径，步入社会后闪耀舞台、在政商学界领域展展才华。\n"
         + "\n".join(f"- {x}" for x in by_title["知名校友·文艺之星（p049，6人）"]["people"])),
    ]
    for src_title, kb_title, content in zh_plan:
        plan["creates"].append({
            "title": kb_title,
            "category": "students",
            "tags": ["优秀学生", "芝兰玉树", "校友"],
            "summary": kb_title[:200],
            "content": guard(content + "\n（来源：芝兰玉树电子版展示PDF，校方公开展示版；小字辨认存疑处已标注）", f"zhilan:{kb_title}"),
        })

    # ---------- 5. 学校简介（replace，双语权威版+口径注） ----------
    intro_txt = (HERE / "docs_text_v3" / "一、学校基础信息【必需】" / "1、学校简介.txt").read_text(encoding="utf-8")
    intro_body = intro_txt.split("【提取】Word/PPT COM 全文（2026-09-26）", 1)[1].strip()
    intro_body += (
        "\n\n【口径说明】校方不同材料存在细微口径差异，以本简介为主：教学班数 87（2026招生简章作86）；"
        "专任教师 282（英文版作259，折页作'教职员工300多名'，2026招生简章作'逾260名'）；"
        "正高级教师 4（简章作3）；博士教师 1（简章作2）；累计清北 40 名（2024.4折页作24-25名、2024.11报道作29名，为时间递进口径）；"
        "图书馆为广东省中小学'最美阅读空间'（折页作佛山市口径）。数据截至2026年9月。"
    )
    plan["replaces"].append({
        "match_title": "学校简介",
        "entry": {
            "title": "学校简介",
            "category": "school_intro",
            "tags": ["学校简介", "官方", "双语"],
            "summary": "石实实验学校官方简介（中英双语，2026）：1999年石门中学创办，扬长教育、人人出彩",
            "content": guard(intro_body, "学校简介"),
        },
    })

    # ---------- 6. 招生简章（replace，2026六大亮点整合版，电话按约定隐去） ----------
    promo_by_file = {p["file"]: p for p in promo}
    p1 = next(p for k, p in promo_by_file.items() if "招生简章" in k and "p1" in k)
    p2 = next(p for k, p in promo_by_file.items() if "招生简章" in k and "p2" in k)
    zs_lines = [
        "石实实验学校2026年招生简章（六大亮点·引领佛山）要点整合。",
        "",
        "【亮点1 品牌引领】",
    ]
    zs_lines += [f"- {k}" for k in p1["key_points"][:7]]
    zs_lines.append("- 联系方式：初中招生办蔡老师、小学招生办马老师；招生咨询请致电学校公开电话 0757-85930080 或关注学校微信公众号（招生办直线电话/咨询微信号详见当年纸质招生简章，此处不录入个人信息）")
    zs_lines.append("")
    zs_lines.append("【亮点2-6】")
    zs_lines += [f"- {k}" for k in p2["key_points"]]
    zs_lines.append("（来源：2026年招生简章PDF两页，2026-09 vision 识读；'辨认存疑'为原件小字不确定处）")
    plan["replaces"].append({
        "match_title": "招生简章",
        "entry": {
            "title": "招生简章",
            "category": "school_intro",
            "tags": ["招生", "简章", "2026"],
            "summary": "石实实验学校2026年招生简章六大亮点：品牌引领/师资雄厚/成绩突出/竞赛领航/精准培养/全面发展",
            "content": guard("\n".join(zs_lines), "招生简章"),
        },
    })

    # ---------- 7. 25周年校庆重量级嘉宾图片（replace，嘉宾名单详版） ----------
    plan["replaces"].append({
        "match_title": "图片资料：25周年校庆重量级嘉宾图片",
        "entry": {
            "title": "图片资料：25周年校庆重量级嘉宾图片",
            "category": "history",
            "tags": ["25周年校庆", "领导嘉宾"],
            "summary": "2024年11月石实25周年校庆晚会出席领导嘉宾（据照片文件名整理）",
            "content": guard(
                "2024年11月石实实验学校25周年校庆晚会出席领导嘉宾（据校方照片资料文件名整理，2026-09）：\n"
                "- 佛山市教育局副局长傅为贵\n"
                "- 南海区教育局党组书记、局长钟文川\n"
                "- 南海区教育局党组成员、副局长田树民\n"
                "- 南海区委副书记、区委政法委书记岑灼雄（观看学生专门为校庆创作的手工作品）\n"
                "- 南海区教育局党组成员、副局长张鉴华（为'石实功勋'颁奖）\n"
                "- 大沥镇党委委员黎灿垣（致辞）\n"
                "- 广东省教育厅事务中心信息数据部主任杨生华（点赞'扬长教育'）\n"
                "- 教育部中学校长培训中心主任助理邓睿博士（点赞'扬长教育'）\n"
                "- 清华大学原副校长张凤昌、清华大学信息化技术中心副主任佟秋利（在南海区教育局副局长焦玉君陪同下观看学校教育教学成果）\n"
                "- 香港科技大学(广州)党委书记屈哨兵（观看教育教学成果展）",
                "校庆嘉宾"),
        },
    })

    # ---------- 8. 综合荣誉分组 7 条（create） ----------
    v3 = load("v3_new_entries.json")
    for e in v3:
        if "总览" in e["title"] or "全录" in e["title"]:
            plan["creates"].append({
                "title": e["title"],
                "category": e.get("category", "honors"),
                "tags": e.get("tags", ["荣誉"]),
                "summary": e.get("summary", e["title"])[:200],
                "content": guard(e["content"], f"v3:{e['title']}"),
            })

    out = HERE / "v3_seed_plan.json"
    out.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"replaces: {len(plan['replaces'])}  creates: {len(plan['creates'])}  -> {out}")
    dup = len(plan["creates"]) + len({r['match_title'] for r in plan['replaces']})
    print(f"计划动作合计 {dup} 条（新建+替换）")


if __name__ == "__main__":
    main()
