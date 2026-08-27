"""
角色配置管理 API —— 让前端编辑的角色名称/人设真正作用于 LLM。

此前前端的角色配置只写 localStorage，从未进入后端，persona/system prompt 对
LLM 实际提示词零影响。本模块提供：

- GET  /api/character/config  读取当前生效的人设（来自运行时 character_config）
- PUT  /api/character/config  校验 → 备份并写入 conf.yaml（ruamel round-trip
  保留注释与格式）→ 热更新 default_context_cache 并强制重建 agent engine

生效语义：重建后**新建立的** WebSocket 会话使用新人设；已建立的会话继续使用
旧提示词，直到断开重连。
"""

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field
from ruamel.yaml import YAML

from .knowledge.auth import require_user
from .service_context import ServiceContext

CONF_PATH = Path("conf.yaml")
BACKUP_PATH = Path("conf.yaml.backup")
PERSONA_MAX_LENGTH = 20000
NAME_MAX_LENGTH = 64


class CharacterConfigPayload(BaseModel):
    character_name: str = Field(..., min_length=1, max_length=NAME_MAX_LENGTH)
    persona_prompt: str = Field(..., min_length=1, max_length=PERSONA_MAX_LENGTH)


def _persist_to_conf_yaml(payload: CharacterConfigPayload) -> None:
    """用 ruamel round-trip 写回 conf.yaml，尽量保留原文件的注释与格式。"""
    yaml = YAML()
    yaml.preserve_quotes = True

    text = CONF_PATH.read_text(encoding="utf-8")
    data = yaml.load(text)
    if "character_config" not in data or not isinstance(data["character_config"], dict):
        raise ValueError("conf.yaml 中未找到 character_config 节")

    # 先备份当前文件（写失败可人工回滚），再落盘新内容
    shutil.copy2(CONF_PATH, BACKUP_PATH)
    conf = data["character_config"]
    conf["character_name"] = payload.character_name
    conf["persona_prompt"] = payload.persona_prompt
    with CONF_PATH.open("w", encoding="utf-8") as f:
        yaml.dump(data, f)
    logger.info(f"角色配置已写入 {CONF_PATH}（已备份至 {BACKUP_PATH}）")


def init_character_config_routes(
    default_context_cache: ServiceContext,
) -> APIRouter:
    router = APIRouter(prefix="/api/character", tags=["character"])

    @router.get("/config")
    async def get_character_config(_user: dict = Depends(require_user)):
        cc = default_context_cache.character_config
        if cc is None:
            raise HTTPException(status_code=503, detail="服务尚未完成初始化")
        return {
            "character_name": cc.character_name,
            "persona_prompt": cc.persona_prompt,
            "conf_name": cc.conf_name,
        }

    @router.put("/config")
    async def update_character_config(
        payload: CharacterConfigPayload, _user: dict = Depends(require_user)
    ):
        cc = default_context_cache.character_config
        if cc is None:
            raise HTTPException(status_code=503, detail="服务尚未完成初始化")

        agent_config = cc.agent_config
        if agent_config is None:
            raise HTTPException(status_code=503, detail="Agent 尚未完成初始化")

        try:
            _persist_to_conf_yaml(payload)
        except Exception as e:
            logger.error(f"写入 conf.yaml 失败：{e}")
            raise HTTPException(status_code=500, detail=f"配置持久化失败：{e}")

        try:
            # 先重建 agent（此时 character_config.persona_prompt 仍是旧值，
            # init_agent 的"配置未变则跳过"检查不会提前返回），再同步内存中的字段
            await default_context_cache.init_agent(agent_config, payload.persona_prompt)
            cc.character_name = payload.character_name
            cc.persona_prompt = payload.persona_prompt
        except Exception as e:
            logger.error(f"Agent 热更新失败：{e}")
            raise HTTPException(status_code=500, detail=f"人设热更新失败：{e}")

        return {
            "message": "已保存；新的对话将使用新人设，进行中的对话保持原设定",
            "character_name": payload.character_name,
            "system_prompt": default_context_cache.system_prompt,
        }

    return router
