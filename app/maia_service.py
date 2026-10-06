from __future__ import annotations

import asyncio
from collections import OrderedDict
import json
import os
from pathlib import Path
import subprocess
import threading

import chess

from app.chess_service import ChessRuleError, position_state
from app.models import HumanAnalysis, HumanCandidate, HumanReply, MaiaProfile, PositionState


class MaiaService:
    def __init__(self, runtime: str, command: list[str]) -> None:
        self.runtime = Path(runtime)
        self.command = command
        self._process: subprocess.Popen | None = None
        self._lock = asyncio.Lock()
        self._serial = 0
        self._error = ""
        self._cache: OrderedDict[tuple, dict] = OrderedDict()

    @property
    def available(self) -> bool:
        return bool(self.command and Path(self.command[0]).is_file() and all(
            (self.runtime / "models" / f"maia3-{model}.pt").is_file() for model in ("5m", "79m")
        ))

    def _start_sync(self) -> subprocess.Popen:
        if self._process is not None and self._process.poll() is None:
            return self._process
        if not self.available:
            raise RuntimeError("Maia-3 non è disponibile. Prepara il runtime locale e riapri Yomi.")
        self._error = ""
        process = subprocess.Popen(
            self.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", bufsize=1,
            env={**os.environ, "MAIA_RUNTIME_DIR": str(self.runtime), "PYTHONUTF8": "1"},
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        self._process = process
        def collect_errors() -> None:
            for line in process.stderr:
                self._error = (self._error + line)[-4000:]
        threading.Thread(target=collect_errors, daemon=True).start()
        return process

    def _request_sync(self, request: dict) -> dict:
        process = self._start_sync()
        process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()
        line = process.stdout.readline(160_001)
        if not line or len(line) > 160_000:
            raise RuntimeError("Il servizio Maia si è arrestato. Riprova o riapri Yomi.")
        response = json.loads(line)
        if response.get("id") != request["id"]:
            raise RuntimeError("Risposta Maia non corrispondente alla richiesta.")
        if response.get("error"):
            raise RuntimeError("Maia-3: " + str(response["error"]))
        if response.get("fen") != request["fen"] or response.get("model") != request["model"]:
            raise RuntimeError("Risposta Maia riferita a una posizione o modello diversi.")
        return response

    async def predict(self, board: chess.Board, profile: MaiaProfile, operation: str = "analyze") -> dict:
        moves = [move.uci() for move in board.move_stack]
        key = (board.root().fen(), tuple(moves), profile.maia_model, profile.white_elo, profile.black_elo)
        async with self._lock:
            if operation == "analyze" and key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            self._serial += 1
            request = {
                "id": self._serial, "operation": operation, "fen": board.fen(),
                "initial_fen": board.root().fen(), "moves_uci": moves,
                "model": profile.maia_model, "white_elo": profile.white_elo, "black_elo": profile.black_elo,
            }
            try:
                response = await asyncio.wait_for(asyncio.to_thread(self._request_sync, request), timeout=60)
            except (TimeoutError, OSError, ValueError) as exc:
                await asyncio.to_thread(self._close_sync)
                raise RuntimeError("Maia-3 non ha risposto correttamente. Riprova.") from exc
            for candidate in response["candidates"]:
                if chess.Move.from_uci(candidate["uci"]) not in board.legal_moves:
                    raise RuntimeError("Maia ha restituito una candidata illegale.")
            if operation == "analyze":
                self._cache[key] = response
                if len(self._cache) > 64:
                    self._cache.popitem(last=False)
            return response

    @staticmethod
    def candidates(board: chess.Board, response: dict) -> list[HumanCandidate]:
        return [HumanCandidate(
            rank=rank, uci=item["uci"], san=board.san(chess.Move.from_uci(item["uci"])),
            move_probability_percent=round(float(item["probability"]) * 100, 2),
            win_percent=item["wdl"][0] / 10, draw_percent=item["wdl"][1] / 10,
            loss_percent=item["wdl"][2] / 10,
        ) for rank, item in enumerate(response["candidates"], start=1)]

    async def analyze(self, board: chess.Board, profile: MaiaProfile, include_replies: bool) -> HumanAnalysis:
        response = await self.predict(board, profile)
        candidates = self.candidates(board, response)
        replies = []
        if include_replies:
            for candidate in candidates:
                reply_board = board.copy()
                reply_board.push_uci(candidate.uci)
                reply_candidates = []
                if not reply_board.is_game_over(claim_draw=True):
                    reply_candidates = self.candidates(reply_board, await self.predict(reply_board, profile))
                replies.append(HumanReply(
                    after_uci=candidate.uci, after_san=candidate.san,
                    side_to_move="white" if reply_board.turn else "black", candidates=reply_candidates,
                ))
        return HumanAnalysis(
            fen=board.fen(), model=profile.maia_model, white_elo=profile.white_elo,
            black_elo=profile.black_elo, device=response["device"], candidates=candidates, replies=replies,
        )

    async def play(self, board: chess.Board, profile: MaiaProfile) -> PositionState:
        if board.is_game_over(claim_draw=True):
            raise ChessRuleError("La partita è già terminata.")
        response = await self.predict(board, profile, "play")
        uci = response.get("move_uci")
        move = chess.Move.from_uci(uci) if uci else None
        if move is None or move not in board.legal_moves:
            raise RuntimeError("Maia non ha restituito una mossa valida.")
        san = board.san(move)
        board.push(move)
        return position_state(board, san, move.uci())

    def _close_sync(self) -> None:
        process, self._process = self._process, None
        if process is None or process.poll() is not None:
            return
        try:
            process.stdin.close()
            process.wait(timeout=2)
        except (OSError, subprocess.TimeoutExpired):
            process.kill()
            process.wait(timeout=2)

    async def close(self) -> None:
        await asyncio.to_thread(self._close_sync)
