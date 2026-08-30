import asyncio
import json
import subprocess

from app.llm_service import CodexCliService
from app.models import ChatRequest


def test_codex_exec_is_ephemeral_read_only_and_toolless(monkeypatch) -> None:
    monkeypatch.setattr("app.llm_service.shutil.which", lambda _: "/usr/local/bin/codex")
    service = CodexCliService()

    arguments = service._base_arguments()

    assert arguments[:2] == ["/usr/local/bin/codex", "exec"]
    assert "--ephemeral" in arguments
    assert "--ignore-user-config" in arguments
    assert "--ignore-rules" in arguments
    assert arguments[arguments.index("--sandbox") + 1] == "read-only"
    assert "features.shell_tool=false" in arguments
    assert "tools.web_search=false" in arguments
    assert arguments[-1] == "-"


def test_chat_sends_board_context_to_codex_stdin(monkeypatch) -> None:
    monkeypatch.setattr("app.llm_service.shutil.which", lambda _: "/usr/local/bin/codex")
    captured: dict[str, object] = {}

    def fake_run(arguments, **kwargs):
        captured["arguments"] = arguments
        captured["prompt"] = kwargs["input"]
        return subprocess.CompletedProcess(arguments, 0, "La posizione è equilibrata.", "")

    monkeypatch.setattr("app.llm_service.subprocess.run", fake_run)
    service = CodexCliService(timeout_seconds=30)
    request = ChatRequest(
        fen="8/8/8/8/8/8/4K3/7k w - - 0 1",
        pgn="1. e4 e5",
        message="Qual è il piano?",
        model="gpt-5.6-terra",
        reasoning_effort="high",
    )

    answer = asyncio.run(service.chat(request))

    assert answer == "La posizione è equilibrata."
    assert captured["arguments"][-1] == "-"
    assert captured["arguments"][captured["arguments"].index("--model") + 1] == "gpt-5.6-terra"
    assert 'model_reasoning_effort="high"' in captured["arguments"]
    assert request.fen in captured["prompt"]
    assert request.pgn in captured["prompt"]
    assert request.message in captured["prompt"]


def test_model_options_come_from_codex_catalog(monkeypatch) -> None:
    monkeypatch.setattr("app.llm_service.shutil.which", lambda _: "/usr/local/bin/codex")
    catalog = {
        "models": [
            {
                "slug": "gpt-test",
                "display_name": "GPT Test",
                "visibility": "list",
                "default_reasoning_level": "high",
                "supported_reasoning_levels": [
                    {"effort": "low", "description": "Fast"},
                    {"effort": "high", "description": "Deep"},
                ],
            }
        ]
    }

    def fake_run(arguments, **kwargs):
        return subprocess.CompletedProcess(arguments, 0, json.dumps(catalog), "")

    monkeypatch.setattr("app.llm_service.subprocess.run", fake_run)
    service = CodexCliService()

    options = asyncio.run(service.model_options())

    assert options["catalog_source"] == "codex-cli"
    assert options["models"][0]["slug"] == "gpt-test"
    assert options["models"][0]["supported_reasoning_levels"] == ["low", "high"]


def test_status_recognizes_chatgpt_login(monkeypatch) -> None:
    monkeypatch.setattr("app.llm_service.shutil.which", lambda _: "/usr/local/bin/codex")

    def fake_run(arguments, **kwargs):
        return subprocess.CompletedProcess(arguments, 0, "Logged in using ChatGPT", "")

    monkeypatch.setattr("app.llm_service.subprocess.run", fake_run)
    service = CodexCliService()

    status = asyncio.run(service.status())

    assert status == {
        "available": True,
        "authenticated": True,
        "auth_mode": "ChatGPT",
    }
