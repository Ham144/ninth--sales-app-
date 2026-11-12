from pydantic import ValidationError
import pytest

from app.schemas import RetrieveRequest, TurnRequest


def test_turn_rejects_empty_message():
    with pytest.raises(ValidationError):
        TurnRequest(message="   ", system_prompt="copilot staf")


def test_turn_caps_message_length():
    with pytest.raises(ValidationError):
        TurnRequest(message="a" * 2001, system_prompt="copilot staf")


def test_retrieve_requires_query():
    with pytest.raises(ValidationError):
        RetrieveRequest(q="x")
    body = RetrieveRequest(q="cek stok")
    assert body.top_k == 5
