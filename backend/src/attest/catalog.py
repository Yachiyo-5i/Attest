from __future__ import annotations

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


def get_model(model_id: str) -> dict:
    for model in MODEL_CATALOG:
        if model["id"] == model_id:
            return model
    raise KeyError(model_id)
