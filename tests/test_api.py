import chess
from fastapi.testclient import TestClient

from app.chess_service import apply_move
from app.main import app
from app.models import MoveClassificationResponse


def test_health_and_new_game_endpoints(monkeypatch) -> None:
    async def authenticated_codex() -> dict[str, object]:
        return {
            "available": True,
            "authenticated": True,
            "auth_mode": "ChatGPT",
        }

    monkeypatch.setattr("app.main.codex.status", authenticated_codex)
    with TestClient(app) as client:
        health = client.get("/api/health")
        game = client.get("/api/game/new")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert health.json()["codex_authenticated"] is True
    assert health.json()["auth_mode"] == "ChatGPT"
    assert game.status_code == 200
    assert game.json()["fen"] == chess.Board().fen()
    assert len(game.json()["legal_moves"]) == 20


def test_move_endpoint_rejects_illegal_move() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/game/move",
            json={
                "fen": chess.Board().fen(),
                "from_square": "e2",
                "to_square": "e5",
            },
        )

    assert response.status_code == 422
    assert "non è legale" in response.json()["detail"]


def test_computer_move_endpoint(monkeypatch) -> None:
    board = chess.Board()
    board.push_uci("e2e4")

    async def fake_computer_move(fen: str, difficulty: str, initial_fen=None, moves_uci=None):
        assert difficulty == "hard"
        return apply_move(fen, "e7", "e5", None)

    monkeypatch.setattr("app.main.stockfish.computer_move", fake_computer_move)
    with TestClient(app) as client:
        response = client.post(
            "/api/game/computer-move",
            json={"fen": board.fen(), "difficulty": "hard", "engine": "stockfish"},
        )

    assert response.status_code == 200
    assert response.json()["last_move_uci"] == "e7e5"
    assert response.json()["turn"] == "white"


def test_classify_move_endpoint(monkeypatch) -> None:
    async def fake_classification(fen: str, move_uci: str, depth: int | None, initial_fen=None, moves_uci=None):
        assert fen == chess.Board().fen()
        assert move_uci == "e2e4"
        assert depth is None
        return MoveClassificationResponse(
            code="book",
            label="Da manuale",
            marker="♜",
            expected_points_loss=0,
            played_move_san="e4",
        )

    monkeypatch.setattr("app.main.stockfish.classify_move", fake_classification)
    with TestClient(app) as client:
        response = client.post(
            "/api/classify-move",
            json={"fen": chess.Board().fen(), "move_uci": "e2e4"},
        )

    assert response.status_code == 200
    assert response.json()["code"] == "book"
    assert response.json()["label"] == "Da manuale"


def test_chat_endpoint_uses_codex_provider(monkeypatch) -> None:
    async def fake_chat(_request) -> str:
        return "Controlla prima la sicurezza del re."

    monkeypatch.setattr("app.main.codex.chat", fake_chat)
    with TestClient(app) as client:
        response = client.post(
            "/api/chat",
            json={
                "fen": chess.Board().fen(),
                "message": "Qual è il piano?",
            },
        )

    assert response.status_code == 200
    assert response.json()["answer"] == "Controlla prima la sicurezza del re."
    assert response.json()["model"] == "modello account"


def test_codex_options_endpoint(monkeypatch) -> None:
    async def fake_options() -> dict[str, object]:
        return {
            "models": [{"slug": "gpt-test", "display_name": "GPT Test"}],
            "configured_model": None,
            "default_reasoning_level": "medium",
            "catalog_source": "codex-cli",
        }

    monkeypatch.setattr("app.main.codex.model_options", fake_options)
    with TestClient(app) as client:
        response = client.get("/api/codex/options")

    assert response.status_code == 200
    assert response.json()["models"][0]["slug"] == "gpt-test"


def test_index_is_served() -> None:
    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert "Yomi Sensei" in response.text
