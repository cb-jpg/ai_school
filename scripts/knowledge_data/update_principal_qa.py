# -*- coding: utf-8 -*-
"""校长问答条目强刷（2026-10-18）：用户反馈"问校长是谁回答不对、数据太旧"。

排查结论（详见当日会话）：
- 10-13 聊天历史实锤坏回答=LLM 拿历史条目（大事记/校庆"时任校长"阳智平/罗剑辉
  等）对冲现任口径。10-14 问答体条目上线后检索已 13/14 第一名，但：
  ①"你们学校现在的校长"仍被 2017年大事记 抢第 1（时间词问法没覆盖）；
  ②旧 chunk 与问答条目一起进上下文时 LLM 仍可能拿"时任校长"对冲（无指令约束）。
- 本脚本同标题删旧建新（沿用 seed_v31 强刷机制），补时间词问法+历任辨析+回答规则。

用法: python scripts/knowledge_data/update_principal_qa.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

from seed_via_api import (BASE, REQ_TIMEOUT, SLEEP_BETWEEN, health_check,  # noqa: E402
                          log, make_session)

TITLE = "问答：学校的校长/负责人是谁？（梁小翠）"

CONTENT = """问：学校的校长是谁？ 答：校长是梁小翠。
问：现在的校长是谁？ 答：现任校长是梁小翠。
问：你们学校现在的校长是谁？ 答：现任校长是梁小翠。
问：目前的校长/如今的校长是哪位？ 答：都是梁小翠——她任石实实验学校校长，是学校负责人；日常校务由执行校长陈云兵主持。
问：谁是校长？/校长是哪位？/校长叫什么名字？ 答：校长叫梁小翠。
问：学校的负责人是谁？ 答：学校负责人是校长梁小翠；日常校务由执行校长陈云兵主持（南粤优秀教师、高级家庭教育指导师）。
问：梁小翠是谁？ 答：梁小翠任石实实验学校校长，是学校负责人：高中历史高级教师，广东省班主任专业能力大赛省一等奖，佛山市优秀青年教师、佛山市名班主任，佛山市英才计划基础教育名班主任工作室主持人，参编教育著作6部，主持或参与国家级、省、市、区级研究课题16项。
问：梁小翠是校长吗？ 答：是。梁小翠任石实实验学校校长，负责学校全面工作。
问：罗剑辉是谁？ 答：罗剑辉是学校历任领导——2024年校庆报道彼时任党总支书记、校长；他不是现任校长。现任校长是梁小翠。
问：阳智平是谁？ 答：阳智平是学校历任校长（2017年时任），不是现任校长。现任校长是梁小翠。
问：以前的校长有哪些？ 答：学校发展历程中有多位历任校领导（如阳智平、罗剑辉等，详见"学校历任重要领导"相关资料）；现任校长是梁小翠。
问：学校领导有哪些人？ 答：现任校长梁小翠（学校负责人）、执行校长陈云兵；学校还聘请4位大咖名师担任教育顾问：科学教育顾问顾吉环（原中央军委科技委大校、钱学森秘书）、人文教育顾问余映潮（全国著名语文特级教师）、美育教育顾问邓国平（中国著名音乐家）、荣誉科学副校长潘越（哈佛博士后、中山大学正高级教授）。
问：校长是做什么老师出身的？ 答：梁小翠校长是高中历史高级教师出身，国家教育高端研修课程类立项课题项目主持人、华南师范大学基础教育师资导师。
【回答规则】凡被问"校长/负责人/现任/现在的领导"，一律回答现任校长梁小翠（执行校长陈云兵主持日常校务）。历史资料（大事记、校庆报道、宣传栏）中出现的"时任校长/彼时校长"（如阳智平、陈慧文、盘文健、叶影颜、李俊兴、罗剑辉）均为历任领导，不是现任校长：禁止用历任名单回答现任问题，禁止宣称"资料冲突"或"可能换届"，被问到旧名字时说明其是历任领导并给出现任校长。
（来源：2026年招生简章·第2页，2026-09录入，2026-10-14转自信问答口径，2026-10-18补时间词问法与历任辨析）"""

SUMMARY = ("问：学校的校长是谁。答：校长是梁小翠。问：现在的/你们学校现在的校长是谁。答：现任校长是梁小翠。"
           "问：学校的负责人是谁。答：学校负责人是校长梁小翠；日常校务由执行校长陈云兵主持。"
           "问：罗剑辉/阳智平是谁。答：历任领导，非现任；现任校长是梁小翠。"
           "含回答规则：历史条目'时任校长'均不是现任，禁止用历任名单回答现任问题。")


def main() -> int:
    ok, desc, _ = health_check()
    log(f"开窗前服务器状态：{desc}")
    if not ok:
        sys.exit("服务器余量不足，按铁律不开窗。稍后再跑。")

    s = make_session()
    listed = s.get(f"{BASE}/api/knowledge/list", params={"include_archived": "true"}, timeout=30)
    listed.raise_for_status()
    by_title = {item["title"]: item["id"] for item in listed.json()}

    old_id = by_title.get(TITLE)
    if old_id:
        r = s.delete(f"{BASE}/api/knowledge/{old_id}", timeout=30)
        log(f"删除旧条目：HTTP {r.status_code}")
        time.sleep(SLEEP_BETWEEN)
    else:
        log("旧条目不存在（当作新建）")

    payload = {
        "title": TITLE,
        "category": "school_intro",
        "tags": ["问答", "学校领导"],
        "summary": SUMMARY[:200],
        "content": CONTENT,
    }
    r = s.post(f"{BASE}/api/knowledge/create", json=payload, timeout=REQ_TIMEOUT)
    log(f"新建条目：HTTP {r.status_code}（{len(CONTENT)} 字）")
    if r.status_code != 200:
        print(r.text[:300])
        return 1

    # 确认无同标题重复
    listed = s.get(f"{BASE}/api/knowledge/list", params={"include_archived": "true"}, timeout=30)
    n = sum(1 for it in listed.json() if it["title"] == TITLE)
    log(f"同标题条目数：{n}（应为 1）")
    return 0 if n == 1 else 1


if __name__ == "__main__":
    sys.exit(main())
