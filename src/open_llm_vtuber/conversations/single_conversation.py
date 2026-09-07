from typing import Union, List, Dict, Any, Optional
import asyncio
import json
import time
from loguru import logger
import numpy as np

from .conversation_utils import (
    create_batch_input,
    process_agent_output,
    send_conversation_start_signals,
    process_user_input,
    finalize_conversation_turn,
    cleanup_conversation,
    EMOJI_LIST,
)
from .types import WebSocketSend
from .tts_manager import TTSTaskManager
from ..chat_history_manager import store_message_async, store_message_detached
from ..service_context import ServiceContext
from ..utils.turn_latency import begin_turn, current_span

# Import necessary types from agent outputs
from ..agent.output_types import SentenceOutput, AudioOutput


async def process_single_conversation(
    context: ServiceContext,
    websocket_send: WebSocketSend,
    client_uid: str,
    user_input: Union[str, np.ndarray],
    images: Optional[List[Dict[str, Any]]] = None,
    session_emoji: str = np.random.choice(EMOJI_LIST),
    metadata: Optional[Dict[str, Any]] = None,
    turn_t0: "float | None" = None,
) -> str:
    """Process a single-user conversation turn

    Args:
        context: Service context containing all configurations and engines
        websocket_send: WebSocket send function
        client_uid: Client unique identifier
        user_input: Text or audio input from user
        images: Optional list of image data
        session_emoji: Emoji identifier for the conversation
        metadata: Optional metadata for special processing flags
        turn_t0: LATENCY 分段计时起点（create_task 前取的时刻），None 则不计时

    Returns:
        str: Complete response text
    """
    # Create TTSTaskManager for this conversation
    tts_manager = TTSTaskManager()
    full_response = ""  # Initialize full_response here

    try:
        # LATENCY 分段计时：绑定 span（本 task 子树可见），sched = 调度延迟
        span = begin_turn(client_uid, turn_t0)
        if span is not None:
            span.mark("sched")

        # Send initial signals
        await send_conversation_start_signals(websocket_send)
        logger.info(f"New Conversation Chain {session_emoji} started!")

        # Process user input
        input_text = await process_user_input(
            user_input, context.asr_engine, websocket_send
        )

        logger.info(f"User input: {input_text}")

        # Initialize enriched_input_text with original input (MUST be before any usage)
        enriched_input_text = input_text

        if images:
            logger.info(f"With {len(images)} images")

        # RAG 检索集成：检查是否需要从学校知识库（data/knowledge）检索相关信息
        try:
            from ..knowledge.rag_service import get_rag_service
            rag_service = get_rag_service()

            if rag_service.needs_rag_retrieval(input_text):
                logger.info("检测到学校相关问题，执行 RAG 检索...")
                rag_result = await rag_service.retrieve_and_enrich_input(
                    query=input_text,
                    top_k=6,
                )

                if rag_result.get("has_context"):
                    enriched_input_text = rag_result.get("enriched_query", input_text)
                    logger.info(f"RAG 检索成功，检索到 {len(rag_result.get('retrieved_docs', []))} 条相关资料")

                span = current_span()
                if span is not None:
                    span.set_once("rag_hit", bool(rag_result.get("has_context")))

                # 发送 RAG 检索状态到前端（命中与否都发，便于前端收起提示条）
                await websocket_send(json.dumps({
                    "type": "rag-status",
                    "has_context": bool(rag_result.get("has_context")),
                    "doc_count": len(rag_result.get("retrieved_docs", [])),
                }))
        except Exception as e:
            logger.warning(f"RAG 检索失败，继续使用原始输入: {e}")

        # Create batch input with enriched text (after RAG retrieval)
        batch_input = create_batch_input(
            input_text=enriched_input_text,  # Use enriched text from RAG
            images=images,
            from_name=context.character_config.human_name,
            metadata=metadata,
        )

        # Store user message (check if we should skip storing to history)
        # 发后即忘：等锁 + 整文件读改写不再卡在 LLM 调用之前的开口路径上
        skip_history = metadata and metadata.get("skip_history", False)
        if context.history_uid and not skip_history:
            hist_span = current_span()
            t_hist = time.monotonic()
            store_message_detached(
                conf_uid=context.character_config.conf_uid,
                history_uid=context.history_uid,
                role="human",
                content=input_text,
                name=context.character_config.human_name,
                username=context.username,
            )
            if hist_span is not None:
                hist_span.set_once("hist", round(time.monotonic() - t_hist, 3))

        try:
            # agent.chat yields Union[SentenceOutput, Dict[str, Any]]
            agent_output_stream = context.agent_engine.chat(batch_input)

            async for output_item in agent_output_stream:
                if (
                    isinstance(output_item, dict)
                    and output_item.get("type") == "tool_call_status"
                ):
                    # Handle tool status event: send WebSocket message
                    output_item["name"] = context.character_config.character_name
                    logger.debug(f"Sending tool status update: {output_item}")

                    await websocket_send(json.dumps(output_item))

                elif isinstance(output_item, (SentenceOutput, AudioOutput)):
                    # Handle SentenceOutput or AudioOutput
                    response_part = await process_agent_output(
                        output=output_item,
                        character_config=context.character_config,
                        live2d_model=context.live2d_model,
                        tts_engine=context.tts_engine,
                        websocket_send=websocket_send,  # Pass websocket_send for audio/tts messages
                        tts_manager=tts_manager,
                        translate_engine=context.translate_engine,
                    )
                    # Ensure response_part is treated as a string before concatenation
                    response_part_str = (
                        str(response_part) if response_part is not None else ""
                    )
                    full_response += response_part_str  # Accumulate text response
                else:
                    logger.warning(
                        f"Received unexpected item type from agent chat stream: {type(output_item)}"
                    )
                    logger.debug(f"Unexpected item content: {output_item}")

        except Exception as e:
            logger.exception(
                f"Error processing agent response stream: {e}"
            )  # Log with stack trace
            await websocket_send(
                json.dumps(
                    {
                        "type": "error",
                        "message": f"Error processing agent response: {str(e)}",
                    }
                )
            )
            # full_response will contain partial response before error
        # --- End processing agent response ---

        # Wait for any pending TTS tasks
        if tts_manager.task_list:
            await asyncio.gather(*tts_manager.task_list)
            await websocket_send(json.dumps({"type": "backend-synth-complete"}))

        await finalize_conversation_turn(
            tts_manager=tts_manager,
            websocket_send=websocket_send,
            client_uid=client_uid,
        )

        if context.history_uid and full_response:  # Check full_response before storing
            await store_message_async(
                conf_uid=context.character_config.conf_uid,
                history_uid=context.history_uid,
                role="ai",
                content=full_response,
                name=context.character_config.character_name,
                avatar=context.character_config.avatar,
                username=context.username,
            )
            logger.info(f"AI response: {full_response}")

        return full_response  # Return accumulated full_response

    except asyncio.CancelledError:
        logger.info(f"🤡👍 Conversation {session_emoji} cancelled because interrupted.")
        raise
    except Exception as e:
        logger.error(f"Error in conversation chain: {e}")
        await websocket_send(
            json.dumps({"type": "error", "message": f"Conversation error: {str(e)}"})
        )
        raise
    finally:
        cleanup_conversation(tts_manager, session_emoji)
