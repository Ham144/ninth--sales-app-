from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
import os

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_ENV = REPO_ROOT / "backend" / ".env"


def load_env() -> None:
    if BACKEND_ENV.is_file():
        load_dotenv(BACKEND_ENV)
    load_dotenv()


def settings() -> dict[str, str]:
    load_env()
    embedding_base = (
        os.getenv("EMBEDDING_BASE_URL") or os.getenv("LLM_BASE_URL") or ""
    ).rstrip("/")
    return {
        "qdrant_url": (os.getenv("QDRANT_URL") or "http://127.0.0.1:6333").rstrip("/"),
        "collection": os.getenv("QDRANT_COLLECTION") or "hub_knowledge",
        "embedding_base_url": embedding_base,
        "embedding_api_key": os.getenv("EMBEDDING_API_KEY") or os.getenv("LLM_API_KEY") or "",
        "embedding_model": os.getenv("EMBEDDING_MODEL") or "openai/text-embedding-3-small",
    }
