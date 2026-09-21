"""联网检索（2026-09-20 需求 #4）：让数字人回答可以结合网上最新信息。

链路：single_conversation 在 RAG 检索的同时/之后调用本模块，命中则把
「联网检索结果」块拼进 enriched_input_text，由 LLM 参考作答。

设计约束（共用服务器 + 开口延迟敏感）：
- 单引擎超时 5s；调用方（single_conversation）再以 6s wait_for 封顶，绝不拖开口。
  时效/搜索类问题检索与 RAG 并行，不叠加延迟；普通问题仅在 RAG 未命中时兜底搜一次。
- 结果缓存 30 分钟（同一问题反复问不重复出网）。
- 引擎：搜狗 → 必应中国 → 百度网页版，静态 HTML 正则解析（不引新依赖）；任一失败自动切下一个。
  （搜狗对校名这类小众实体召回最好，且能带出微信文章；必应标记规整；百度对高频自动化请求
  会弹验证页，只配当备胎。）
- 环境变量 OLLV_WEB_SEARCH=0 可整体关闭（现场网络受限时的逃生门）。
- 公众号推文/视频号内容的接入见 docs/微信公众号接入说明.md：官方接口拿到素材后
  可入库为知识条目（走既有 RAG），时效类内容未来也可走本模块同样式注入。
"""

import html as _html
import os
import re
import time
from dataclasses import dataclass
from urllib.parse import quote_plus

from loguru import logger

try:
    import aiohttp
except ImportError:  # 可选依赖缺失：模块仍可导入，检索时返回空结果
    aiohttp = None  # type: ignore[assignment]

SEARCH_TIMEOUT = 5.0        # 单引擎超时（秒）；两引擎串行最坏 ~10s，但百度基本必达
CACHE_TTL = 1800            # 检索结果缓存 30 分钟
CACHE_MAX = 256
MAX_RESULTS = 6             # 注入 prompt 的条数上限（省 token）

# 时效/事实类问题才联网（关键词命中）。普通寒暄、纯校史题走知识库即可，不添延迟。
RECENCY_KEYWORDS = (
    "最新", "最近", "近期", "今天", "今日", "昨天", "今年", "现在", "目前",
    "新闻", "通知", "公告", "放假", "停课", "开学", "考试时间", "报名时间",
    "招生", "录取", "分数线", "成绩", "天气", "公众号", "推文", "视频号",
    "热搜", "头条", "百度", "搜索", "上网查", "查一下", "联网",
)
MIN_QUERY_LEN = 4

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


@dataclass
class WebResult:
    title: str
    snippet: str
    url: str
    source: str  # baidu / bing


def needs_web_search(query: str) -> bool:
    """时效/事实类问题才联网（关键词命中；太短的不搜）。"""
    if os.environ.get("OLLV_WEB_SEARCH", "1") == "0":
        return False
    if not query or len(query.strip()) < MIN_QUERY_LEN:
        return False
    return any(k in query for k in RECENCY_KEYWORDS)


# 校名简称加引号精确匹配：不加引号时引擎会把「石实实验学校」拆成「石」字谜题
SCHOOL_ALIASES = ("石实实验学校", "石门实验学校", "石实实验", "石门实验", "石实中学", "石实")


def _with_quoted_school(query: str) -> str:
    for alias in SCHOOL_ALIASES:  # 长别名在前，最长匹配优先
        if alias in query:
            return query.replace(alias, f'"{alias}"', 1)
    return query


def _strip_html(s: str) -> str:
    return _WS_RE.sub(" ", _TAG_RE.sub("", s)).strip()


# 结果块里混着页面模板的 JSON/JS/CSS 片段，不能当摘要喂给 LLM（含花括号的一律不要）
_JUNK_RE = re.compile(r'[{}]|function\s*\(|javascript:|window\.|\.js\b')


def _clean_text(s: str) -> str:
    return _html.unescape(_strip_html(s))


_CACHE: dict = {}  # query -> (ts, [WebResult])


def _cache_get(query: str) -> list[WebResult] | None:
    hit = _CACHE.get(query)
    if hit and time.monotonic() - hit[0] < CACHE_TTL:
        return hit[1]
    return None


def _cache_put(query: str, results: list[WebResult]) -> None:
    if len(_CACHE) >= CACHE_MAX:
        # 粗暴淘汰最早一半，避免无限增长
        for k in sorted(_CACHE, key=lambda k: _CACHE[k][0])[: CACHE_MAX // 2]:
            _CACHE.pop(k, None)
    _CACHE[query] = (time.monotonic(), results)


_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


async def _fetch_html(session: "aiohttp.ClientSession", url: str) -> str:
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=SEARCH_TIMEOUT),
                           headers={"User-Agent": _UA, "Accept-Language": "zh-CN,zh;q=0.9"}) as r:
        if r.status != 200:
            raise RuntimeError(f"HTTP {r.status}")
        return await r.text(errors="ignore")


def _parse_h3_blocks(html: str, source: str) -> list[WebResult]:
    """百度/搜狗结果页通用解析：按 <h3> 分块，块内取首个链接为标题、块内最长纯文本为摘要。"""
    out: list[WebResult] = []
    for chunk in re.split(r"<h3[^>]*>", html)[1:]:
        m = re.search(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', chunk, re.DOTALL)
        if not m:
            continue
        url, title = m.group(1), _clean_text(m.group(2))
        if not title:
            continue
        texts = []
        for t in _TAG_RE.split(chunk):
            t = _clean_text(t)
            if len(t) < 20 or _JUNK_RE.search(t):
                continue
            texts.append(t)
        snippet = max(texts, key=len, default="")
        if len(snippet) < 20:  # 摘要过短多为广告/导航块
            continue
        out.append(WebResult(title=title[:80], snippet=snippet[:200], url=url, source=source))
        if len(out) >= MAX_RESULTS:
            break
    return out


def _parse_bing(html: str) -> list[WebResult]:
    """必应结果页：b_algo 块内 h2>a 为标题、p 为摘要。"""
    out: list[WebResult] = []
    for chunk in re.split(r'class="b_algo"', html)[1:]:
        m = re.search(r'<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', chunk, re.DOTALL)
        if not m:
            continue
        url, title = m.group(1), _clean_text(m.group(2))
        p = re.search(r"<p[^>]*>(.*?)</p>", chunk, re.DOTALL)
        snippet = _clean_text(p.group(1)) if p else ""
        if not title or len(snippet) < 10:
            continue
        out.append(WebResult(title=title[:80], snippet=snippet[:200], url=url, source="bing"))
        if len(out) >= MAX_RESULTS:
            break
    return out


async def _search_one(engine: str, query: str) -> list[WebResult]:
    async with aiohttp.ClientSession() as session:
        if engine == "sogou":
            html = await _fetch_html(session, f"https://www.sogou.com/web?query={quote_plus(query)}")
            return _parse_h3_blocks(html, "sogou")
        if engine == "baidu":
            html = await _fetch_html(
                session, f"https://www.baidu.com/s?wd={quote_plus(query)}&rn=10&ie=utf-8")
            return _parse_h3_blocks(html, "baidu")
        html = await _fetch_html(
            session, f"https://cn.bing.com/search?q={quote_plus(query)}&count=10&setlang=zh-hans")
        return _parse_bing(html)


async def web_search(query: str, min_results: int = 2) -> list[WebResult]:
    """联网搜索：缓存 → 搜狗 → 必应 → 百度。失败返回空列表（调用方当无事发生）。"""
    if os.environ.get("OLLV_WEB_SEARCH", "1") == "0" or aiohttp is None:
        return []
    cached = _cache_get(query)
    if cached is not None:
        return cached
    query = _with_quoted_school(query)
    for engine in ("sogou", "bing", "baidu"):
        try:
            results = await _search_one(engine, query)
        except Exception as e:  # noqa: BLE001  检索失败不该打断对话
            logger.warning(f"[联网检索] {engine} 失败: {e}")
            continue
        if len(results) >= min_results:
            _cache_put(query, results)
            logger.info(f"[联网检索] {engine} 命中 {len(results)} 条: {query}")
            return results
        logger.info(f"[联网检索] {engine} 仅 {len(results)} 条，尝试下一引擎")
    _cache_put(query, [])  # 空结果也缓存，避免连环失败每次都出网
    return []


def format_results_block(query: str, results: list[WebResult]) -> str:
    """拼进 prompt 的联网检索块（带使用守则，防串答）。"""
    if not results:
        return ""
    lines = [f"【联网检索结果】（问题「{query}」的网上信息，来源：百度/必应网页检索）"]
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. {r.title}：{r.snippet}")
    lines.append(
        "（使用规则：仅引用与问题相关的条目；信息可能过时，表述时用「据网上信息」；"
        "与学校知识库内容冲突时，一律以学校知识库为准。）")
    return "\n".join(lines)


async def web_search_context(query: str, min_results: int = 2) -> str:
    """一步到位：搜索并返回 prompt 块（无结果返回空串）。"""
    try:
        return format_results_block(query, await web_search(query, min_results))
    except Exception as e:  # noqa: BLE001  任何异常都不影响对话主链路
        logger.warning(f"[联网检索] 异常忽略: {e}")
        return ""
