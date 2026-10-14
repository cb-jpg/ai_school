"""
知识库后台认证模块 - 多用户 + 角色（admin/editor/user）

设计约束：不引入数据库与新依赖。
- 账号存储：data/auth/users.json（密码使用标准库 scrypt 哈希）
- 令牌：HMAC-SHA256 签名（标准库 hmac），有效期 12 小时
- 角色权限：
    admin  : 全部知识库操作 + 用户管理；可进入管理后台
    editor : 知识库操作（增删改查/上传/URL/重建索引），不能管理用户
    user   : 普通 App 使用者，仅对话（聊天历史按用户名目录隔离）
"""

import base64
import csv
import hashlib
import hmac
import io
import json
import re
import secrets
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile
from fastapi import File as FastFile
from loguru import logger
from pydantic import BaseModel, Field

# data/auth 固定在仓库根目录下（与运行时工作目录解耦）
AUTH_DIR = Path(__file__).resolve().parents[3] / "data" / "auth"
USERS_FILE = AUTH_DIR / "users.json"
INITIAL_PASSWORD_FILE = AUTH_DIR / "initial_admin_password.txt"

TOKEN_TTL_SECONDS = 12 * 3600
# parent（家长）：权限与 user 相同（仅对话+浏览），但账号体系上独立一类，
# 便于按身份区分统计与后续差异化配置（2026-09-20 需求 #6）
VALID_ROLES = {"admin", "editor", "user", "parent"}

# 用户名同时用作聊天历史目录名（chat_history/<conf>/users/<username>/），
# 必须限制为文件系统安全字符，防路径穿越
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{2,32}$")


# ============== 密码哈希（scrypt，标准库） ==============

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"{salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$")
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(dk_hex)
    except ValueError:
        return False
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(dk, expected)


# ============== 用户存储 ==============

class UserStore:
    """users.json 读写；首次启动引导创建 admin 账号"""

    def __init__(self, users_file: Path = USERS_FILE):
        self.users_file = users_file
        # 结构：{username: {"password": hash, "role": "admin"|"editor", "created_at": ts}}
        self.users: dict = {}
        self._users_sig: tuple | None = None
        self._load_or_bootstrap()

    def _load_or_bootstrap(self) -> None:
        self.users_file.parent.mkdir(parents=True, exist_ok=True)
        if self.users_file.exists():
            try:
                self.users = json.loads(self.users_file.read_text(encoding="utf-8"))
                self._users_sig = self._file_signature()
                return
            except Exception as e:
                logger.error(f"读取用户文件失败，将重建：{e}")

        initial_password = secrets.token_urlsafe(12)
        self.users = {
            "admin": {
                "password": hash_password(initial_password),
                "role": "admin",
                # 初始密码是一次性随机串，首次登录必须改（2026-10-14）
                "must_change_password": True,
                "created_at": time.time(),
            }
        }
        self._save()
        INITIAL_PASSWORD_FILE.write_text(initial_password, encoding="utf-8")
        logger.warning(
            "已创建初始管理员账号 admin，密码写入 {}（请登录后尽快修改）",
            INITIAL_PASSWORD_FILE,
        )

    def _file_signature(self) -> tuple | None:
        """users.json 的跨进程变更信号（mtime_ns+size，比单 mtime 稳）"""
        try:
            st = self.users_file.stat()
            return (st.st_mtime_ns, st.st_size)
        except OSError:
            return None

    def _save(self) -> None:
        self.users_file.write_text(
            json.dumps(self.users, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        self._users_sig = self._file_signature()

    def _refresh_if_changed(self) -> None:
        """多进程部署（uvicorn --workers 3）下每 worker 一份内存快照：后台在
        另一 worker 改账号/删号时，本 worker 不重读就会"删掉的号还能登录"。
        以 users.json 签名变化为跨进程信号。注意刷新走安全重载而非 _load_or_bootstrap：
        读到半截文件时保留内存态，绝不落入"重建 admin"分支把全部账号洗掉。"""
        sig = self._file_signature()
        if self._users_sig is not None and sig is not None and sig != self._users_sig:
            try:
                data = json.loads(self.users_file.read_text(encoding="utf-8"))
                if isinstance(data, dict) and data:
                    self.users = data
                    self._users_sig = sig
            except Exception as e:
                logger.warning(f"users.json 重读失败，保留内存态稍后再试：{e}")

    def authenticate(self, username: str, password: str) -> dict | None:
        self._refresh_if_changed()
        record = self.users.get(username)
        if record and verify_password(password, record["password"]):
            # must_change_password：首次登录/被重置后强制改密（存量账号无此字段=False，
            # 2026-10-14 起新建与重置都会打上标记）
            return {
                "username": username,
                "role": record["role"],
                "must_change_password": bool(record.get("must_change_password", False)),
            }
        return None

    def create_user(self, username: str, password: str, role: str, group: str = "") -> dict:
        self._refresh_if_changed()
        if username in self.users:
            raise ValueError(f"用户已存在：{username}")
        if not USERNAME_PATTERN.match(username):
            raise ValueError("用户名需为 2-32 位字母、数字、下划线或短横线")
        if role not in VALID_ROLES:
            raise ValueError(f"无效角色：{role}（可选 {sorted(VALID_ROLES)}）")
        self.users[username] = {
            "password": hash_password(password),
            "role": role,
            "group": (group or "").strip()[:32],
            # 初始密码（含批量导入自动生成）视为临时凭据，首次登录强制修改
            "must_change_password": True,
            "created_at": time.time(),
        }
        self._save()
        logger.info(f"创建用户 {username}（{role}，分组：{(group or '').strip()[:32] or '无'}）")
        return {"username": username, "role": role}

    def delete_user(self, username: str) -> None:
        self._refresh_if_changed()
        if username not in self.users:
            raise ValueError(f"用户不存在：{username}")
        admins = [u for u, r in self.users.items() if r["role"] == "admin"]
        if self.users[username]["role"] == "admin" and len(admins) <= 1:
            raise ValueError("不能删除最后一个管理员")
        del self.users[username]
        self._save()
        logger.info(f"删除用户 {username}")

    def change_password(self, username: str, new_password: str,
                        must_change: bool = False) -> None:
        """改密码。pv（密码版本）自增使该账号已签发令牌立即失效（重置/改密即踢旧会话）；
        must_change 控制下次登录是否强制改密：自助改密=False（清除），
        管理员重置=True（2026-10-14 首次登录必须改密）。"""
        self._refresh_if_changed()
        if username not in self.users:
            raise ValueError(f"用户不存在：{username}")
        record = self.users[username]
        record["password"] = hash_password(new_password)
        record["pv"] = record.get("pv", 0) + 1
        record["must_change_password"] = must_change
        self._save()
        logger.info(f"用户 {username} 密码已修改（pv={record['pv']}，"
                    f"下次登录强制改密={must_change}）")

    def list_users(self) -> list:
        self._refresh_if_changed()
        return [
            {"username": u, "role": r["role"], "group": r.get("group", ""),
             "must_change_password": bool(r.get("must_change_password", False)),
             "created_at": r["created_at"]}
            for u, r in self.users.items()
        ]


_user_store: UserStore | None = None


def get_user_store() -> UserStore:
    global _user_store
    if _user_store is None:
        _user_store = UserStore()
    return _user_store


# ============== 令牌（HMAC 签名） ==============

class TokenManager:
    def __init__(self, secret: bytes | None = None):
        self.secret = secret or self._load_or_create_secret()

    def _load_or_create_secret(self) -> bytes:
        secret_file = AUTH_DIR / "token_secret.key"
        if secret_file.exists():
            return secret_file.read_bytes()
        secret_file.parent.mkdir(parents=True, exist_ok=True)
        secret = secrets.token_bytes(32)
        secret_file.write_bytes(secret)
        return secret

    def issue(self, username: str, role: str) -> str:
        # pv=密码版本：签发时带上，verify 时与用户记录比对——改密/重置后旧令牌立即失效
        record = get_user_store().users.get(username) or {}
        payload = json.dumps(
            {"username": username, "role": role,
             "pv": record.get("pv", 0), "exp": int(time.time()) + TOKEN_TTL_SECONDS}
        ).encode("utf-8")
        body = base64.urlsafe_b64encode(payload)
        sig = hmac.new(self.secret, body, hashlib.sha256).digest()
        return f"{body.decode()}.{base64.urlsafe_b64encode(sig).decode()}"

    def verify(self, token: str) -> dict | None:
        try:
            body_b64, sig_b64 = token.split(".")
            body = body_b64.encode("ascii")
            expected = hmac.new(self.secret, body, hashlib.sha256).digest()
            if not hmac.compare_digest(expected, base64.urlsafe_b64decode(sig_b64)):
                return None
            payload = json.loads(base64.urlsafe_b64decode(body))
            if payload.get("exp", 0) < time.time():
                return None
            # 密码版本一致性（2026-10-14）：改密/重置后旧令牌即失效。存量令牌与存量
            # 账号都没有 pv → 双方按 0 比 → 匹配，部署不影响现有登录。
            # 比对前先刷新用户快照：重置发生在另一 worker 时，本 worker 不重读
            # users.json 会拿旧 pv 误杀新令牌（多进程部署，与 UserStore 同一信号）。
            store = get_user_store()
            store._refresh_if_changed()
            record = store.users.get(payload.get("username")) or {}
            if payload.get("pv", 0) != record.get("pv", 0):
                return None
            return payload
        except Exception:
            return None


_token_manager: TokenManager | None = None


def get_token_manager() -> TokenManager:
    global _token_manager
    if _token_manager is None:
        _token_manager = TokenManager()
    return _token_manager


# ============== FastAPI 依赖 ==============

def _extract_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    payload = get_token_manager().verify(auth_header[7:])
    if payload is None:
        raise HTTPException(status_code=401, detail="登录已过期或令牌无效")
    return {"username": payload["username"], "role": payload["role"]}


async def require_user(request: Request) -> dict:
    """要求登录（admin / editor / user 任意角色）"""
    return _extract_user(request)


async def require_staff(user: dict = Depends(require_user)) -> dict:
    """知识库管理接口要求后台角色（admin=最高权限管理员 或 editor=数据管理员），
    普通使用者（user=学生 / parent=家长）不可用"""
    if user["role"] not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="需要后台管理权限")
    return user


def ensure_can_modify(user: dict, entry) -> None:
    """数据管理员（editor）只能修改/删除本账号上传的条目；admin 不受限。
    历史遗留的无属主条目（created_by=None）同样仅 admin 可动。"""
    if user["role"] == "admin":
        return
    if getattr(entry, "created_by", None) != user["username"]:
        raise HTTPException(
            status_code=403,
            detail="数据管理员仅能修改/删除本账号上传的数据",
        )


async def require_admin(user: dict = Depends(require_user)) -> dict:
    """用户管理接口仅 admin"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


# ============== 认证路由 ==============

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(..., pattern="^(admin|editor|user|parent)$")
    group: str = Field("", max_length=32)


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


def init_auth_routes() -> APIRouter:
    router = APIRouter(prefix="/api/auth", tags=["auth"])

    @router.post("/login")
    async def login(request: LoginRequest):
        user = get_user_store().authenticate(request.username, request.password)
        if user is None:
            raise HTTPException(status_code=401, detail="用户名或密码错误")
        token = get_token_manager().issue(user["username"], user["role"])
        logger.info(f"用户登录成功：{user['username']}（{user['role']}）")
        return {"token": token, "user": user}

    @router.get("/me")
    async def whoami(user: dict = Depends(require_user)):
        return user

    @router.get("/users")
    async def list_users(_admin: dict = Depends(require_admin)):
        return {"users": get_user_store().list_users()}

    @router.post("/users")
    async def create_user(req: CreateUserRequest, _admin: dict = Depends(require_admin)):
        try:
            created = get_user_store().create_user(req.username, req.password, req.role, req.group)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"user": created}

    # ---- 账号批量导入/导出（2026-10-06）：CSV 表格，方便学校批量建号 ----
    #
    # 导入列：用户名,密码,角色,分组（表头中文；角色接受中文或英文键；密码留空
    # 则自动生成，明文只在本次响应的 created 里出现一次，供管理端下载回执）。
    # 已存在的账号跳过不覆盖；坏行逐条报错不中断。密码为 scrypt 哈希存储，
    # 导出接口只含 用户名/角色/分组/创建时间，不含密码（哈希不可逆）。

    IMPORT_HEADERS = ["用户名", "密码", "角色", "分组"]
    ROLE_CN_TO_KEY = {
        "学生": "user", "普通用户": "user", "user": "user",
        "家长": "parent", "parent": "parent",
        "数据管理员": "editor", "编辑者": "editor", "editor": "editor",
        "管理员": "admin", "最高权限管理员": "admin", "admin": "admin",
    }

    @router.post("/users/import")
    async def import_users(file: UploadFile = FastFile(...), _admin: dict = Depends(require_admin)):
        raw = await file.read()
        if len(raw) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="文件过大（>2MB），请分批导入")
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = raw.decode("gbk")  # Excel 中文环境「另存为 CSV」常见编码
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="文件编码不支持：请用 UTF-8 或重新另存为 CSV")
        reader = csv.DictReader(io.StringIO(text))
        headers = [h.strip() for h in (reader.fieldnames or [])]
        if not headers or "用户名" not in headers or "角色" not in headers:
            raise HTTPException(status_code=400,
                                detail="表头需包含「用户名」和「角色」列：用户名,密码,角色,分组（可先下载模板）")
        store = get_user_store()
        created: list = []
        skipped: list = []
        errors: list = []
        for idx, row in enumerate(reader, start=2):
            username = (row.get("用户名") or "").strip()
            password = (row.get("密码") or "").strip()
            role_raw = (row.get("角色") or "").strip()
            group = (row.get("分组") or "").strip()[:32]
            if not username and not password and not role_raw:
                continue  # 空行
            role = role_raw if role_raw in VALID_ROLES else ROLE_CN_TO_KEY.get(role_raw, "")
            if not role:
                errors.append({"line": idx, "username": username,
                               "error": f"角色无法识别：{role_raw or '(空)'}（可用：学生/家长/数据管理员/管理员）"})
                continue
            if not password:
                password = secrets.token_urlsafe(9)
            try:
                store.create_user(username, password, role, group)
            except ValueError as e:
                if "已存在" in str(e):
                    skipped.append({"line": idx, "username": username, "reason": "已存在，未改动"})
                else:
                    errors.append({"line": idx, "username": username, "error": str(e)})
                continue
            created.append({"username": username, "password": password,
                            "role": role, "group": group})
            if len(created) + len(skipped) + len(errors) >= 2000:
                errors.append({"line": idx + 1, "username": "", "error": "已达单次导入上限 2000 行，其余未处理"})
                break
        logger.info(f"账号批量导入：新建 {len(created)} / 跳过 {len(skipped)} / 错误 {len(errors)}")
        return {"created": created, "skipped": skipped, "errors": errors}

    @router.get("/users/export")
    async def export_users(_admin: dict = Depends(require_admin)):
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["用户名", "角色", "分组", "创建时间"])
        users = sorted(get_user_store().list_users(), key=lambda x: x["username"])
        for u in users:
            created = datetime.fromtimestamp(u["created_at"]).strftime("%Y-%m-%d %H:%M") \
                if u.get("created_at") else ""
            writer.writerow([u["username"], u["role"], u.get("group", ""), created])
        # BOM 让 Excel 直接打开不乱码
        return Response(
            content="﻿" + buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=accounts.csv"})

    @router.delete("/users/{username}")
    async def delete_user(username: str, admin: dict = Depends(require_admin)):
        try:
            get_user_store().delete_user(username)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"message": f"用户 {username} 已删除"}

    # ---- 管理员重置任意账号密码（2026-10-14）：替代"删号重建"的改密方式 ----
    # 重置后该账号旧令牌立即失效（pv），且下次登录强制改密（must_change_password）。
    # 允许 admin 给自己重置（即管理员修改自己的密码）。
    @router.post("/users/{username}/password")
    async def reset_password(username: str, req: ResetPasswordRequest,
                             _admin: dict = Depends(require_admin)):
        try:
            get_user_store().change_password(username, req.new_password, must_change=True)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"message": f"用户 {username} 的密码已重置，下次登录须先修改密码"}

    @router.post("/change-password")
    async def change_password(req: ChangePasswordRequest, user: dict = Depends(require_user)):
        # 自助改密：清除强制改密标记（首次登录/被重置后走这里完成改密）
        get_user_store().change_password(user["username"], req.new_password, must_change=False)
        return {"message": "密码已修改"}

    return router
