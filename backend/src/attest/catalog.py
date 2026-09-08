from __future__ import annotations

import json
import re
from pathlib import Path

from .config import settings

MODEL_CATALOG = [
    {"id": "openai.gpt-5.6-sol", "provider": "openai", "display_name": "GPT-5.6 Sol", "api_model_id": "gpt-5.6-sol", "protocols": ["openai_responses", "openai_chat_completions"]},
    {"id": "openai.gpt-5.6-terra", "provider": "openai", "display_name": "GPT-5.6 Terra", "api_model_id": "gpt-5.6-terra", "protocols": ["openai_responses", "openai_chat_completions"]},
    {"id": "openai.gpt-5.6-luna", "provider": "openai", "display_name": "GPT-5.6 Luna", "api_model_id": "gpt-5.6-luna", "protocols": ["openai_responses", "openai_chat_completions"]},
    {"id": "anthropic.claude-opus-4.6", "provider": "anthropic", "display_name": "Claude Opus 4.6", "api_model_id": "claude-opus-4.6", "protocols": ["anthropic_messages"]},
    {"id": "anthropic.claude-opus-4.7", "provider": "anthropic", "display_name": "Claude Opus 4.7", "api_model_id": "claude-opus-4.7", "protocols": ["anthropic_messages"]},
    {"id": "anthropic.claude-opus-4.8", "provider": "anthropic", "display_name": "Claude Opus 4.8", "api_model_id": "claude-opus-4.8", "protocols": ["anthropic_messages"]},
    {"id": "anthropic.claude-opus-5", "provider": "anthropic", "display_name": "Claude Opus 5", "api_model_id": "claude-opus-5", "protocols": ["anthropic_messages"]},
    {"id": "kimi.kimi-k3", "provider": "kimi", "display_name": "Kimi K3", "api_model_id": "kimi-k3", "protocols": ["openai_chat_completions", "anthropic_messages"]},
    {"id": "glm.glm-5.2", "provider": "glm", "display_name": "GLM 5.2", "api_model_id": "glm-5.2", "protocols": ["openai_chat_completions", "anthropic_messages"]},
    {"id": "glm.glm-5.3", "provider": "glm", "display_name": "GLM 5.3", "api_model_id": "glm-5.3", "protocols": ["openai_chat_completions", "anthropic_messages"]},
    {"id": "deepseek.deepseek-v4-flash", "provider": "deepseek", "display_name": "DeepSeek V4 Flash", "api_model_id": "deepseek-v4-flash", "protocols": ["openai_chat_completions", "anthropic_messages"]},
    {"id": "deepseek.deepseek-v4-pro", "provider": "deepseek", "display_name": "DeepSeek V4 Pro", "api_model_id": "deepseek-v4-pro", "protocols": ["openai_chat_completions", "anthropic_messages"]},
    {"id": "qwen.qwen-3.8", "provider": "qwen", "display_name": "Qwen 3.8", "api_model_id": "qwen-3.8", "protocols": ["openai_chat_completions", "anthropic_messages"]},
    {"id": "minimax.minimax-m3", "provider": "minimax", "display_name": "MiniMax M3", "api_model_id": "minimax-m3", "protocols": ["openai_chat_completions", "anthropic_messages"]},
]

_DISPLAY_NAME_WORDS = {
    "claude": "Claude",
    "deepseek": "DeepSeek",
    "gemma": "Gemma",
    "glm": "GLM",
    "gpt": "GPT",
    "kimi": "Kimi",
    "llama": "Llama",
    "minimax": "MiniMax",
    "mistral": "Mistral",
    "qwen": "Qwen",
    "yi": "Yi",
}


def display_name_from_model_name(model_name: str) -> str:
    """Create a readable label while preserving the model name sent to the gateway."""
    pieces = [piece for piece in re.split(r"[-_/\s]+", model_name.strip()) if piece]
    if not pieces:
        return model_name.strip()
    words = []
    for piece in pieces:
        lower = piece.lower()
        if lower in _DISPLAY_NAME_WORDS:
            words.append(_DISPLAY_NAME_WORDS[lower])
        elif re.fullmatch(r"v\d.*", lower):
            words.append("V" + piece[1:])
        elif piece.isupper() and len(piece) <= 5:
            words.append(piece)
        else:
            words.append(piece[:1].upper() + piece[1:])
    if len(words) > 1 and words[0] in _DISPLAY_NAME_WORDS.values() and re.match(r"^\d", words[1]):
        words[0] = f"{words[0]}-{words.pop(1)}"
    return " ".join(words)


def _custom_models_path() -> Path:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings.data_dir / "models.json"


def _read_custom_models() -> list[dict]:
    path = _custom_models_path()
    if not path.exists():
        return []
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return value if isinstance(value, list) else []


def _write_custom_models(models: list[dict]) -> None:
    _custom_models_path().write_text(json.dumps(models, ensure_ascii=False, indent=2), encoding="utf-8")


def list_models() -> list[dict]:
    return [
        *MODEL_CATALOG,
        *[
            {
                **model,
                "display_name": model.get("display_name") or display_name_from_model_name(model.get("api_model_id") or model.get("model_name", "")),
                "api_model_id": model.get("api_model_id") or model.get("model_name"),
            }
            for model in _read_custom_models()
        ],
    ]


def add_model(provider: str, model_name: str, protocols: list[str]) -> dict:
    provider = provider.strip().lower()
    model_name = model_name.strip()
    safe_provider = re.sub(r"[^\w-]+", "-", provider, flags=re.UNICODE).strip("-") or "custom"
    safe_name = re.sub(r"[^\w_.:-]+", "-", model_name, flags=re.UNICODE).strip("-") or "model"
    model_id = f"{safe_provider}.{safe_name}"
    if any(model["id"] == model_id for model in list_models()):
        raise ValueError("model already exists")
    model = {
        "id": model_id,
        "provider": provider,
        "display_name": display_name_from_model_name(model_name),
        "api_model_id": model_name,
        "protocols": protocols,
        "custom": True,
    }
    custom = _read_custom_models()
    custom.append(model)
    _write_custom_models(custom)
    return model


def delete_model(model_id: str) -> None:
    custom = _read_custom_models()
    remaining = [model for model in custom if model["id"] != model_id]
    if len(remaining) == len(custom):
        raise KeyError(model_id)
    _write_custom_models(remaining)


def get_model(model_id: str) -> dict:
    for model in list_models():
        if model["id"] == model_id:
            return model
    raise KeyError(model_id)
