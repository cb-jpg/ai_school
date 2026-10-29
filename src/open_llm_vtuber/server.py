"""
Open-LLM-VTuber Server
========================
This module contains the WebSocket server for Open-LLM-VTuber, which handles
the WebSocket connections, serves static files, and manages the web tool.
It uses FastAPI for the server and Starlette for static file serving.
"""

import os
import shutil
import hmac
from urllib.parse import parse_qs
from loguru import logger

from fastapi import FastAPI
from starlette.datastructures import Headers
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, Response
from starlette.staticfiles import StaticFiles as StarletteStaticFiles

from .routes import init_client_ws_route, init_webtool_routes, init_proxy_route, init_knowledge_management_routes
from .campus_routes import init_campus_topics_route
from .service_context import ServiceContext
from .config_manager.utils import Config


class AccessTokenMiddleware:
    """共享访问令牌门禁（用于公网裸奔场景的最低限度防护）。

    覆盖：所有 WebSocket 握手、全部 API 路由、/cache 音频。
    放开：SPA 壳与其 bundle（内部相对路径请求无法逐个携带 token）、
    /live2d-models、/bg、/avatars、/web-tool（惰性静态文件，无算力价值；
    Live2D 走 Cubism WebSDK 内部 XHR，无法透传 token）。

    令牌来源（任一即可）：?token= 查询参数 / X-Access-Token 头 / Bearer 头。
    """

    PUBLIC_PREFIXES = ("/assets/", "/live2d-models", "/bg", "/avatars", "/web-tool", "/libs",
                       "/app-releases", "/media/")
    PUBLIC_PATHS = ("/", "/favicon.ico", "/vite.svg", "/robots.txt")

    def __init__(self, app, access_token: str):
        self.app = app
        self.access_token = access_token

    def _is_public(self, scope) -> bool:
        if scope["type"] != "http":
            return False
        if scope.get("method") == "OPTIONS":  # CORS 预检
            return True
        path = scope.get("path", "")
        return path in self.PUBLIC_PATHS or path.startswith(self.PUBLIC_PREFIXES)

    def _has_valid_token(self, scope) -> bool:
        headers = Headers(scope=scope)
        candidates = [headers.get("x-access-token", "")]
        auth = headers.get("authorization", "")
        if auth.startswith("Bearer "):
            candidates.append(auth[7:])
        params = parse_qs(scope.get("query_string", b"").decode("utf-8", "ignore"))
        candidates.extend(params.get("token", []))
        return any(
            c and hmac.compare_digest(c, self.access_token) for c in candidates
        )

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)

        if self._is_public(scope) or self._has_valid_token(scope):
            return await self.app(scope, receive, send)

        if scope["type"] == "websocket":
            # 握手完成前直接拒绝（uvicorn 会回 403）
            await send({"type": "websocket.close", "code": 1008})
            return
        response = JSONResponse(
            {"error": "missing or invalid access token"}, status_code=401
        )
        await response(scope, receive, send)


# Create a custom StaticFiles class that adds CORS headers
class CORSStaticFiles(StarletteStaticFiles):
    """
    Static files handler that adds CORS headers to all responses.
    Needed because Starlette StaticFiles might bypass standard middleware.
    """

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)

        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"

        if path.endswith(".js"):
            response.headers["Content-Type"] = "application/javascript"

        # The frontend bundle uses content hashes, but index.html selects the
        # current hash. Never let Chrome keep an old index that points at a
        # stale ASR implementation after a rebuild.
        content_type = response.headers.get("Content-Type", "")
        if "text/html" in content_type or path.endswith(".html"):
            response.headers["Cache-Control"] = "no-store, max-age=0"
            response.headers["Pragma"] = "no-cache"

        return response


class AvatarStaticFiles(CORSStaticFiles):
    """
    Avatar files handler with security restrictions and CORS headers
    """

    async def get_response(self, path: str, scope):
        allowed_extensions = (".jpg", ".jpeg", ".png", ".gif", ".svg")
        if not any(path.lower().endswith(ext) for ext in allowed_extensions):
            return Response("Forbidden file type", status_code=403)
        response = await super().get_response(path, scope)
        return response


class RevalidateStaticFiles(CORSStaticFiles):
    """「就地更新」目录专用：live2d-models（exp3/贴图会被同 URL 覆盖）与
    app-releases（manifest.json 固定 URL 指向新版本）。

    无 Cache-Control 时 WebView 按启发式缓存（Last-Modified 年龄的 ~10%）
    长期复用旧文件——模型参数/OTA 清单更新后设备可能几天拿不到新版
    （2026-10-25 v2.44：手机端 joy.exp3.json 更新送达即受此威胁）。
    no-cache=强制 revalidate，etag 未变仍回 304，代价可忽略。
    """

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


class WebSocketServer:
    """
    API server for Open-LLM-VTuber. This contains the websocket endpoint for the client, hosts the web tool, and serves static files.

    Creates and configures a FastAPI app, registers all routes
    (WebSocket, web tools, proxy) and mounts static assets with CORS.

    Args:
        config (Config): Application configuration containing system settings.
        default_context_cache (ServiceContext, optional):
            Pre‑initialized service context for sessions' service context to reference to.
            **If omitted, `initialize()` method needs to be called to load service context.**

    Notes:
        - If default_context_cache is omitted, call `await initialize()` to load service context cache.
        - Use `clean_cache()` to clear and recreate the local cache directory.
    """

    def __init__(self, config: Config, default_context_cache: ServiceContext = None):
        self.app = FastAPI(title="Open-LLM-VTuber Server")  # Added title for clarity
        self.config = config
        self.default_context_cache = (
            default_context_cache or ServiceContext()
        )  # Use provided context or initialize a new empty one waiting to be loaded
        # It will be populated during the initialize method call

        # Optional shared-token gate (conf: system_config.access_token).
        # Added BEFORE CORS so CORS stays outermost and 401s still carry ACAO.
        access_token = getattr(config.system_config, "access_token", None)
        if access_token:
            self.app.add_middleware(AccessTokenMiddleware, access_token=access_token)
            logger.warning(
                "访问控制已启用：除静态资源外，所有请求需携带 access_token"
                "（?token= / X-Access-Token / Bearer）"
            )

        # Add global CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Include routes, passing the context instance
        # The context will be populated during the initialize step
        self.app.include_router(
            init_client_ws_route(default_context_cache=self.default_context_cache),
        )
        self.app.include_router(
            init_webtool_routes(default_context_cache=self.default_context_cache),
        )
        # Include campus topics routes
        self.app.include_router(init_campus_topics_route())

        # Include knowledge base management routes
        self.app.include_router(init_knowledge_management_routes())

        # Include admin auth routes (login/user management)
        from .knowledge.auth import init_auth_routes

        self.app.include_router(init_auth_routes())

        # 官网新闻/公告后台管理（2026-09-29）：公共读（/content、/article/{id}）
        # + 后台管理写（require_staff）。官网匿名页经 apiUrl() 自动附访问令牌可读。
        from .knowledge.portal_api import init_portal_routes

        for portal_router in init_portal_routes():
            self.app.include_router(portal_router)

        # 公众号→官网定时自动同步（2026-10-05）：常驻线程按周期拉发布记录，
        # 无需后台点按钮；多 worker 靠状态文件+独占锁单实例执行，未配凭据不启动。
        from .knowledge.wechat_sync import start_wechat_sync_scheduler

        start_wechat_sync_scheduler()

        # Include character config routes (name/persona -> conf.yaml + hot reload agent)
        from .character_config_api import init_character_config_routes

        self.app.include_router(
            init_character_config_routes(default_context_cache=self.default_context_cache)
        )

        # Include model (LLM API) config routes（2026-10-29：校方后台自助切换模型
        # 接口，含连通性测试；跨 worker 懒重载见 model_config_api）
        from .model_config_api import init_model_config_routes

        self.app.include_router(
            init_model_config_routes(default_context_cache=self.default_context_cache)
        )

        # Include system logs routes (audit trail / service log tail / stats)
        from .system_logs_api import init_agreements_routes, init_system_logs_routes

        self.app.include_router(init_system_logs_routes())

        # Agreement document downloads (login-page 用户协议/隐私政策, 2026-10-14)
        self.app.include_router(init_agreements_routes())

        # Initialize and include proxy routes if proxy is enabled
        system_config = config.system_config
        if hasattr(system_config, "enable_proxy") and system_config.enable_proxy:
            # Construct the server URL for the proxy
            host = system_config.host
            port = system_config.port
            server_url = f"ws://{host}:{port}/client-ws"
            self.app.include_router(
                init_proxy_route(server_url=server_url),
            )

        # Mount cache directory first (to ensure audio file access)
        if not os.path.exists("cache"):
            os.makedirs("cache")
        self.app.mount(
            "/cache",
            CORSStaticFiles(directory="cache"),
            name="cache",
        )

        # Mount static files with CORS-enabled handlers
        self.app.mount(
            "/live2d-models",
            RevalidateStaticFiles(directory="live2d-models"),
            name="live2d-models",
        )
        self.app.mount(
            "/bg",
            CORSStaticFiles(directory="backgrounds"),
            name="backgrounds",
        )
        self.app.mount(
            "/avatars",
            AvatarStaticFiles(directory="avatars"),
            name="avatars",
        )

        # Mount web tool directory separately from frontend
        self.app.mount(
            "/web-tool",
            CORSStaticFiles(directory="web_tool", html=True),
            name="web_tool",
        )

        # App 在线更新（OTA）发布目录：manifest.json + web-<版本>.zip，
        # 由 scripts/pub_ota.py 发布（内容=公开的 web 前端包，无需鉴权）。
        # App 启动时比对 manifest.version_code 与本机构建号，弹窗/静默换包。
        if not os.path.exists(os.path.join("data", "app-releases")):
            os.makedirs(os.path.join("data", "app-releases"), exist_ok=True)
        self.app.mount(
            "/app-releases",
            RevalidateStaticFiles(directory=os.path.join("data", "app-releases")),
            name="app-releases",
        )

        # 官网媒体目录（2026-09-21 官网 v2）：校庆视频等站点媒体，
        # 前端栏目页 <video> 直接引用 /media/<文件名>（APK 不打包，匿名可看）。
        # 目录不存在时跳过挂载（本地开发无媒体文件不报错）。
        if os.path.isdir("media"):
            self.app.mount(
                "/media",
                CORSStaticFiles(directory="media"),
                name="media",
            )

        # Prefer the reproducible web build from the v1.2.1 frontend source.
        # Keep the checked-in deployment artifact as a fallback for upstream checkouts.
        # Check for different possible build output directories
        if os.path.exists("frontend/dist/web/index.html"):
            frontend_directory = "frontend/dist/web"
        elif os.path.exists("frontend/out/renderer/index.html"):
            frontend_directory = "frontend/out/renderer"
        elif os.path.exists("frontend/index.html"):
            frontend_directory = "frontend"
        else:
            frontend_directory = "frontend"  # fallback
        logger.info(f"Using frontend directory: {frontend_directory}")
        self.app.mount(
            "/",
            CORSStaticFiles(directory=frontend_directory, html=True),
            name="frontend",
        )

    async def initialize(self):
        """Asynchronously load the service context from config.
        Calling this function is needed if default_context_cache was not provided to the constructor."""
        await self.default_context_cache.load_from_config(self.config)
        # 对齐 conf.yaml 初始签名：此后跨 worker 懒重载才以「外部变更」为准
        # （见 model_config_api.maybe_reload_default_context）
        from .model_config_api import mark_conf_seen

        mark_conf_seen()
        # 后台预热 RAG 首查 / TTS 首合成冷路径（2026-10-29 延迟优化，
        # 实测每 worker 首题多付 2.7~3.3s；纯预热不改变任何对外行为）。
        # 独立守护线程承载：initialize 由 asyncio.run 驱动，任务挂在它的
        # 循环上会随 asyncio.run 返回被取消；FastAPI 0.141 也已移除
        # add_event_handler，挂不上 startup 事件。
        from .utils.startup_warmup import start_background_warmup

        start_background_warmup(self.default_context_cache)

    @staticmethod
    def clean_cache():
        """Clean the cache directory by removing and recreating it."""
        cache_dir = "cache"
        if os.path.exists(cache_dir):
            shutil.rmtree(cache_dir)
            os.makedirs(cache_dir)
