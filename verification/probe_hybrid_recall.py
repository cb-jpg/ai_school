# 混合召回对比探针：同一批查询，单路向量 vs 向量+BM25(RRF) 命中对比
# 运行：仓库根目录下 ./.venv/Scripts/python.exe verification/probe_hybrid_recall.py
import os
import re
import sys

os.environ.setdefault("HF_HOME", os.path.join(os.path.dirname(__file__), "..", ".hf-cache"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from open_llm_vtuber.knowledge.vector_store import VectorStore, BM25_AVAILABLE

TOP_K = 5
MIN_SCORE = 0.3


def fmt(results):
    return [(c.content[:36].replace("\n", " ") + "…", round(s, 3)) for c, s in results]


def main():
    store = VectorStore("data/knowledge")
    chunks = store.get_all_chunks()
    print(f"corpus: {len(chunks)} chunks, BM25_AVAILABLE={BM25_AVAILABLE}")
    if not chunks:
        print("语料为空，先在管理后台上传知识条目")
        return

    # 从语料里抽一个年份精确词：向量路的典型弱项，BM25 的强项
    exact_token = None
    for c in chunks:
        m = re.search(r"(?:20\d{2}|19\d{2})年", c.content)
        if m:
            exact_token = m.group(0)
            break

    queries = ["我们学校是什么时候创办的", "学校的办学特色是什么"]
    if exact_token:
        queries.append(f"{exact_token} 学校有什么事")

    for q in queries:
        single = store._vector_search(q, chunks, TOP_K, MIN_SCORE)
        hybrid = store.search(q, top_k=TOP_K, min_score=MIN_SCORE)
        print(f"\nQ: {q}")
        print(f"  单路向量: {fmt(single)}")
        print(f"  混合召回: {fmt(hybrid)}")
        single_ids = {c.id for c, _ in single}
        rescued = [c for c, _ in hybrid if c.id not in single_ids]
        if rescued:
            print(f"  ↑ 混合新召回 {len(rescued)} 条（BM25 贡献）")


if __name__ == "__main__":
    main()
