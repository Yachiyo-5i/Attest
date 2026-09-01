import asyncio

import httpx
import pytest
import respx

from attest.adapters import RATE_LIMIT_MAX_RETRIES, generate


@pytest.mark.asyncio
@respx.mock
async def test_chat_completions_payload_and_response():
    route = respx.post("https://gateway.test/v1/chat/completions").mock(return_value=httpx.Response(200, json={"id": "r1", "model": "m", "choices": [{"message": {"content": "7"}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 2, "completion_tokens": 1}}))
    result = await generate("openai_chat_completions", "https://gateway.test", "key", "m", "choose", "system")
    assert route.called
    assert route.calls[0].request.headers["authorization"] == "Bearer key"
    assert result.text == "7"
    assert result.output_tokens == 1


@pytest.mark.asyncio
@respx.mock
async def test_anthropic_messages_payload_and_response():
    route = respx.post("https://gateway.test/v1/messages").mock(return_value=httpx.Response(200, json={"id": "r2", "model": "m", "content": [{"type": "text", "text": "heads"}], "stop_reason": "end_turn", "usage": {"input_tokens": 3, "output_tokens": 1}}))
    result = await generate("anthropic_messages", "https://gateway.test", "key", "m", "flip")
    assert route.called
    assert route.calls[0].request.headers["x-api-key"] == "key"
    assert result.text == "heads"
    assert result.finish_reason == "end_turn"


@pytest.mark.asyncio
@respx.mock
async def test_responses_extracts_nested_output_text():
    route = respx.post("https://gateway.test/v1/responses").mock(return_value=httpx.Response(200, json={"id": "r3", "model": "m", "output": [{"type": "message", "content": [{"type": "output_text", "text": "7"}]}]}))
    result = await generate("openai_responses", "https://gateway.test", "key", "m", "choose")
    assert route.called
    assert result.text == "7"


@pytest.mark.asyncio
@respx.mock
async def test_rate_limit_waits_and_retries(monkeypatch):
    sleeps: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)
    ok = httpx.Response(200, json={"id": "r4", "model": "m", "choices": [{"message": {"content": "7"}, "finish_reason": "stop"}], "usage": {}})
    route = respx.post("https://gateway.test/v1/chat/completions").mock(side_effect=[httpx.Response(429, headers={"retry-after": "2"}), httpx.Response(429), ok])
    result = await generate("openai_chat_completions", "https://gateway.test", "key", "m", "choose")
    assert result.text == "7"
    assert route.call_count == 3
    assert sleeps == [2.0, 2.0]  # 第一次按 Retry-After，第二次指数退避


@pytest.mark.asyncio
@respx.mock
async def test_rate_limit_gives_up_after_max_retries(monkeypatch):
    async def fake_sleep(seconds: float) -> None:
        return None

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)
    route = respx.post("https://gateway.test/v1/chat/completions").mock(return_value=httpx.Response(429))
    with pytest.raises(httpx.HTTPStatusError):
        await generate("openai_chat_completions", "https://gateway.test", "key", "m", "choose")
    assert route.call_count == RATE_LIMIT_MAX_RETRIES + 1
