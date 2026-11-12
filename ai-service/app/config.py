from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../backend/.env"), extra="ignore")

    qdrant_url: str = "http://127.0.0.1:6333"
    qdrant_collection: str = "hub_knowledge"
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = ""
    llm_model: str = "deepseek/deepseek-v3.2"
    llm_fallback_model: str = "qwen/qwen3-32b"
    llm_hemat_model: str = ""
    llm_precise_model: str = ""
    embedding_base_url: str = ""
    embedding_api_key: str = ""
    embedding_model: str = "openai/text-embedding-3-small"
    ai_service_key: str = ""
    midcsi_base_url: str = "http://127.0.0.1:7047"
    petty_cash_base_url: str = ""
    tool_callback_url: str = ""
    app_url: str = ""
    top_k: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
