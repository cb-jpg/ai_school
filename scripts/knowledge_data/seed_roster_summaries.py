"""名单汇总条目灌库（2026-09-26）：修复"问优秀学生只答1个人"。

根因：RAG 每问只带 top_k=6 条资料，2025届优秀学生 7 个独立条目物理上凑不齐，
LLM 只看到 1 人 → 答 1 人还说没别的。库本身 60 条优秀学生类条目完好。
修法：建 3 条"一 chunk 装下全名单"的汇总条目（内容只有名单，无家长PII），
新建即入索引（无删除、无需重启）。
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

from seed_via_api import BASE, log, make_session

STU_2025 = ["李佳骏", "李欣阳", "梅芊涵", "郑祺琦", "郭家序", "陈浩文", "龚俊铖"]
STU_2026 = ["卢思贤", "吴嘉宝", "朱采瑶", "李嘉丽", "李洛瑶", "林炫希", "梁沛琳",
            "王悦琪", "王浚森", "章佳盈", "罗意竣", "莫婧沂", "谢欣潼", "钟董庆",
            "陈峻琦", "陈文欣", "马洋"]
STU_2027 = ["张卓尔", "李伟聪", "李展儒", "杨乐言", "潘婧萱", "王彤", "罗沛琪",
            "谭焯尹", "陈璐圆", "陈雨桐"]
CAD_2025 = ["张乐意", "何文昊", "张子熙", "贾兆琦", "陈蕾雯"]
CAD_2026 = ["余嘉琪", "梁政彪", "陈浚林", "陈璟雯"]
CAD_2027 = ["梁以晴", "陈彤菲", "马佳莹"]
BJ_STAR_STU = ["801陈梓涵", "804赖浚文", "806吴紫蓝", "808邱扬", "810李洁瑜"]
BJ_STAR_CAD = ["801招颖琳", "802谢正康", "803何文昊", "811张子熙", "813毛会健"]

SRC = "（来源：校方公示名单与申报材料，2026-09 整理；名单以校方公示为准，各人详情见知识库分条目）"

ENTRIES = [
    {
        "title": "学习标兵与南海区优秀学生总览（2025-2027届全名单）",
        "category": "students",
        "tags": ["学习标兵", "优秀学生", "名单", "汇总"],
        "summary": "学习标兵3人+南海区优秀学生34人（2025-2027届）+优秀学生干部12人+百佳之星10人全名单",
        "content": (
            "石实实验学校学习标兵与优秀学生全名单总览。\n\n"
            "【学习标兵（学校专题展示，3人）】\n"
            "- 邓桢（901班，中考优秀学生）：时间管理，把大目标拆成阶段任务，用阅读积累和笔记整理持续推进\n"
            "- 陈曼涵（902班，中考优秀学生）：课前预习、课堂投入、课后复习加错题复盘，学习闭环\n"
            "- 陈哲章（2022届毕业生）：凭信息学特长保送北京大学（第41届全国青少年信息学奥林匹克竞赛金牌）\n\n"
            f"【南海区优秀学生·2025届（共{len(STU_2025)}人）】{'、'.join(STU_2025)}\n"
            f"【南海区优秀学生·2026届（共{len(STU_2026)}人）】{'、'.join(STU_2026)}\n"
            f"【南海区优秀学生·2027届（共{len(STU_2027)}人）】{'、'.join(STU_2027)}\n\n"
            f"【南海区优秀学生干部·2025届（共{len(CAD_2025)}人）】{'、'.join(CAD_2025)}\n"
            f"【南海区优秀学生干部·2026届（共{len(CAD_2026)}人）】{'、'.join(CAD_2026)}\n"
            f"【南海区优秀学生干部·2027届（共{len(CAD_2027)}人）】{'、'.join(CAD_2027)}\n\n"
            f"【百佳之星·2025届优秀学生】{'、'.join(BJ_STAR_STU)}\n"
            f"【百佳之星·2025届优秀学生干部】{'、'.join(BJ_STAR_CAD)}\n\n"
            "此外，25周年画册《芝兰玉树》收录中考杰出榜40人（2003-2024届）、顶尖名校生52人等，"
            "详见'优秀学生展示：芝兰玉树'条目。\n" + SRC
        ),
    },
    {
        "title": "南海区优秀学生名单汇总（2025届7人/2026届17人/2027届10人）",
        "category": "students",
        "tags": ["南海区优秀学生", "名单", "汇总"],
        "summary": "南海区优秀学生各届全名单：2025届7人、2026届17人、2027届10人",
        "content": (
            "石实实验学校获评南海区优秀学生各届全名单：\n\n"
            f"【2025届（共{len(STU_2025)}人）】{'、'.join(STU_2025)}\n"
            f"【2026届（共{len(STU_2026)}人）】{'、'.join(STU_2026)}\n"
            f"【2027届（共{len(STU_2027)}人）】{'、'.join(STU_2027)}\n\n" + SRC
        ),
    },
    {
        "title": "南海区优秀学生干部名单汇总（2025-2027届12人）",
        "category": "students",
        "tags": ["优秀学生干部", "名单", "汇总"],
        "summary": "南海区优秀学生干部各届全名单：2025届5人、2026届4人、2027届3人",
        "content": (
            "石实实验学校获评南海区优秀学生干部各届全名单：\n\n"
            f"【2025届（共{len(CAD_2025)}人）】{'、'.join(CAD_2025)}\n"
            f"【2026届（共{len(CAD_2026)}人）】{'、'.join(CAD_2026)}\n"
            f"【2027届（共{len(CAD_2027)}人）】{'、'.join(CAD_2027)}\n\n" + SRC
        ),
    },
]


def main():
    s = make_session()
    listed = s.get(f"{BASE}/api/knowledge/list", params={"include_archived": "true"}, timeout=30)
    listed.raise_for_status()
    by_title = {i["title"] for i in listed.json()}
    for e in ENTRIES:
        if e["title"] in by_title:
            log(f"跳过（已存在）「{e['title']}」")
            continue
        r = s.post(f"{BASE}/api/knowledge/create", json={
            "title": e["title"], "category": e["category"], "tags": e["tags"],
            "summary": e["summary"][:200], "content": e["content"],
        }, timeout=120)
        log(f"{'OK ' if r.status_code == 200 else 'FAIL'} 「{e['title']}」HTTP {r.status_code}")
        if r.status_code != 200:
            print(r.text[:300])
            sys.exit(1)
        time.sleep(1.5)


if __name__ == "__main__":
    main()
