"""Local JSON worker using the unmodified, pinned Maia-3 inference package."""
from __future__ import annotations

import gc
import json
import os
from pathlib import Path
import sys

import chess
import torch
from maia3.uci import Maia3UCIEngine, parse_args


def main() -> None:
    torch.set_num_threads(max(1, min(4, int(os.getenv("MAIA_THREADS", "4")))))
    runtime = Path(os.environ["MAIA_RUNTIME_DIR"])
    requested_device = os.getenv("MAIA_DEVICE", "auto")
    device = ("cuda" if torch.cuda.is_available() else "cpu") if requested_device == "auto" else requested_device
    engines: dict[str, Maia3UCIEngine] = {}
    for line in sys.stdin:
        request: dict = {}
        try:
            request = json.loads(line)
            model = request["model"]
            if model not in ("5m", "79m"):
                raise ValueError("Modello Maia non supportato.")
            if model not in engines:
                checkpoint = runtime / "models" / f"maia3-{model}.pt"
                if not checkpoint.is_file():
                    raise ValueError("Pesi Maia non disponibili. Prepara il runtime locale.")
                cfg = parse_args([
                    "--model", f"maia3-{model}", "--checkpoint-path", str(checkpoint),
                    "--device", device, "--use-uci-history", "--no-use-amp", "--multipv", "3",
                ])
                engine = Maia3UCIEngine(cfg)
                engine.ensure_model_loaded()
                engines[model] = engine
            engine = engines[model]
            board = chess.Board(request["initial_fen"])
            for uci in request["moves_uci"]:
                if chess.Move.from_uci(uci) not in board.legal_moves:
                    raise ValueError("Storico Maia non valido.")
                board.push_uci(uci)
            if board.fen() != request["fen"]:
                raise ValueError("Posizione Maia incoerente con lo storico.")
            engine.cmd_position("position fen " + request["initial_fen"] + " moves " + " ".join(request["moves_uci"]))
            white_elo, black_elo = request["white_elo"], request["black_elo"]
            engine.self_elo = white_elo if board.turn else black_elo
            engine.oppo_elo = black_elo if board.turn else white_elo
            # Analysis uses argmax and cannot consume the random stream used for play.
            engine.temperature = 1.0 if request["operation"] == "play" else 0.0
            move, candidates = engine.score_moves()
            result = {
                "id": request["id"], "fen": board.fen(), "model": model, "device": device,
                "move_uci": move.uci() if move else None,
                "candidates": [
                    {"uci": item["move"].uci(), "probability": item["policy"], "wdl": item["wdl"]}
                    for item in candidates
                ],
            }
        except Exception as exc:
            result = {"id": request.get("id"), "error": str(exc)}
        print(json.dumps(result, ensure_ascii=True), flush=True)
    engines.clear()
    gc.collect()


if __name__ == "__main__":
    main()
