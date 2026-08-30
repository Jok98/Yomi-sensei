import asyncio

import chess
import chess.engine
import pytest

from app.chess_service import ChessRuleError, StockfishService, apply_move, new_game, parse_board


def test_new_game_exposes_twenty_legal_moves() -> None:
    state = new_game()

    assert state.turn == "white"
    assert len(state.legal_moves) == 20
    assert state.fen == chess.Board().fen()


def test_apply_move_returns_normalized_position_and_san() -> None:
    state = apply_move(chess.Board().fen(), "e2", "e4", None)

    assert state.turn == "black"
    assert state.last_move_san == "e4"
    assert state.last_move_uci == "e2e4"
    assert any(move.uci == "e7e5" for move in state.legal_moves)


def test_illegal_move_is_rejected() -> None:
    with pytest.raises(ChessRuleError):
        apply_move(chess.Board().fen(), "e2", "e5", None)


def test_invalid_fen_is_rejected() -> None:
    with pytest.raises(ChessRuleError):
        parse_board("not-a-fen")


def test_analysis_includes_replies_for_each_top_move(monkeypatch) -> None:
    service = StockfishService("unused")

    def fake_analyze(board: chess.Board, _depth: int) -> list[dict]:
        moves = list(board.legal_moves)[:3]
        return [
            {
                "pv": [move],
                "score": chess.engine.PovScore(chess.engine.Cp(30 - rank * 5), board.turn),
            }
            for rank, move in enumerate(moves)
        ]

    monkeypatch.setattr(service, "_analyze_sync", fake_analyze)

    result = asyncio.run(service.analyze(chess.Board().fen(), 8))

    assert len(result.candidates) == 3
    assert len(result.replies) == 3
    assert all(reply.side_to_move == "black" for reply in result.replies)
    assert all(len(reply.candidates) == 3 for reply in result.replies)
    assert result.replies[0].after_uci == result.candidates[0].uci


def test_analysis_can_skip_opponent_replies(monkeypatch) -> None:
    service = StockfishService("unused")

    def fake_analyze(board: chess.Board, _depth: int) -> list[dict]:
        move = next(iter(board.legal_moves))
        return [
            {
                "pv": [move],
                "score": chess.engine.PovScore(chess.engine.Cp(20), board.turn),
            }
        ]

    monkeypatch.setattr(service, "_analyze_sync", fake_analyze)

    result = asyncio.run(service.analyze(chess.Board().fen(), 8, include_replies=False))

    assert len(result.candidates) == 1
    assert result.replies == []


def test_computer_move_uses_stockfish_choice(monkeypatch) -> None:
    board = chess.Board()
    board.push_uci("e2e4")
    service = StockfishService("unused")
    monkeypatch.setattr(service, "_play_sync", lambda _board, _difficulty: chess.Move.from_uci("e7e5"))

    result = asyncio.run(service.computer_move(board.fen(), "medium"))

    assert result.turn == "white"
    assert result.last_move_san == "e5"
    assert result.last_move_uci == "e7e5"


def test_classification_recognizes_opening_book_without_engine() -> None:
    service = StockfishService("unused")

    result = asyncio.run(service.classify_move(chess.Board().fen(), "e2e4"))

    assert result.code == "book"
    assert result.label == "Da manuale"
    assert result.played_move_san == "e4"


def test_classification_recognizes_best_non_book_move(monkeypatch) -> None:
    service = StockfishService("unused")

    def fake_analyze(board: chess.Board, _depth: int) -> dict:
        move = chess.Move.from_uci("b1c3")
        return {
            "pv": [move],
            "score": chess.engine.PovScore(chess.engine.Cp(35), board.turn),
        }

    monkeypatch.setattr(service, "_analyze_one_sync", fake_analyze)

    result = asyncio.run(service.classify_move(chess.Board().fen(), "b1c3", 8))

    assert result.code == "best"
    assert result.label == "Migliore"
    assert result.best_move_san == "Nc3"


def test_classification_penalizes_a_large_expected_score_loss(monkeypatch) -> None:
    service = StockfishService("unused")

    def fake_analyze(board: chess.Board, _depth: int) -> dict:
        if board.turn == chess.WHITE:
            move = chess.Move.from_uci("b1c3")
            score = chess.engine.PovScore(chess.engine.Cp(300), chess.WHITE)
        else:
            move = next(iter(board.legal_moves))
            score = chess.engine.PovScore(chess.engine.Cp(300), chess.BLACK)
        return {"pv": [move], "score": score}

    monkeypatch.setattr(service, "_analyze_one_sync", fake_analyze)

    result = asyncio.run(service.classify_move(chess.Board().fen(), "a2a3", 8))

    assert result.code == "blunder"
    assert result.expected_points_loss > 0.2
    assert result.best_move_san == "Nc3"
