# -*- coding: utf-8 -*-
"""「校长是谁」检索准确率探针（2026-10-18 用户反馈排查）。

背景：反馈称"问校长是谁回答不对、数据太旧"。聊天历史实锤=检索命中历史条目
（大事记/校庆的"时任校长"阳智平/罗剑辉等）压过/挤掉 10-14 问答体条目（梁小翠）。
本脚本对多种问法走与对话 RAG 完全相同的 /api/knowledge/search 路径，输出：
  - 问答条目（标题含 梁小翠）在 top6 中的排名（1=最优先）
  - 前 3 名竞争条目标题（看旧条目抢位情况）

用法: python scripts/knowledge_data/check_principal_accuracy.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from seed_via_api import make_session, BASE  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

QA_MARK = "梁小翠"

QUESTIONS = [
    "校长是谁",
    "你们的校长是谁",
    "我们的校长是谁",
    "现任校长是谁",
    "学校校长叫什么名字",
    "谁是校长",
    "校长是哪位",
    "介绍一下你们的校长",
    "学校负责人是谁",
    "校长叫什么",
    "你们学校现在的校长",
    "罗剑辉是谁",
    "阳智平是谁",
    "以前的校长有哪些",
]


def main() -> int:
    s = make_session()
    hit1 = 0
    hit3 = 0
    miss = []
    for q in QUESTIONS:
        r = s.post(f"{BASE}/api/knowledge/search",
                   json={"query": q, "top_k": 6}, timeout=90)
        r.raise_for_status()
        data = r.json()
        results = (data.get("results") or data.get("data")
                   or data.get("items") or [])
        titles = []
        rank = None
        for i, it in enumerate(results):
            t = it.get("title") or it.get("metadata", {}).get("title") or "?"
            titles.append(t)
            if QA_MARK in t and rank is None:
                rank = i + 1
        top3 = " ∥ ".join(t[:28].replace("\n", " ") for t in titles[:3])
        if rank == 1:
            hit1 += 1
        elif rank is not None and rank <= 3:
            hit3 += 1
        else:
            miss.append(q)
        print(f"[{rank or '-'}] {q}\n     {top3}")
    print(f"\n第1名 {hit1}/{len(QUESTIONS)} | 前3 {hit1 + hit3}/{len(QUESTIONS)}")
    if miss:
        print("未进前3：", "、".join(miss))
    return 0


if __name__ == "__main__":
    sys.exit(main())
