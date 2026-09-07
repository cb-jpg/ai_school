# -*- coding: utf-8 -*-
"""Stage B 功能冒烟测试（临时，验证后删除）"""
import sys, json, asyncio, importlib.util
sys.path.insert(0, 'src')
sys.path.insert(0, '.')

# --- 1. sentence_divider 语言记忆化 ---
from open_llm_vtuber.utils.sentence_divider import SentenceDivider, segment_text_by_pysbd, detect_language

async def test_divider():
    d = SentenceDivider(faster_first_response=True, segment_method='pysbd')
    outs = []
    async def gen():
        for t in ('学校的校训是厚德博学，', '这句是完整的第二句。后面还有一句话没说完'):
            yield t
    async for s in d.process_stream(gen()):
        if hasattr(s, 'text'):
            outs.append(s.text)
    joined = ''.join(outs)
    assert '厚德博学' in joined, f'切句丢内容: {outs}'
    assert '第二句' in joined, f'切句丢内容: {outs}'
    # 第二块含句号 → 走 _segment_text → 语言已尝试检测（短句可能检测失败=不记忆化，与旧逐次检测行为一致）
    print(f'[1] divider 中文切句 OK, 句数={len(outs)}, lang_hint={d._lang_hint}, outs={outs}')

    # lang_hint 直传与现场检测等价（用足够长的干净文本）
    sample = '你好世界，这是第一句。这是第二句话！最后还有一句？'
    r1 = segment_text_by_pysbd(sample, lang_hint='zh')
    r2 = segment_text_by_pysbd(sample)
    assert r1 == r2, f'lang_hint 结果不一致: {r1} vs {r2}'
    print('[2] lang_hint 等价性 OK:', r1)

asyncio.run(test_divider())

# --- 2. ensure_ascii=False 语义等价 ---
p = {'type': 'audio', 'display_text': {'text': '你好，学校'}, 'audio': 'QUJD'}
s1 = json.dumps(p); s2 = json.dumps(p, ensure_ascii=False)
assert json.loads(s1) == json.loads(s2) == p
assert len(s2) < len(s1)
print(f'[3] ensure_ascii 语义等价 OK, {len(s1)} -> {len(s2)} bytes')

# --- 3. RAG 常量与默认值 ---
from open_llm_vtuber.knowledge import rag_service
assert rag_service.CHAT_TOP_K == 4 and rag_service.DOC_CHAR_CAP == 480 and rag_service.TOP_K == 6
import inspect
sig = inspect.signature(rag_service.RagService.retrieve_and_enrich_input)
assert sig.parameters['top_k'].default == 4, '对话路径默认 top_k 应为 4'
assert inspect.signature(rag_service.RagService.search).parameters['top_k'].default == 6, '管理端应保持 6'
print('[4] RAG 常量与默认值 OK (CHAT_TOP_K=4, TOP_K=6)')

# needs_rag_retrieval 抽查 --diversify 题池
spec = importlib.util.spec_from_file_location('cst', 'scripts/concurrency_stress_test.py')
cst = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cst)
miss = [q for q in cst.SCHOOL_POOL if not rag_service.RagService.needs_rag_retrieval(q)]
assert not miss, f'题池这些问题不触发 RAG: {miss}'
casual_hit = [q for q in cst.CASUAL_POOL if rag_service.RagService.needs_rag_retrieval(q)]
assert not casual_hit, f'闲聊池误触发 RAG: {casual_hit}'
print(f'[5] SCHOOL_POOL {len(cst.SCHOOL_POOL)} 题全部触发 RAG, CASUAL_POOL {len(cst.CASUAL_POOL)} 题全部不触发')
# diversify 出题：N=64/96 时轮 1 题目互不相同（记得打开开关再测）
cst.DIVERSIFY = True
qs64 = [cst.questions_for(i)[0] for i in range(64)]
assert len(set(qs64)) == 64, f'64 人轮1题目有重复: {len(set(qs64))} 种'
qs96 = [cst.questions_for(i)[0] for i in range(96)]
assert len(set(qs96)) == 96, f'96 人轮1题目有重复: {len(set(qs96))} 种'
assert cst.questions_for(0)[0] == cst.SCHOOL_POOL[0]
assert cst.questions_for(32)[0] == '请问，' + cst.SCHOOL_POOL[0]
cst.DIVERSIFY = False
assert cst.questions_for(0)[0] == cst.Q_SCHOOL, 'DIVERSIFY 关闭时应回到默认问题'
print('[6] diversify 确定性出题 OK: N=64/96 轮1全不同; 关闭后回默认')

# --- 4. 分锁 ---
from open_llm_vtuber.chat_history_manager import _history_lock
async def t_locks():
    l1 = _history_lock('c1', 'h1', None)
    l2 = _history_lock('c1', 'h2', None)
    l1b = _history_lock('c1', 'h1', None)
    assert l1 is l1b and l1 is not l2
asyncio.run(t_locks())
print('[7] 分锁 OK: 同会话同锁、异会话异锁')

print()
print('=== 全部功能测试通过 ===')
