"""
知识库后台功能验证（§7 功能点逐项）—— 覆盖：
  ① 手动创建/批量上传处理状态  ② 切分与向量化(chunk_count/检索命中)
  ③ 分类与标签(列表过滤/tags 更新)  ④ 更新记录(updated_at 变化)
  ⑤ 索引重建(单条 reindex + bulk reindex)
测试自建条目、结束自动清理，不污染现有知识库。

用法（后端需运行中）：
  .venv/Scripts/python.exe verification/probe_admin_features.py
控制台中文乱码是 GBK 显示问题，不影响判定。
"""
import json
import pathlib
import time
import urllib.request
import urllib.error

BASE = "http://localhost:12393"
AUTH = pathlib.Path(__file__).resolve().parents[1] / "data" / "auth"
PASS, FAIL = 0, 0
CREATED = []  # 待清理的 entry_id


def check(name, cond, detail=""):
    global PASS, FAIL
    tag = "PASS" if cond else "FAIL"
    if cond:
        PASS += 1
    else:
        FAIL += 1
    print(f"  {tag}  {name}  {detail}")


def req(path, method="GET", body=None, token=None, timeout=60):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    if body is not None:
        r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8", "replace") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8", "replace") or "{}")
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


# ---------- 登录 ----------
print("[0] 管理员登录")
code, data = req("/api/auth/login", "POST", {"username": "admin", "password": "admin12345"})
if code != 200:
    pw_file = AUTH / "initial_admin_password.txt"
    code, data = req("/api/auth/login", "POST",
                     {"username": "admin", "password": pw_file.read_text().strip() if pw_file.exists() else ""})
token = data.get("token") if code == 200 else None
check("登录获取 token", token is not None, f"[code={code}]")

# ---------- ①② 长文创建：切分 + 向量化状态 ----------
print("[1] 手动创建长文档 → 切分与向量化")
long_text = (
    "石实实验学校创建于二〇一〇年，是一所全日制民办寄宿学校。学校位于市区东部，占地约两百亩，"
    "建有教学楼三栋、实验楼一栋、图书馆一栋、标准化运动场和室内体育馆。"
) * 12  # ~1200 字，应切出多块
code, entry = req("/api/knowledge/create", "POST", {
    "title": "【测试】切分验证长文", "content": long_text,
    "category": "school_intro", "tags": ["测试", "切分验证"],
}, token=token)
ok = code == 200 and entry.get("id")
check("POST /create", ok, f"[code={code}, status={entry.get('status')}]")
if ok:
    CREATED.append(entry["id"])
    check("状态流转为 indexed(切分+向量化完成)", entry.get("status") == "indexed",
          f"[status={entry.get('status')}]")
    check("切分为多块(chunk_count>1)", int(entry.get("chunk_count") or 0) > 1,
          f"[chunk_count={entry.get('chunk_count')}]")

    code, detail = req(f"/api/knowledge/{entry['id']}", token=token)
    chunks = detail.get("chunks") or []
    check("GET /{id} 可逐块查看", code == 200 and len(chunks) == int(entry.get("chunk_count") or 0),
          f"[chunks={len(chunks)}]")

    code, sr = req("/api/knowledge/search", "POST",
                   {"query": "石实实验学校是什么时候创建的", "top_k": 3}, token=token)
    hit = any(d.get("entry_id") == entry["id"] for d in (sr.get("results") or []))
    check("向量检索命中新条目", code == 200 and hit, f"[hits={len(sr.get('results') or [])}]")

# ---------- ③ 分类与标签 ----------
print("[2] 分类与标签")
code, items = req("/api/knowledge/list?category=school_intro", token=token)
check("list 按分类过滤", code == 200 and any(i["id"] in CREATED for i in items or []),
      f"[n={len(items or [])}]")

if CREATED:
    code, upd = req(f"/api/knowledge/{CREATED[0]}", "PUT",
                    {"tags": ["测试", "标签已更新"]}, token=token)
    check("PUT 更新标签", code == 200 and upd.get("tags") == ["测试", "标签已更新"],
          f"[tags={upd.get('tags')}]")

# ---------- ④ 更新记录 ----------
print("[3] 更新记录（updated_at）")
if CREATED:
    code, before = req(f"/api/knowledge/{CREATED[0]}", token=token)
    time.sleep(1.1)  # 确保时间戳可分辨
    req(f"/api/knowledge/{CREATED[0]}", "PUT", {"summary": "更新记录验证"}, token=token)
    code, after = req(f"/api/knowledge/{CREATED[0]}", token=token)
    check("更新后 updated_at 前移", str(after.get("updated_at")) > str(before.get("updated_at")),
          f"[{before.get('updated_at')} → {after.get('updated_at')}]")
    print("  NOTE  版本号/历史版本列表：模型无 version 字段，功能缺失（报告项，非脚本可验）")

# ---------- ⑤ 索引重建 ----------
print("[4] 索引重建")
if CREATED:
    code, ri = req(f"/api/knowledge/{CREATED[0]}/reindex", "POST", token=token)
    check("POST /{id}/reindex", code == 200 and ri.get("success"),
          f"[chunks={ri.get('chunk_count')}]")

    code, sr = req("/api/knowledge/search", "POST",
                   {"query": "石实实验学校的校园设施", "top_k": 3}, token=token)
    hit = any(d.get("entry_id") == CREATED[0] for d in (sr.get("results") or []))
    check("重建后检索仍命中", code == 200 and hit, f"[hits={len(sr.get('results') or [])}]")

code, bulk = req("/api/knowledge/bulk-operation", "POST",
                 {"entry_ids": CREATED, "operation": "reindex"}, token=token)
check("bulk reindex(全库)", code == 200, f"[n={len(CREATED)}]")

# ---------- 批量上传（多文件） ----------
print("[5] 批量上传与处理状态")
upload_dir = pathlib.Path(__file__).resolve().parents[1] / "data" / "knowledge" / "documents"
upload_dir.mkdir(parents=True, exist_ok=True)
import uuid

boundary = uuid.uuid4().hex
files = [("t1.txt", "招生简章测试内容：石实实验学校面向全市招收初一新生。", "admissions"),
         ("t2.txt", "校园活动测试内容：每年五月举办校园艺术节。", "activities")]
uploaded_ids = []
for fname, text, cat in files:
    parts = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{fname}\"\r\n"
        f"Content-Type: text/plain\r\n\r\n{text}\r\n",
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"title\"\r\n\r\n【测试】{fname}\r\n",
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"category\"\r\n\r\n{cat}\r\n",
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"tags\"\r\n\r\n测试\r\n--{boundary}--\r\n",
    ]
    payload = "".join(parts).encode()
    r = urllib.request.Request(BASE + "/api/knowledge/upload", data=payload, method="POST")
    r.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    r.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(r, timeout=60) as resp:
        up = json.loads(resp.read().decode("utf-8", "replace"))
    ok = up.get("status") == "completed" and up.get("entry_id")
    check(f"上传 {fname} → completed", ok, f"[status={up.get('status')}]")
    if ok:
        uploaded_ids.append(up["entry_id"])
        CREATED.append(up["entry_id"])

check("批量上传全部处理成功", len(uploaded_ids) == len(files), f"[{len(uploaded_ids)}/{len(files)}]")

# ---------- 清理 ----------
print("[6] 清理测试数据")
for eid in CREATED:
    code, _ = req(f"/api/knowledge/{eid}", "DELETE", token=token)
    check(f"删除 {eid[:8]}…", code == 200, f"[code={code}]")
for fname, _, _ in files:
    f = upload_dir / fname
    if f.exists():
        f.unlink()

print(f"\nRESULT: {PASS} passed, {FAIL} failed")
raise SystemExit(1 if FAIL else 0)
