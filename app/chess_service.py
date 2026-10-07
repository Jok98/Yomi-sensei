from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path

import chess
import chess.engine

from app.models import (
    AnalyzeResponse,
    CandidateMove,
    LegalMove,
    MoveClassificationResponse,
    PositionState,
    ReplyAnalysis,
)


class ChessRuleError(ValueError):
    """Raised when a supplied position or move is invalid."""


COMPUTER_LEVELS: dict[str, dict[str, float | int]] = {
    "easy": {"elo": 1350, "skill": 0, "time": 0.08},
    "medium": {"elo": 1700, "skill": 6, "time": 0.18},
    "hard": {"elo": 2100, "skill": 13, "time": 0.35},
    "expert": {"elo": 2500, "skill": 18, "time": 0.65},
}

CLASSIFICATION_DEPTH = 12
CLASSIFICATION_LABELS: dict[str, tuple[str, str]] = {
    "book": ("Da manuale", "♜"),
    "best": ("Migliore", "★"),
    "excellent": ("Eccellente", "!"),
    "good": ("Buona", "✓"),
    "inaccuracy": ("Imprecisione", "?!"),
    "mistake": ("Errore", "?"),
    "blunder": ("Grave errore", "??"),
}

OPENING_LINES = (
    "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6",
    "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5",
    "e2e4 e7e5 g1f3 b8c6 d2d4 e5d4",
    "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4",
    "e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4",
    "e2e4 e7e6 d2d4 d7d5 b1c3",
    "e2e4 c7c6 d2d4 d7d5",
    "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6",
    "d2d4 d7d5 c2c4 c7c6",
    "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7",
    "d2d4 g8f6 g1f3 e7e6 c1f4",
    "c2c4 e7e5 b1c3 g8f6",
    "g1f3 d7d5 d2d4 g8f6",
)


def _position_key(board: chess.Board) -> str:
    return " ".join(board.fen().split()[:4])


def _build_opening_book() -> dict[str, set[str]]:
    book: dict[str, set[str]] = {}
    for line in OPENING_LINES:
        board = chess.Board()
        for uci in line.split():
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                break
            book.setdefault(_position_key(board), set()).add(uci)
            board.push(move)
    return book


OPENING_BOOK = _build_opening_book()


def is_book_move(board: chess.Board, move: chess.Move) -> bool:
    return move.uci() in OPENING_BOOK.get(_position_key(board), set())


def parse_board(
    fen: str,
    initial_fen: str | None = None,
    moves_uci: list[str] | None = None,
) -> chess.Board:
    try:
        board = chess.Board(fen)
    except ValueError as exc:
        raise ChessRuleError("La posizione FEN non è valida.") from exc
    if not board.is_valid():
        raise ChessRuleError("La posizione contiene una configurazione illegale.")
    if initial_fen is not None or moves_uci:
        replay = parse_board(initial_fen or chess.STARTING_FEN)
        for uci in moves_uci or []:
            try:
                move = chess.Move.from_uci(uci)
            except ValueError as exc:
                raise ChessRuleError("Lo storico contiene una mossa UCI non valida.") from exc
            if move not in replay.legal_moves:
                raise ChessRuleError("Lo storico contiene una mossa illegale.")
            replay.push(move)
        if replay.fen() != board.fen():
            raise ChessRuleError("Lo storico delle mosse non corrisponde alla posizione FEN.")
        return replay
    return board


def _legal_moves(board: chess.Board) -> list[LegalMove]:
    return [
        LegalMove(
            uci=move.uci(),
            from_square=chess.square_name(move.from_square),
            to_square=chess.square_name(move.to_square),
            promotion=chess.piece_symbol(move.promotion) if move.promotion else None,
        )
        for move in board.legal_moves
    ]


def _game_status(board: chess.Board) -> str:
    if board.is_checkmate():
        winner = "Nero" if board.turn == chess.WHITE else "Bianco"
        return f"Scacco matto · vince il {winner}"
    if board.is_stalemate():
        return "Patta per stallo"
    if board.is_insufficient_material():
        return "Patta per materiale insufficiente"
    if board.is_fivefold_repetition():
        return "Patta per quintupla ripetizione"
    if board.is_seventyfive_moves():
        return "Patta per la regola delle 75 mosse"
    if board.can_claim_fifty_moves():
        return "Patta reclamabile per la regola delle 50 mosse"
    if board.can_claim_threefold_repetition():
        return "Patta reclamabile per triplice ripetizione"
    if board.is_check():
        return "Scacco · muove il Bianco" if board.turn else "Scacco · muove il Nero"
    return "Muove il Bianco" if board.turn else "Muove il Nero"


def position_state(
    board: chess.Board,
    last_move_san: str | None = None,
    last_move_uci: str | None = None,
    claim_draw: bool = True,
) -> PositionState:
    outcome = board.outcome(claim_draw=claim_draw)
    return PositionState(
        fen=board.fen(),
        legal_moves=_legal_moves(board),
        turn="white" if board.turn else "black",
        status=_game_status(board) if claim_draw or outcome else f"Studio · muove il {'Bianco' if board.turn else 'Nero'}",
        is_game_over=outcome is not None,
        is_checkmate=board.is_checkmate(),
        result=outcome.result() if outcome else None,
        last_move_san=last_move_san,
        last_move_uci=last_move_uci,
    )


def new_game() -> PositionState:
    return position_state(chess.Board())


def apply_move(
    fen: str,
    from_square: str,
    to_square: str,
    promotion: str | None,
    initial_fen: str | None = None,
    moves_uci: list[str] | None = None,
    study: bool = False,
) -> PositionState:
    board = parse_board(fen, initial_fen, moves_uci)
    suffix = promotion or ""
    try:
        move = chess.Move.from_uci(f"{from_square}{to_square}{suffix}")
    except ValueError as exc:
        raise ChessRuleError("La mossa non è valida.") from exc

    if move not in board.legal_moves:
        raise ChessRuleError("Questa mossa non è legale nella posizione corrente.")

    san = board.san(move)
    board.push(move)
    return position_state(board, last_move_san=san, last_move_uci=move.uci(), claim_draw=not study)


def _format_score(score: chess.engine.Score) -> str:
    mate = score.mate()
    if mate is not None:
        return f"#{mate:+d}"
    centipawns = score.score(mate_score=100_000) or 0
    return f"{centipawns / 100:+.2f}"


def _principal_variation(board: chess.Board, moves: list[chess.Move], limit: int = 8) -> list[str]:
    line_board = board.copy(stack=False)
    variation: list[str] = []
    for move in moves[:limit]:
        if move not in line_board.legal_moves:
            break
        variation.append(line_board.san(move))
        line_board.push(move)
    return variation


def _candidate_moves(board: chess.Board, infos: list[dict]) -> list[CandidateMove]:
    candidates: list[CandidateMove] = []
    for rank, info in enumerate(infos, start=1):
        pv = info.get("pv", [])
        if not pv:
            continue
        move = pv[0]
        relative_score = info["score"].pov(board.turn)
        wdl = relative_score.wdl(model="sf", ply=board.ply())
        candidates.append(
            CandidateMove(
                rank=rank,
                uci=move.uci(),
                san=board.san(move),
                evaluation=_format_score(relative_score),
                expected_score_percent=round(wdl.expectation() * 100, 1),
                win_percent=round(wdl.wins / 10, 1),
                draw_percent=round(wdl.draws / 10, 1),
                loss_percent=round(wdl.losses / 10, 1),
                principal_variation=_principal_variation(board, pv),
            )
        )
    return candidates


def _expected_score(score: chess.engine.PovScore, color: chess.Color, ply: int) -> float:
    return score.pov(color).wdl(model="sf", ply=ply).expectation()


def _terminal_expected_score(board: chess.Board, color: chess.Color) -> float | None:
    outcome = board.outcome(claim_draw=True)
    if outcome is None:
        return None
    if outcome.winner is None:
        return 0.5
    return 1.0 if outcome.winner == color else 0.0


def _classification_for_loss(loss: float) -> str:
    if loss <= 0.02:
        return "excellent"
    if loss <= 0.05:
        return "good"
    if loss <= 0.10:
        return "inaccuracy"
    if loss <= 0.20:
        return "mistake"
    return "blunder"


def _classification_response(
    code: str,
    played_move_san: str,
    expected_points_loss: float = 0.0,
    best_move_san: str | None = None,
) -> MoveClassificationResponse:
    label, marker = CLASSIFICATION_LABELS[code]
    return MoveClassificationResponse(
        code=code,
        label=label,
        marker=marker,
        expected_points_loss=round(max(0.0, expected_points_loss), 3),
        best_move_san=best_move_san,
        played_move_san=played_move_san,
    )


class StockfishService:
    def __init__(self, executable_path: str, default_depth: int = 16) -> None:
        self.executable_path = executable_path
        self.default_depth = default_depth
        self._engine: chess.engine.SimpleEngine | None = None
        self._lock = asyncio.Lock()
        self._analysis_cache: dict[tuple, AnalyzeResponse] = {}

    @property
    def available(self) -> bool:
        return Path(self.executable_path).exists()

    def _ensure_engine(self) -> chess.engine.SimpleEngine:
        if self._engine is None:
            if not self.available:
                raise RuntimeError(
                    "Stockfish non è disponibile. Prepara il runtime locale o configura STOCKFISH_PATH."
                )
            self._engine = chess.engine.SimpleEngine.popen_uci(
                self.executable_path,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        return self._engine

    async def analyze(
        self,
        fen: str,
        depth: int | None = None,
        include_replies: bool = True,
        initial_fen: str | None = None,
        moves_uci: list[str] | None = None,
        claim_draw: bool = True,
    ) -> AnalyzeResponse:
        board = parse_board(fen, initial_fen, moves_uci)
        requested_depth = depth or self.default_depth
        if board.is_game_over(claim_draw=claim_draw):
            return AnalyzeResponse(
                fen=board.fen(),
                side_to_move="white" if board.turn else "black",
                depth=requested_depth,
                candidates=[],
                replies=[],
            )

        context_key = (board.root().fen(), tuple(move.uci() for move in board.move_stack), requested_depth, claim_draw)
        key = (*context_key, include_replies)
        async with self._lock:
            if key in self._analysis_cache:
                return self._analysis_cache[key].model_copy(deep=True)
            base = self._analysis_cache.get((*context_key, False))
            if base:
                candidates = base.model_copy(deep=True).candidates
            else:
                infos = await asyncio.to_thread(self._analyze_sync, board, requested_depth)
                candidates = _candidate_moves(board, infos)
            replies: list[ReplyAnalysis] = []
            if include_replies:
                for candidate in candidates:
                    reply_board = board.copy()
                    reply_board.push_uci(candidate.uci)
                    reply_candidates: list[CandidateMove] = []
                    if not reply_board.is_game_over(claim_draw=claim_draw):
                        reply_infos = await asyncio.to_thread(
                            self._analyze_sync,
                            reply_board,
                            requested_depth,
                        )
                        reply_candidates = _candidate_moves(reply_board, reply_infos)
                    replies.append(
                        ReplyAnalysis(
                            after_uci=candidate.uci,
                            after_san=candidate.san,
                            side_to_move="white" if reply_board.turn else "black",
                            candidates=reply_candidates,
                        )
                    )

            result = AnalyzeResponse(
                fen=board.fen(),
                side_to_move="white" if board.turn else "black",
                depth=requested_depth,
                candidates=candidates,
                replies=replies,
            )
            if len(self._analysis_cache) >= 96:
                self._analysis_cache.pop(next(iter(self._analysis_cache)))
            self._analysis_cache[key] = result.model_copy(deep=True)
            return result

    def _analyze_sync(self, board: chess.Board, depth: int) -> list[dict]:
        engine = self._ensure_engine()
        result = engine.analyse(
            board,
            chess.engine.Limit(depth=depth),
            multipv=min(3, board.legal_moves.count()),
        )
        return result if isinstance(result, list) else [result]

    async def classify_move(
        self,
        fen: str,
        move_uci: str,
        depth: int | None = None,
        initial_fen: str | None = None,
        moves_uci: list[str] | None = None,
    ) -> MoveClassificationResponse:
        board = parse_board(fen, initial_fen, moves_uci)
        try:
            move = chess.Move.from_uci(move_uci)
        except ValueError as exc:
            raise ChessRuleError("La mossa da classificare non è valida.") from exc
        if move not in board.legal_moves:
            raise ChessRuleError("La mossa da classificare non è legale nella posizione indicata.")

        played_san = board.san(move)
        if is_book_move(board, move):
            return _classification_response("book", played_san)

        requested_depth = depth or min(self.default_depth, CLASSIFICATION_DEPTH)
        original_color = board.turn
        async with self._lock:
            best_info = await asyncio.to_thread(self._analyze_one_sync, board, requested_depth)
            best_line = best_info.get("pv", [])
            if not best_line:
                raise RuntimeError("Stockfish non ha restituito una linea per classificare la mossa.")
            best_move = best_line[0]
            best_move_san = board.san(best_move)
            if move == best_move:
                return _classification_response("best", played_san, best_move_san=best_move_san)

            best_expectation = _expected_score(best_info["score"], original_color, board.ply())
            played_board = board.copy()
            played_board.push(move)
            played_expectation = _terminal_expected_score(played_board, original_color)
            if played_expectation is None:
                played_info = await asyncio.to_thread(
                    self._analyze_one_sync,
                    played_board,
                    requested_depth,
                )
                played_expectation = _expected_score(
                    played_info["score"],
                    original_color,
                    played_board.ply(),
                )

        loss = max(0.0, best_expectation - played_expectation)
        return _classification_response(
            _classification_for_loss(loss),
            played_san,
            expected_points_loss=loss,
            best_move_san=best_move_san,
        )

    def _analyze_one_sync(self, board: chess.Board, depth: int) -> dict:
        engine = self._ensure_engine()
        result = engine.analyse(board, chess.engine.Limit(depth=depth))
        return result[0] if isinstance(result, list) else result

    async def evaluate_moves(
        self, board: chess.Board, moves: list[str], depth: int | None = None,
    ) -> dict[str, CandidateMove]:
        root_moves = [chess.Move.from_uci(uci) for uci in moves]
        if not root_moves:
            return {}
        if any(move not in board.legal_moves for move in root_moves):
            raise ChessRuleError("Una candidata umana non è legale.")
        async with self._lock:
            infos = await asyncio.to_thread(
                self._evaluate_moves_sync, board, root_moves, depth or self.default_depth,
            )
        return {candidate.uci: candidate for candidate in _candidate_moves(board, infos)}

    def _evaluate_moves_sync(self, board: chess.Board, moves: list[chess.Move], depth: int) -> list[dict]:
        result = self._ensure_engine().analyse(
            board, chess.engine.Limit(depth=depth), root_moves=moves, multipv=len(moves),
        )
        return result if isinstance(result, list) else [result]

    async def computer_move(
        self, fen: str, difficulty: str,
        initial_fen: str | None = None, moves_uci: list[str] | None = None,
    ) -> PositionState:
        board = parse_board(fen, initial_fen, moves_uci)
        if board.is_game_over(claim_draw=True):
            raise ChessRuleError("La partita è già terminata.")
        async with self._lock:
            move = await asyncio.to_thread(self._play_sync, board, difficulty)
        if move is None or move not in board.legal_moves:
            raise RuntimeError("Stockfish non ha restituito una mossa valida.")
        san = board.san(move)
        board.push(move)
        return position_state(board, last_move_san=san, last_move_uci=move.uci())

    def _play_sync(self, board: chess.Board, difficulty: str) -> chess.Move | None:
        engine = self._ensure_engine()
        level = COMPUTER_LEVELS.get(difficulty, COMPUTER_LEVELS["medium"])
        options: dict[str, object] = {}
        if "UCI_LimitStrength" in engine.options and "UCI_Elo" in engine.options:
            options = {"UCI_LimitStrength": True, "UCI_Elo": int(level["elo"])}
        elif "Skill Level" in engine.options:
            options = {"Skill Level": int(level["skill"])}
        result = engine.play(
            board,
            chess.engine.Limit(time=float(level["time"])),
            options=options,
        )
        return result.move

    async def close(self) -> None:
        async with self._lock:
            if self._engine is not None:
                engine = self._engine
                self._engine = None
                await asyncio.to_thread(engine.quit)
