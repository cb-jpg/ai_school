import os
import json
from uuid import uuid4
import numpy as np
from datetime import datetime
from fastapi import APIRouter, WebSocket, UploadFile, File, Response
from starlette.responses import JSONResponse
from starlette.websockets import WebSocketDisconnect
from loguru import logger
from .service_context import ServiceContext
from .websocket_handler import WebSocketHandler
from .proxy_handler import ProxyHandler
from .asr.audio_preprocessor import (
    is_plausible_chinese_transcript,
    prepare_browser_audio,
)
from verification.asr_config import build_asr_config, public_browser_config
from .knowledge.routes import init_knowledge_routes
from .knowledge.auth import USERNAME_PATTERN, get_token_manager


def _load_model_dict(path: str = "model_dict.json") -> dict:
    """读取 model_dict.json，返回 {模型名: 条目}；文件缺失或损坏时返回空 dict。"""
    try:
        with open(path, encoding="utf-8-sig") as f:
            entries = json.load(f)
        return {
            entry["name"]: entry
            for entry in entries
            if isinstance(entry, dict) and "name" in entry
        }
    except Exception as e:
        logger.warning(f"读取 {path} 失败，模型列表将不含描述与动作参数：{e}")
        return {}


def _find_model3_file(folder_path: str) -> "str | None":
    """
    在 Live2D 模型目录中定位 .model3.json（返回相对仓库根、以 / 分隔的路径）。
    先查 runtime/ 子目录，再查模型根目录；不要求文件名与文件夹名一致。
    """
    runtime_dir = os.path.join(folder_path, "runtime")

    def _list_model3(directory: str) -> list:
        if not os.path.isdir(directory):
            return []
        return sorted(f for f in os.listdir(directory) if f.endswith(".model3.json"))

    for directory in (runtime_dir, folder_path):
        files = _list_model3(directory)
        if files:
            return os.path.join(directory, files[0]).replace("\\", "/")
    return None


def init_client_ws_route(default_context_cache: ServiceContext) -> APIRouter:
    """
    Create and return API routes for handling the `/client-ws` WebSocket connections.

    Args:
        default_context_cache: Default service context cache for new sessions.

    Returns:
        APIRouter: Configured router with WebSocket endpoint.
    """

    router = APIRouter()
    ws_handler = WebSocketHandler(default_context_cache)

    @router.websocket("/client-ws")
    async def websocket_endpoint(websocket: WebSocket):
        """WebSocket endpoint for client connections"""
        # 握手阶段验证用户身份（App 登录后的 JWT）。
        # - 无 user_token：匿名/旧客户端，聊天历史走共享目录（旧行为）
        # - user_token 无效或过期：拒绝连接（不静默降级，防止串到他人历史）
        user_token = websocket.query_params.get("user_token")
        username: str | None = None
        if user_token:
            payload = get_token_manager().verify(user_token)
            candidate = str(payload.get("username") or "") if payload else ""
            if not payload or not USERNAME_PATTERN.match(candidate):
                logger.warning("Rejected /client-ws: invalid or expired user_token")
                await websocket.close(code=1008)
                return
            username = candidate

        await websocket.accept()
        client_uid = str(uuid4())

        try:
            await ws_handler.handle_new_connection(websocket, client_uid, username=username)
            await ws_handler.handle_websocket_communication(websocket, client_uid)
        except WebSocketDisconnect:
            await ws_handler.handle_disconnect(client_uid)
        except Exception as e:
            logger.error(f"Error in WebSocket connection: {e}")
            await ws_handler.handle_disconnect(client_uid)
            raise

    return router


def init_proxy_route(server_url: str) -> APIRouter:
    """
    Create and return API routes for handling proxy connections.

    Args:
        server_url: The WebSocket URL of the actual server

    Returns:
        APIRouter: Configured router with proxy WebSocket endpoint
    """
    router = APIRouter()
    proxy_handler = ProxyHandler(server_url)

    @router.websocket("/proxy-ws")
    async def proxy_endpoint(websocket: WebSocket):
        """WebSocket endpoint for proxy connections"""
        try:
            await proxy_handler.handle_client_connection(websocket)
        except Exception as e:
            logger.error(f"Error in proxy connection: {e}")
            raise

    return router


def init_webtool_routes(default_context_cache: ServiceContext) -> APIRouter:
    """
    Create and return API routes for handling web tool interactions.

    Args:
        default_context_cache: Default service context cache for new sessions.

    Returns:
        APIRouter: Configured router with WebSocket endpoint.
    """

    router = APIRouter()

    @router.get("/health")
    async def health():
        """Minimal non-sensitive liveness/readiness endpoint for scripts."""
        ready = bool(
            default_context_cache.asr_engine
            and default_context_cache.tts_engine
            and default_context_cache.agent_engine
        )
        return {
            "status": "ok" if ready else "starting",
            "ready": ready,
            "version": "v1.2.1",
        }

    @router.get("/verification/config")
    async def verification_config():
        """Expose only browser-safe ASR settings; never expose LLM credentials."""
        env = os.environ
        config = build_asr_config(dict(env))
        return public_browser_config(config)

    @router.get("/web-tool")
    async def web_tool_redirect():
        """Redirect /web-tool to /web_tool/index.html"""
        return Response(status_code=302, headers={"Location": "/web-tool/index.html"})

    @router.get("/web_tool")
    async def web_tool_redirect_alt():
        """Redirect /web_tool to /web_tool/index.html"""
        return Response(status_code=302, headers={"Location": "/web-tool/index.html"})

    @router.get("/live2d-models/info")
    async def get_live2d_folder_info():
        """Get information about available Live2D models"""
        live2d_dir = "live2d-models"
        if not os.path.exists(live2d_dir):
            return JSONResponse(
                {"error": "Live2D models directory not found"}, status_code=404
            )

        # model_dict.json 提供展示名与各模型的动作/表情参数（emotionMap 等）
        model_dict = _load_model_dict("model_dict.json")

        valid_characters = []
        supported_extensions = [".png", ".jpg", ".jpeg"]
        preset_keys = {
            "kScale": "k_scale",
            "initialXshift": "initial_xshift",
            "initialYshift": "initial_yshift",
            "kXOffset": "k_x_offset",
            "idleMotionGroupName": "idle_motion_group_name",
            "emotionMap": "emotion_map",
            "tapMotions": "tap_motions",
        }

        for entry in os.scandir(live2d_dir):
            if entry.is_dir():
                folder_name = entry.name.replace("\\", "/")

                # 扫描 runtime 目录和模型根目录下的任意 *.model3.json，
                # 不再要求文件名与文件夹名一致（如 hiyori_pro_t11.model3.json）
                folder_path = os.path.join(live2d_dir, folder_name)
                model3_file = _find_model3_file(folder_path)

                if model3_file:
                    # Find avatar file if it exists (try both runtime and direct paths)
                    avatar_file = None
                    for ext in supported_extensions:
                        # Try runtime directory first
                        avatar_path = os.path.join(
                            live2d_dir, folder_name, "runtime", f"{folder_name}{ext}"
                        )
                        if os.path.isfile(avatar_path):
                            avatar_file = "/" + avatar_path.replace("\\", "/")
                            break

                        # If not found in runtime, try direct path
                        if not avatar_file:
                            avatar_path = os.path.join(
                                live2d_dir, folder_name, f"{folder_name}{ext}"
                            )
                            if os.path.isfile(avatar_path):
                                avatar_file = "/" + avatar_path.replace("\\", "/")
                                break

                    character = {
                        "name": folder_name,
                        "avatar": avatar_file,
                        # 统一带前导斜杠，前端可直接用作请求路径
                        "model_path": "/" + model3_file,
                    }

                    # 合并 model_dict.json 中该模型的描述与动作/表情参数
                    preset = model_dict.get(folder_name)
                    if preset:
                        if "description" in preset:
                            character["description"] = preset["description"]
                        for src_key, dst_key in preset_keys.items():
                            if src_key in preset:
                                character[dst_key] = preset[src_key]

                    valid_characters.append(character)
        return JSONResponse(
            {
                "type": "live2d-models/info",
                "count": len(valid_characters),
                "characters": valid_characters,
            }
        )

    @router.post("/asr")
    async def transcribe_audio(file: UploadFile = File(...)):
        """
        Endpoint for transcribing audio using the ASR engine
        """
        logger.info(f"Received audio file for transcription: {file.filename}")

        try:
            contents = await file.read()
            logger.info(
                "Received browser ASR upload: filename={} bytes={}",
                file.filename,
                len(contents),
            )

            # Validate minimum file size
            if len(contents) < 44:  # Minimum WAV header size
                raise ValueError("Invalid WAV file: File too small")

            # Decode the WAV header and get actual audio data
            wav_header_size = 44  # Standard WAV header size
            audio_data = contents[wav_header_size:]

            # Validate audio data size
            if len(audio_data) % 2 != 0:
                raise ValueError("Invalid audio data: Buffer size must be even")

            # Convert to 16-bit PCM samples to float32
            try:
                audio_array = (
                    np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
                    / 32768.0
                )
            except ValueError as e:
                raise ValueError(
                    f"Audio format error: {str(e)}. Please ensure the file is 16-bit PCM WAV format."
                )

            audio_array, audio_metrics = prepare_browser_audio(audio_array)
            logger.info(
                "Browser ASR audio: duration={duration:.2f}s rms={rms:.5f} "
                "peak={peak:.5f} gain={gain:.2f}".format(**audio_metrics)
            )

            text = await default_context_cache.asr_engine.async_transcribe_np(
                audio_array
            )
            asr_config = default_context_cache.character_config.asr_config
            sherpa_config = getattr(asr_config, "sherpa_onnx_asr", None)
            expected_language = getattr(sherpa_config, "language", "auto")
            if expected_language == "zh" and not is_plausible_chinese_transcript(text):
                logger.warning("Rejected non-Chinese SenseVoice result")
                return JSONResponse(
                    {
                        "error": "No clear Chinese speech detected",
                        "code": "unexpected-language",
                    },
                    status_code=422,
                )
            logger.info(f"Transcription result: {text}")
            return {"text": text}

        except ValueError as e:
            logger.error(f"Audio format error: {e}")
            return JSONResponse(
                content={"error": str(e), "code": "no-speech"},
                status_code=400,
            )
        except Exception as e:
            logger.error(f"Error during transcription: {e}")
            return Response(
                content=json.dumps(
                    {"error": "Internal server error during transcription"}
                ),
                status_code=500,
                media_type="application/json",
            )

    @router.websocket("/tts-ws")
    async def tts_endpoint(websocket: WebSocket):
        """WebSocket endpoint for TTS generation"""
        await websocket.accept()
        logger.info("TTS WebSocket connection established")

        try:
            while True:
                data = await websocket.receive_json()
                text = data.get("text")
                if not text:
                    continue

                logger.info(f"Received text for TTS: {text}")

                # Split text into sentences
                sentences = [s.strip() for s in text.split(".") if s.strip()]

                try:
                    # Generate and send audio for each sentence
                    for sentence in sentences:
                        sentence = sentence + "."  # Add back the period
                        file_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{str(uuid4())[:8]}"
                        audio_path = (
                            await default_context_cache.tts_engine.async_generate_audio(
                                text=sentence, file_name_no_ext=file_name
                            )
                        )
                        logger.info(
                            f"Generated audio for sentence: {sentence} at: {audio_path}"
                        )

                        await websocket.send_json(
                            {
                                "status": "partial",
                                "audioPath": audio_path,
                                "text": sentence,
                            }
                        )

                    # Send completion signal
                    await websocket.send_json({"status": "complete"})

                except Exception as e:
                    logger.error(f"Error generating TTS: {e}")
                    await websocket.send_json({"status": "error", "message": str(e)})

        except WebSocketDisconnect:
            logger.info("TTS WebSocket client disconnected")
        except Exception as e:
            logger.error(f"Error in TTS WebSocket connection: {e}")
            await websocket.close()

    return router


def init_knowledge_management_routes(knowledge_dir: str = "data/knowledge") -> APIRouter:
    """
    Create and return API routes for knowledge base management.

    Args:
        knowledge_dir: Directory for knowledge data storage.

    Returns:
        APIRouter: Configured router with knowledge endpoints.
    """
    return init_knowledge_routes(knowledge_dir)
