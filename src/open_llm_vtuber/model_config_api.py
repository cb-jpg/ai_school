"""
模型接口（LLM API）管理 API —— 让学校在校方后台自助切换对话模型接口。

- GET  /api/model/config       读取当前生效的接口配置（key 只回掩码）
- PUT  /api/model/config       校验 → 备份并写入 conf.yaml（ruamel round-trip
                               保留注释与格式）→ 热重建 default_context_cache
                               的 agent，新会话生效，进行中的会话不受影响
- POST /api/model/config/test  用给定（或已存）配置发一次极小补全请求，测连通性

生效语义与角色配置 API 相同：重建后**新建立**的 WebSocket 会话使用新接口；
已建立的会话继续用旧配置直到断开。

跨 worker 同步（uvicorn --workers 3，各 worker 一份 default_context_cache 内存态）：
以 conf.yaml 签名（mtime_ns+size，同 UserStore 手法）为信号，新会话建立时
maybe_reload_default_context 懒重载——管理接口只落到其中一个 worker，
其余 worker 在下一个新会话到来时自动对齐（同时覆盖人设 PUT 的同类陈旧问题）。
"""

import asyncio
import os
import shutil
import time
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field
from ruamel.yaml import YAML

from .character_config_api import BACKUP_PATH, CONF_PATH
from .config_manager.agent import AgentConfig
from .config_manager.utils import read_yaml
from .knowledge.auth import get_user_store, require_admin
from .service_context import ServiceContext

# 两类接口的默认地址：DeepSeek 官方有固定端点；OpenAI 兼容接口必填地址
DEFAULT_BASE_URLS: dict[str, str | None] = {
    "deepseek_llm": "https://api.deepseek.com/v1",
    "openai_compatible_llm": None,
}

# 一体机/大屏内置账号（匿名体验入口）：按访客称呼，不按账号角色
_KIOSK_USERNAMES = {
    u.strip()
    for u in os.environ.get("OLLV_KIOSK_USERNAMES", "kiosk").split(",")
    if u.strip()
}


class ModelConfigPayload(BaseModel):
    provider: Literal["deepseek_llm", "openai_compatible_llm"] = Field(
        ..., description="接口类型"
    )
    base_url: str = Field("", max_length=300, description="接口地址；留空用默认")
    model: str = Field(..., min_length=1, max_length=120, description="模型名称")
    # 留空 = 保留已存密钥（换模型/地址不必重输密钥）；密钥任何情况下不回显
    llm_api_key: str = Field("", max_length=300)
    temperature: float = Field(1.0, ge=0.0, le=2.0)


def mask_api_key(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 8:
        return "已设置"
    return f"{key[:3]}****{key[-4:]}"


# ============== conf.yaml 持久化（ruamel round-trip，备份后写） ==============


def _persist_model_config(payload: ModelConfigPayload) -> None:
    yaml = YAML()
    yaml.preserve_quotes = True

    text = CONF_PATH.read_text(encoding="utf-8")
    data = yaml.load(text)
    try:
        agent = data["character_config"]["agent_config"]
    except (KeyError, TypeError):
        raise ValueError("conf.yaml 中未找到 character_config.agent_config 节")

    # 写当前 provider 指向 + 对应接口节；密钥留空不覆盖（保持旧值）
    agent["agent_settings"]["basic_memory_agent"]["llm_provider"] = payload.provider
    sections = agent.get("llm_configs")
    if sections is None or not isinstance(sections, dict):
        raise ValueError("conf.yaml 中未找到 llm_configs 节")
    section = sections.get(payload.provider)
    if section is None:
        sections[payload.provider] = {}
        section = sections[payload.provider]
    base_url = payload.base_url.strip() or DEFAULT_BASE_URLS.get(payload.provider)
    if not base_url:
        raise ValueError("OpenAI 兼容接口必须填写接口地址")
    section["base_url"] = base_url
    section["model"] = payload.model.strip()
    section["temperature"] = payload.temperature
    if payload.llm_api_key.strip():
        section["llm_api_key"] = payload.llm_api_key.strip()

    shutil.copy2(CONF_PATH, BACKUP_PATH)
    with CONF_PATH.open("w", encoding="utf-8") as f:
        yaml.dump(data, f)
    logger.info(
        f"模型接口配置已写入 {CONF_PATH}（provider={payload.provider}，"
        f"model={payload.model}，已备份至 {BACKUP_PATH}）"
    )


async def apply_model_config(cache: ServiceContext, payload: ModelConfigPayload) -> None:
    """把 payload 应用到 default_context_cache 的 agent_config 并重建 agent。
    仅改内存（配合 _persist_model_config 使用），失败抛异常由调用方转 500。"""
    cc = cache.character_config
    agent_config = cc.agent_config
    if agent_config is None:
        raise RuntimeError("Agent 尚未完成初始化")

    new_agent_config = agent_config.model_copy(deep=True)
    new_agent_config.agent_settings.basic_memory_agent.llm_provider = payload.provider
    section = getattr(new_agent_config.llm_configs, payload.provider, None)
    if section is None:
        raise RuntimeError(f"运行时配置中不存在 {payload.provider} 接口节，请重启服务后再试")
    if payload.provider == "openai_compatible_llm" or payload.base_url.strip():
        section.base_url = payload.base_url.strip() or DEFAULT_BASE_URLS[payload.provider]
    section.model = payload.model.strip()
    section.temperature = payload.temperature
    if payload.llm_api_key.strip():
        section.llm_api_key = payload.llm_api_key.strip()

    await cache.init_agent(new_agent_config, cc.persona_prompt)


# ============== 跨 worker 懒重载（conf.yaml 签名信号） ==============

_conf_lock = asyncio.Lock()
_seen_conf_sig: tuple | None = None


def conf_signature() -> tuple | None:
    try:
        st = CONF_PATH.stat()
        return (st.st_mtime_ns, st.st_size)
    except OSError:
        return None


def mark_conf_seen() -> None:
    """worker 启动加载 conf.yaml 完成后对齐签名（此后才响应外部变更）。"""
    global _seen_conf_sig
    _seen_conf_sig = conf_signature()


async def maybe_reload_default_context(cache: ServiceContext) -> None:
    """新会话建立时调用：conf.yaml 被其它 worker 改过 → 热重载人设+LLM 配置。"""
    global _seen_conf_sig
    sig = conf_signature()
    if sig is None:
        return
    if _seen_conf_sig is None:
        _seen_conf_sig = sig  # 未对齐过（如测试环境）：先对齐启动态
        return
    if sig == _seen_conf_sig:
        return
    async with _conf_lock:
        sig = conf_signature()  # double-check：锁内再取，防读到半截写
        if sig is None or sig == _seen_conf_sig:
            return
        try:
            raw = (read_yaml(str(CONF_PATH)).get("character_config") or {}).copy()
            agent_config = AgentConfig(**(raw.get("agent_config") or {}))
            persona = raw.get("persona_prompt")
            if not persona:
                raise ValueError("conf.yaml 缺少 persona_prompt")
            await cache.init_agent(agent_config, persona)
            cc = cache.character_config
            cc.character_name = raw.get("character_name", cc.character_name)
            cc.persona_prompt = persona
            _seen_conf_sig = sig
            logger.info("检测到 conf.yaml 变更，已热重载人设与 LLM 配置（跨 worker 同步）")
        except Exception as e:
            logger.error(f"conf.yaml 热重载失败，保留当前配置：{e}")
            _seen_conf_sig = sig  # 更新到已见，避免半截文件反复触发；后续新变更仍会触发


# ============== 会话级称呼段（按登录账号角色） ==============


def addressing_kind(username: str | None) -> str:
    if username is None:
        return "guest"
    if username in _KIOSK_USERNAMES:
        return "kiosk"
    record = get_user_store().users.get(username)
    if record is None:
        return "guest"
    role = record.get("role")
    if role in ("admin", "editor"):
        return "staff"
    if role == "parent":
        return "parent"
    return "student"


_ADDRESSING_TEXTS = {
    "guest": (
        "\n\n【当前对话对象】未登录访客（可能是到校参观或线上体验的家长/学生）。"
        "用「你」作中性称呼，亲切自然；不要询问或诱导对方透露姓名、电话等个人信息；"
        "涉及需要登录才能使用的功能时，友好说明可以先登录账号。"
    ),
    "kiosk": (
        "\n\n【当前对话对象】大屏一体机前的到访者（未实名）。用「你」作中性称呼，"
        "亲切自然、落落大方；不要询问或诱导对方透露个人信息；优先介绍学校概况、"
        "办学特色与招生咨询等来访关心的话题。"
    ),
    "staff": (
        "\n\n【当前对话对象】学校教职工（后台账号）。称呼用「老师」，不要直呼其名；"
        "互动方式：专业、简洁、直给，可以直接使用教育术语。"
    ),
    "parent": (
        "\n\n【当前对话对象】学生家长。称呼用「家长」（如「家长您好」）；"
        "互动方式：热情周到，优先围绕招生咨询、孩子在校学习生活类需求；"
        "不越权透露其他学生的个人信息。"
    ),
    "student": (
        "\n\n【当前对话对象】在校学生。称呼用「同学」（如「这位同学」）；"
        "互动方式：亲切、有鼓励性，解释通俗、多用具体例子，语气积极向上。"
    ),
}


def user_addressing_segment(username: str | None) -> str:
    """按登录账号角色生成会话级称呼/互动方式提示段（注入 system_prompt 尾部）。
    与 conf.yaml persona 中的教职工「老师」称谓硬规则同向，不冲突。"""
    return _ADDRESSING_TEXTS[addressing_kind(username)]


# ============== 路由 ==============


def init_model_config_routes(default_context_cache: ServiceContext) -> APIRouter:
    router = APIRouter(prefix="/api/model", tags=["model-config"])

    def _live_section(provider: str):
        cc = default_context_cache.character_config
        agent_config = cc.agent_config if cc else None
        if agent_config is None:
            raise HTTPException(status_code=503, detail="服务尚未完成初始化")
        return getattr(agent_config.llm_configs, provider, None)

    @router.get("/config")
    async def get_model_config(_admin: dict = Depends(require_admin)):
        cc = default_context_cache.character_config
        if cc is None or cc.agent_config is None:
            raise HTTPException(status_code=503, detail="服务尚未完成初始化")
        provider = cc.agent_config.agent_settings.basic_memory_agent.llm_provider
        section = _live_section(provider)
        if section is None:
            return {
                "provider": provider,
                "base_url": None,
                "model": None,
                "temperature": None,
                "api_key_masked": None,
            }
        return {
            "provider": provider,
            "base_url": getattr(section, "base_url", None),
            "model": section.model,
            "temperature": section.temperature,
            "api_key_masked": mask_api_key(getattr(section, "llm_api_key", None)),
        }

    @router.put("/config")
    async def update_model_config(
        payload: ModelConfigPayload, _admin: dict = Depends(require_admin)
    ):
        base_url = payload.base_url.strip() or DEFAULT_BASE_URLS.get(payload.provider)
        if not base_url:
            raise HTTPException(status_code=400, detail="OpenAI 兼容接口必须填写接口地址")
        try:
            _persist_model_config(payload)
        except Exception as e:
            logger.error(f"写入 conf.yaml 失败：{e}")
            raise HTTPException(status_code=500, detail=f"配置持久化失败：{e}")

        try:
            await apply_model_config(default_context_cache, payload)
            mark_conf_seen()  # 本 worker 已应用，避免下次连接重复重载
        except Exception as e:
            logger.error(f"模型接口热更新失败：{e}")
            raise HTTPException(status_code=500, detail=f"接口热更新失败：{e}")

        return {
            "message": "已保存并生效；新的对话将使用新接口，进行中的对话保持原接口",
            "provider": payload.provider,
            "model": payload.model,
        }

    @router.post("/config/test")
    async def test_model_config(
        payload: ModelConfigPayload, _admin: dict = Depends(require_admin)
    ):
        base_url = payload.base_url.strip() or DEFAULT_BASE_URLS.get(payload.provider)
        if not base_url:
            raise HTTPException(status_code=400, detail="OpenAI 兼容接口必须填写接口地址")
        api_key = payload.llm_api_key.strip()
        if not api_key:
            # 留空回落已存密钥（测当前配置连通性）
            section = _live_section(payload.provider)
            api_key = getattr(section, "llm_api_key", "") if section else ""
        if not api_key:
            raise HTTPException(status_code=400, detail="尚未配置 API 密钥")

        body = {
            "model": payload.model,
            "messages": [{"role": "user", "content": "请回复四个字：连接成功"}],
            "max_tokens": 16,
            "stream": False,
        }
        headers = {"Authorization": f"Bearer {api_key}"}
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{base_url.rstrip('/')}/chat/completions",
                    json=body,
                    headers=headers,
                )
        except httpx.HTTPError as e:
            # 只记异常类型不记请求体，密钥不落日志
            logger.warning(f"模型接口测试失败（{type(e).__name__}）")
            return {
                "ok": False,
                "latency_ms": int((time.monotonic() - t0) * 1000),
                "model": payload.model,
                "error": f"无法连接接口：{type(e).__name__}",
            }
        latency = int((time.monotonic() - t0) * 1000)
        if resp.status_code != 200:
            detail = ""
            try:
                data = resp.json()
                detail = (data.get("error") or {}).get("message") or str(data)[:200]
            except ValueError:
                detail = resp.text[:200]
            return {
                "ok": False,
                "status": resp.status_code,
                "latency_ms": latency,
                "model": payload.model,
                "error": f"接口返回 {resp.status_code}：{detail}",
            }
        reply = ""
        try:
            reply = resp.json()["choices"][0]["message"]["content"] or ""
        except (ValueError, KeyError, IndexError, TypeError):
            pass  # 200 但结构非预期：连通性已证，回复样例可缺
        return {
            "ok": True,
            "status": 200,
            "latency_ms": latency,
            "model": payload.model,
            "reply_sample": reply.strip()[:80] or None,
            "error": None,
        }

    return router
