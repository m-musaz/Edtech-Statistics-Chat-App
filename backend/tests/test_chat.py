import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
import json

from app.main import app

client = TestClient(app)

pytestmark = pytest.mark.asyncio


# --- Helper for non-streaming mock ---
def create_mock_response(output_text="Test response"):
    # Use a regular MagicMock. The real response object is not awaitable.
    mock_response = MagicMock()
    mock_response.output_text = output_text
    # The real .model_dump() is a regular method, not async.
    mock_response.model_dump.return_value = {
        "id": "resp_123",
        "output_text": output_text
    }
    return mock_response


@patch("app.services.chat_service.client", new_callable=AsyncMock)
async def test_chat_simple_response(mock_openai_client):
    """Tests a simple, non-streaming chat response without a file."""
    # The `create` method IS async, so we configure its awaitable result.
    mock_openai_client.responses.create.return_value = create_mock_response("Hello there!")

    response = client.post(
        "/api/v1/chat",
        files={"user_message": (None, "Hello"), "stream": (None, "false")}
    )

    assert response.status_code == 200
    assert response.json()["output_text"] == "Hello there!"


@patch("app.services.chat_service.client", new_callable=AsyncMock)
async def test_chat_with_file_upload(mock_openai_client):
    """Tests chat functionality with a file upload."""
    mock_file_upload = AsyncMock()
    mock_file_upload.id = "file_abc"
    mock_openai_client.files.create.return_value = mock_file_upload

    mock_openai_client.responses.create.return_value = create_mock_response("File processed.")

    dummy_file_content = b"header1,header2\nvalue1,value2"

    response = client.post(
        "/api/v1/chat",
        files={
            "user_message": (None, "Analyze this file"),
            "stream": (None, "false"),
            "file": ("test.csv", dummy_file_content, "text/csv"),
        }
    )

    assert response.status_code == 200
    assert response.json()["output_text"] == "File processed."


@patch("app.services.chat_service.client", new_callable=AsyncMock)
async def test_chat_streaming_response(mock_openai_client):
    """Tests a streaming chat response."""

    async def mock_event_generator():
        mock_event = MagicMock()
        mock_event.json.return_value = '{"delta": "Hello "}'
        mock_event.dict.return_value = {"delta": "Hello "}
        yield mock_event
        mock_event_2 = MagicMock()
        mock_event_2.json.return_value = '{"delta": "World"}'
        mock_event_2.dict.return_value = {"delta": "World"}
        yield mock_event_2

    mock_stream_manager = AsyncMock()
    mock_stream_manager.__aenter__.return_value = mock_event_generator()

    # CORRECTED: The .stream method itself is NOT async. It returns the manager directly.
    # We must replace the auto-created AsyncMock for `.stream` with a regular MagicMock.
    mock_openai_client.responses.stream = MagicMock(return_value=mock_stream_manager)

    response = client.post(
        "/api/v1/chat",
        files={ "user_message": (None, "Hello stream"), "stream": (None, "true") }
    )

    assert response.status_code == 200

    content = response.text
    expected_content = (
        'data: {"delta": "Hello "}\n\n'
        'data: {"delta": "World"}\n\n'
    )
    assert content == expected_content


@patch("app.services.chat_service.client", new_callable=AsyncMock)
async def test_chat_with_history(mock_openai_client):
    """Tests that previous_response_id is passed correctly."""
    mock_openai_client.responses.create.return_value = create_mock_response("Continuing conversation.")

    response = client.post(
        "/api/v1/chat",
        files={
            "user_message": (None, "What about the second step?"),
            "stream": (None, "false"),
            "previous_response_id": (None, '[]'),
        }
    )

    assert response.status_code == 200
    mock_openai_client.responses.create.assert_called_once()

    # Assert that the parameter was included in the call to OpenAI
    call_args = mock_openai_client.responses.create.call_args.kwargs
    assert "input" in call_args
