"""全库信息点批量 e2e（2026-09-26）：12 个覆盖各内容域的问题走真实 WS 对话链路。

判定：expected 为关键词组，all=True 需全部命中；all=False 命中 min_hit 个即 PASS。
名单类问题按人名数给 PARTIAL（能答但不全）。

v2 修 harness（首轮 6 个 FAIL 全是测试器伪影）：
- 首轮等 conversation-chain-end 150s 超时截断（服务端实际 3-15s 已开口、长答案
  逐句 TTS 超过客户端窗口）→ 改为"静默 15s 即完成"空闲判定 + 总预算 240s；
- 回复文本取 audio.display_text 逐句拼接（每句一条，非累计）；
  首轮还拼了结尾 full-text 整段回复 → 全文重复；
- 逐题打印答案摘录，完整答复写 job tmp（学生姓名不上 git）。
"""
import asyncio
import json
import sys
import time
import urllib.request
import uuid

import websockets

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://183.36.243.124:12393"
WS = "ws://183.36.243.124:12393/client-ws"
ACCESS = __import__("os").environ.get("OLLV_ACCESS_TOKEN", "")
REPLY_LOG = r"C:\Users\28432\.claude\jobs\bc8ee473\tmp\batch_e2e_replies-20260926.txt"

QUESTIONS = [
    ("25届南海区优秀学生有哪几个人？",
     ["李佳骏", "李欣阳", "梅芊涵", "郑祺琦", "郭家序", "陈浩文", "龚俊铖"], False, 5),
    ("学校的学习标兵有哪些人？",
     ["邓桢", "陈曼涵", "陈哲章"], False, 2),
    ("南海区优秀学生干部有谁？",
     ["张乐意", "贾兆琦", "陈璟雯"], False, 2),
    ("石实信息学四杰是谁？",
     ["陈哲章", "梁宝烨", "王梓睿", "谢朝阳"], False, 3),
    ("芝兰玉树的中考杰出榜收录了多少人？",
     ["40"], True, 1),
    ("2026年招生简章的六大亮点是什么？",
     ["品牌", "师资", "竞赛", "精准培养"], False, 3),
    ("学校获得过哪些国家级荣誉？",
     ["健康学校", "防震减灾"], False, 2),
    ("两主两翼三阶八域是什么？",
     ["课程"], True, 1),
    ("2025年高考石实毕业生成绩如何？",
     ["清华", "保送"], False, 1),
    ("学校的地址和招生电话是多少？",
     ["85930080"], True, 1),
    ("25周年校庆来了哪些领导嘉宾？",
     ["钟文川", "傅为贵", "张凤昌", "屈哨兵"], False, 2),
    ("学校的办学理念和校训是什么？",
     ["扬长教育", "任重道远"], True, 2),
]


def login():
    req = urllib.request.Request(
        f"{BASE}/api/auth/login",
        data=json.dumps({"username": "student01", "password": "Shishi2026"}).encode(),
        headers={"Content-Type": "application/json", "X-Access-Token": ACCESS})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["token"]


async def ask(url, question, timeout=240, idle_gap=15):
    """发一条 text-input，逐句收 audio display_text，静默 idle_gap 秒视为答完"""
    async with websockets.connect(url, max_size=50 * 1024 * 1024) as ws:
        client_uid = str(uuid.uuid4())[:8]
        await ws.send(json.dumps({"type": "text-input", "text": question, "client_uid": client_uid}))
        loop = asyncio.get_event_loop()
        t0 = loop.time()
        last = t0
        parts = []
        while True:
            now = loop.time()
            if now - t0 > timeout:
                break
            if parts and now - last > idle_gap:
                break
            budget = max(1.0, min(idle_gap, timeout - (now - t0)))
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=budget)
            except asyncio.TimeoutError:
                if parts:
                    break
                continue
            m = json.loads(raw)
            t = m.get("type")
            if t == "audio":
                dt = (m.get("display_text") or {}).get("text")
                if dt:
                    parts.append(dt)
                    last = loop.time()
            elif t == "conversation-chain-end":
                break
        return "".join(parts)


def judge(reply, kws, need_all, min_hit):
    hits = [k for k in kws if k in reply]
    if need_all:
        return ("PASS" if len(hits) == len(kws) else "FAIL"), hits
    if len(hits) >= min_hit:
        return "PASS", hits
    if len(hits) >= 1:
        return "PARTIAL", hits
    return "FAIL", hits


async def main():
    jwt = login()
    url = f"{WS}?token={ACCESS}&user_token={jwt}"
    rows = []
    replies = []
    for i, (q, kws, need_all, min_hit) in enumerate(QUESTIONS, 1):
        t_start = time.time()
        reply = await ask(url, q)
        v, hits = judge(reply, kws, need_all, min_hit)
        rows.append((i, q, v, hits))
        replies.append(f"Q{i} [{v}] {q}\n{reply}\n{'-' * 60}")
        print(f"[{i:>2}/12] {v:<7} 命中{len(hits)}/{len(kws)} {hits} | {q}  ({time.time()-t_start:.0f}s)")
        print(f"      ↳ {reply[:150].replace(chr(10), ' ')}")
        with open(REPLY_LOG, "a", encoding="utf-8") as f:
            f.write(f"\n{replies[-1]}\n")
        await asyncio.sleep(2)

    print("\n===== 汇总 =====")
    npass = sum(1 for r in rows if r[2] == "PASS")
    npartial = sum(1 for r in rows if r[2] == "PARTIAL")
    for i, q, v, hits in rows:
        print(f"{v:<8} {q}")
    print(f"\nRESULT: {npass} PASS / {npartial} PARTIAL / {len(rows)-npass-npartial} FAIL")
    print(f"完整答复：{REPLY_LOG}")


if __name__ == "__main__":
    open(REPLY_LOG, "w", encoding="utf-8").close()
    asyncio.run(main())
