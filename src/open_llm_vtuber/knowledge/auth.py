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
import hashlib
import hmac
import json
import re
import secrets
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from pydantic import BaseModel, Field

# data/auth 固定在仓库根目录下（与运行时工作目录解耦）
AUTH_DIR = Path(__file__).resolve().parents[3] / "data" / "auth"
USERS_FILE = AUTH_DIR / "users.json"
INITIAL_PASSWORD_FILE = AUTH_DIR / "initial_admin_password.txt"

TOKEN_TTL_SECONDS = 12 * 3600
VALID_ROLES = {"admin", "editor", "user"}

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
        self._load_or_bootstrap()

    def _load_or_bootstrap(self) -> None:
        self.users_file.parent.mkdir(parents=True, exist_ok=True)
        if self.users_file.exists():
            try:
                self.users = json.loads(self.users_file.read_text(encoding="utf-8"))
                return
            except Exception as e:
                logger.error(f"读取用户文件失败，将重建：{e}")

        initial_password = secrets.token_urlsafe(12)
        self.users = {
            "admin": {
                "password": hash_password(initial_password),
                "role": "admin",
                "created_at": time.time(),
            }
        }
        self._save()
        INITIAL_PASSWORD_FILE.write_text(initial_password, encoding="utf-8")
        logger.warning(
            "已创建初始管理员账号 admin，密码写入 {}（请登录后尽快修改）",
            INITIAL_PASSWORD_FILE,
        )

    def _save(self) -> None:
        self.users_file.write_text(
            json.dumps(self.users, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def authenticate(self, username: str, password: str) -> dict | None:
        record = self.users.get(username)
        if record and verify_password(password, record["password"]):
            return {"username": username, "role": record["role"]}
        return None

    def create_user(self, username: str, password: str, role: str) -> dict:
        if username in self.users:
            raise ValueError(f"用户已存在：{username}")
        if not USERNAME_PATTERN.match(username):
            raise ValueError("用户名需为 2-32 位字母、数字、下划线或短横线")
        if role not in VALID_ROLES:
            raise ValueError(f"无效角色：{role}（可选 {sorted(VALID_ROLES)}）")
        self.users[username] = {
            "password": hash_password(password),
            "role": role,
            "created_at": time.time(),
        }
        self._save()
        logger.info(f"创建用户 {username}（{role}）")
        return {"username": username, "role": role}

    def delete_user(self, username: str) -> None:
        if username not in self.users:
            raise ValueError(f"用户不存在：{username}")
        admins = [u for u, r in self.users.items() if r["role"] == "admin"]
        if self.users[username]["role"] == "admin" and len(admins) <= 1:
            raise ValueError("不能删除最后一个管理员")
        del self.users[username]
        self._save()
        logger.info(f"删除用户 {username}")

    def change_password(self, username: str, new_password: str) -> None:
        if username not in self.users:
            raise ValueError(f"用户不存在：{username}")
        self.users[username]["password"] = hash_password(new_password)
        self._save()
        logger.info(f"用户 {username} 已修改密码")

    def list_users(self) -> list:
        return [
            {"username": u, "role": r["role"], "created_at": r["created_at"]}
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
        payload = json.dumps(
            {"username": username, "role": role, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
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
    """知识库管理接口要求后台角色（admin 或 editor），普通 App 用户（user）不可用"""
    if user["role"] not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="需要后台管理权限")
    return user


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
    role: str = Field(..., pattern="^(admin|editor|user)$")


class ChangePasswordRequest(BaseModel):
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
            created = get_user_store().create_user(req.username, req.password, req.role)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"user": created}

    @router.delete("/users/{username}")
    async def delete_user(username: str, admin: dict = Depends(require_admin)):
        try:
            get_user_store().delete_user(username)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"message": f"用户 {username} 已删除"}

    @router.post("/change-password")
    async def change_password(req: ChangePasswordRequest, user: dict = Depends(require_user)):
        get_user_store().change_password(user["username"], req.new_password)
        return {"message": "密码已修改"}

    return router
