# 召回质量探针：在库语义题 / 在库精确词题 / 离库题 三类查询的召回表现
# 运行：仓库根目录下 ./.venv/Scripts/python.exe verification/probe_recall_quality.py
import json
import sys
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

QUERIES = [
    ("在库·语义", "我们学校是什么时候创办的"),
    ("在库·精确词", "1999年 学校有什么事"),
    ("离库·食堂", "食堂饭菜好不好吃"),
    ("离库·无关", "特朗普的税收政策"),
]


def login() -> str:
    password = (ROOT / "data" / "auth" / "initial_admin_password.txt").read_text(
        encoding="utf-8"
    ).strip()
    req = urllib.request.Request(
        "http://127.0.0.1:12393/api/auth/login",
        data=json.dumps({"username": "admin", "password": password}).encode(),
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=10).read())["token"]


def search(query: str, top_k: int, token: str):
    req = urllib.request.Request(
        "http://127.0.0.1:12393/api/knowledge/search",
        data=json.dumps({"query": query, "top_k": top_k}).encode("utf-8"),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {token}"},
    )
    return json.loads(urllib.request.urlopen(req).read())


def main():
    token = login()
    for label, query in QUERIES:
        d = search(query, 3, token)
        results = d.get("results", [])
        print(f"[{label}] {query}")
        if not results:
            print("  无召回（离库题应为空 → 交给坦诚话术）")
            continue
        for r in results:
            content = r["content"][:30].replace("\n", " ")
            print(f"  {round(r['score'], 3)}  {content}")


if __name__ == "__main__":
    main()
