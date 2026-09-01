from __future__ import annotations

import asyncio
import hashlib
import time
from dataclasses import dataclass
from typing import Any

import httpx

# 429 视为限流而非错误：等待后重试，次数有上限避免无限挂起
RATE_LIMIT_MAX_RETRIES = 6
RATE_LIMIT_BASE_DELAY = 1.0
RATE_LIMIT_MAX_DELAY = 30.0


def _retry_after_seconds(response: httpx.Response) -> float | None:
    value = response.headers.get("retry-after")
    if not value:
        return None
    try:
        return min(max(0.0, float(value)), RATE_LIMIT_MAX_DELAY)
    except ValueError:
        return None


@dataclass(frozen=True)
class NormalizedResponse:
    text: str
    model: str | None
    finish_reason: str | None
    input_tokens: int | None
    output_tokens: int | None
    request_id: str | None
    latency_ms: int
    raw_hash: str


def endpoint(base_url: str, path: str) -> str:
    return base_url.rstrip("/") + "/" + path.lstrip("/")


def _text_from_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        text = content.get("text") or content.get("output_text")
        if isinstance(text, str):
            return text
        return _text_from_content(content.get("content", []))
    if isinstance(content, list):
        return "".join(_text_from_content(item) for item in content)
    return ""


async def generate(protocol: str, base_url: str, api_key: str, model_id: str, prompt: str, system_prompt: str | None = None, path: str | None = None, extra_headers: dict[str, str] | None = None) -> NormalizedResponse:
    if protocol == "openai_responses":
        payload = {"model": model_id, "input": prompt, "temperature": 1.0, "top_p": 1.0, "max_output_tokens": 32, "stream": False}
        default_path = "/v1/responses"
        headers = {"Authorization": f"Bearer {api_key}"}
    elif protocol == "openai_chat_completions":
        messages = ([{"role": "system", "content": system_prompt}] if system_prompt else []) + [{"role": "user", "content": prompt}]
        payload = {"model": model_id, "messages": messages, "temperature": 1.0, "top_p": 1.0, "max_tokens": 32, "stream": False}
        default_path = "/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
    elif protocol == "anthropic_messages":
        # 显式关闭 thinking：国模 Anthropic 兼容端点常默认开启推理，
        # max_tokens=32 会被 thinking 块耗尽导致 text 块缺失（empty_response）
        payload = {"model": model_id, "max_tokens": 32, "temperature": 1.0, "top_p": 1.0, "system": system_prompt or "", "messages": [{"role": "user", "content": prompt}], "stream": False, "thinking": {"type": "disabled"}}
        default_path = "/v1/messages"
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    else:
        raise ValueError(f"unsupported protocol: {protocol}")
    headers.update(extra_headers or {})
    raw: dict[str, Any] = {}
    content = b""
    # 中转链路抖动/超时较常见：超时与连接错误自动重试一次；
    # 429 是限流而非错误：按 Retry-After 或指数退避等待后重试，且不占用超时重试次数
    transport_retried = False
    rate_limit_retries = 0
    while True:
        started = time.perf_counter()  # 每次尝试重新计时，429 等待不计入延迟统计
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
                response = await client.post(endpoint(base_url, path or default_path), json=payload, headers=headers)
                response.raise_for_status()
                raw = response.json()
                content = response.content
            break
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 and rate_limit_retries < RATE_LIMIT_MAX_RETRIES:
                rate_limit_retries += 1
                delay = _retry_after_seconds(exc.response)
                if delay is None:
                    delay = min(RATE_LIMIT_BASE_DELAY * 2 ** (rate_limit_retries - 1), RATE_LIMIT_MAX_DELAY)
                await asyncio.sleep(delay)
                continue
            raise
        except (httpx.TimeoutException, httpx.TransportError):
            if transport_retried:
                raise
            transport_retried = True
    latency_ms = int((time.perf_counter() - started) * 1000)
    if protocol == "openai_responses":
        text = raw.get("output_text") or _text_from_content(raw.get("output"))
        usage = raw.get("usage") or {}
        finish = raw.get("status")
    elif protocol == "openai_chat_completions":
        choice = (raw.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        text = _text_from_content(message.get("content") or choice.get("text"))
        usage = raw.get("usage") or {}
        finish = choice.get("finish_reason")
    else:
        text = _text_from_content(raw.get("content"))
        usage = raw.get("usage") or {}
        finish = raw.get("stop_reason")
    return NormalizedResponse(text=text, model=raw.get("model"), finish_reason=finish, input_tokens=usage.get("input_tokens", usage.get("prompt_tokens")), output_tokens=usage.get("output_tokens", usage.get("completion_tokens")), request_id=raw.get("id"), latency_ms=latency_ms, raw_hash=hashlib.sha256(content).hexdigest())
