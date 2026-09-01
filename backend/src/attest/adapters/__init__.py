from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any

import httpx


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
        payload = {"model": model_id, "max_tokens": 32, "temperature": 1.0, "top_p": 1.0, "system": system_prompt or "", "messages": [{"role": "user", "content": prompt}], "stream": False}
        default_path = "/v1/messages"
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    else:
        raise ValueError(f"unsupported protocol: {protocol}")
    headers.update(extra_headers or {})
    started = time.perf_counter()
    raw: dict[str, Any] = {}
    content = b""
    # 中转链路抖动/超时较常见：超时与连接错误自动重试一次，429/4xx 等响应错误不重试
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
                response = await client.post(endpoint(base_url, path or default_path), json=payload, headers=headers)
                response.raise_for_status()
                raw = response.json()
                content = response.content
            break
        except (httpx.TimeoutException, httpx.TransportError):
            if attempt == 1:
                raise
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
