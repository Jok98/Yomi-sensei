from __future__ import annotations

import asyncio
from collections import Counter
import json
import os

import chess

from app.chess_service import _classification_for_loss, _classification_response, parse_board
from app.library import Library, now
from app.models import AnalyzeResponse, MaiaProfile


def white_score(evaluation: str, side: str) -> float:
    if evaluation.startswith("#"):
        relative = -10 if evaluation[1:].startswith("-") else 10
    else:
        relative = float(evaluation)
    return relative if side == "white" else -relative


class Reviews:
    def __init__(self, library: Library, stockfish, codex, maia=None):
        self.library = library
        self.stockfish = stockfish
        self.codex = codex
        self.maia = maia
        self.tasks: dict[str, asyncio.Task] = {}
        library.recover_reviews()

    def ensure(self, game_id: str, run_agent: bool = False) -> dict:
        start = self.library.claim_review(game_id)
        if not start and run_agent:
            start = self.library.resume_review(game_id)
        if start:
            self.tasks[game_id] = asyncio.create_task(self._process(game_id))
        elif run_agent and game_id not in self.tasks:
            review = self.library.review(game_id)
            if review and review["state"] == "complete" and not review["agent_attempted"]:
                self.tasks[game_id] = asyncio.create_task(self._agent(game_id))
        return self.library.review(game_id)

    async def _process(self, game_id: str):
        try:
            game = self.library.open(game_id)
            snapshot = game["snapshot"]
            moves = [move["uci"] for move in snapshot["moves"]]
            previous = self.library.review(game_id)["report"]
            depth = previous["depth"] if previous else min(24, max(8, int(os.getenv("YOMI_REVIEW_DEPTH", "12"))))
            points = previous.get("points", []) if previous else []
            for ply in range(len(points), len(moves) + 1):
                board = parse_board(game["frames"][ply]["fen"], snapshot["initial_fen"], moves[:ply])
                if ply == len(moves) and board.is_game_over(claim_draw=True):
                    result = game["result"]
                    value = 0 if result == "1/2-1/2" else 10 if result == "1-0" else -10
                    analysis = AnalyzeResponse(fen=board.fen(), side_to_move="white" if board.turn else "black", depth=depth, candidates=[])
                    score = "½" if result == "1/2-1/2" else "M0" if board.is_checkmate() else result
                else:
                    analysis = await self.stockfish.analyze(board.fen(), depth, False, snapshot["initial_fen"], moves[:ply], claim_draw=False)
                    if not analysis.candidates:
                        raise RuntimeError("Stockfish non ha restituito la valutazione della posizione.")
                    score = analysis.candidates[0].evaluation
                    value = white_score(score, analysis.side_to_move)
                points.append({"ply": ply, "white_score": value, "evaluation": score, "analysis": analysis.model_dump()})
                progress = round(100 * (ply + 1) / (len(moves) + 1))
                self.library.review_update(game_id, progress=progress, report={"depth": depth, "points": points})
                await asyncio.sleep(0)
            moments = []
            counts = {"white": Counter(), "black": Counter()}
            for index, record in enumerate(game["records"]):
                best = points[index]["analysis"]["candidates"][0]
                next_candidates = points[index + 1]["analysis"]["candidates"]
                if not next_candidates:
                    mover_expected = 50 if game["result"] == "1/2-1/2" else 100 if game["result"] == ("1-0" if record["color"] == "white" else "0-1") else 0
                else:
                    mover_expected = 100 - next_candidates[0]["expected_score_percent"]
                loss = max(0, (best["expected_score_percent"] - mover_expected) / 100)
                code = "best" if record["uci"] == best["uci"] else _classification_for_loss(loss)
                counts[record["color"]][code] += 1
                classification = _classification_response(code, record["san"], loss, best["san"]).model_dump()
                points[index + 1]["classification"] = classification
                if code in ("inaccuracy", "mistake", "blunder") and record["uci"] != best["uci"]:
                    moments.append({"ply": index, "color": record["color"], "played": record["san"], "best": best,
                                    "loss": loss, "classification": classification, "human_probability": None})
            moments.sort(key=lambda item: item["loss"], reverse=True)
            critical = moments[:5]
            if self.maia and self.maia.available:
                profile = MaiaProfile.model_validate(snapshot["options"]["profile"])
                for moment in critical:
                    ply = moment["ply"]
                    board = parse_board(game["frames"][ply]["fen"], snapshot["initial_fen"], moves[:ply])
                    try:
                        human = await self.maia.analyze(board, profile, False, claim_draw=False)
                        points[ply]["analysis"]["human"] = human.model_dump()
                        candidate = next((c for c in human.candidates if c.uci == moves[ply]), None)
                        if candidate:
                            moment["human_probability"] = candidate.move_probability_percent
                    except RuntimeError:
                        pass
            exercises = []
            for moment in moments:
                if snapshot["options"]["mode"] == "computer" and moment["color"] != snapshot["options"]["player_color"]:
                    continue
                ply = moment["ply"]
                best = moment["best"]
                candidates = points[ply]["analysis"]["candidates"]
                acceptable = [best["uci"]]
                if not best["evaluation"].startswith("#"):
                    acceptable = [c["uci"] for c in candidates if not c["evaluation"].startswith("#") and float(c["evaluation"]) >= float(best["evaluation"]) - .15]
                exercises.append({"id": f"{game_id}:{ply}", "game_id": game_id, "game_title": game["title"], "ply": ply,
                                  "fen": game["frames"][ply]["fen"], "initial_fen": snapshot["initial_fen"], "moves_uci": moves[:ply],
                                  "position": game["frames"][ply], "best_move": best["uci"], "best_san": best["san"],
                                  "acceptable_moves": acceptable, "variation": best["principal_variation"], "played": moment["played"],
                                  "classification": moment["classification"], "depth": depth})
            report = {"depth": depth, "created_at": now(), "points": points, "moments": critical,
                      "counts": {color: dict(values) for color, values in counts.items()}, "exercise_count": len(exercises)}
            self.library.add_exercises(game_id, exercises)
            self.library.review_update(game_id, state="complete", report=report, progress=100, error=None)
            await self._agent(game_id)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.library.review_update(game_id, state="failed", error=str(exc))
        finally:
            self.tasks.pop(game_id, None)

    async def _agent(self, game_id: str):
        try:
            if not self.codex.available:
                self.library.review_update(game_id, agent_state="unavailable", agent_error="Codex CLI non disponibile: il report del motore è salvato. La spiegazione potrà essere generata una volta quando il coach sarà disponibile.")
                return
            status = await self.codex.status()
            if not status.get("authenticated"):
                self.library.review_update(game_id, agent_state="unavailable", agent_error="Accedi a Codex CLI con ChatGPT per generare la spiegazione. Il report del motore è già salvato; nessun tentativo del coach è stato consumato.")
                return
            if not self.library.claim_agent(game_id):
                return
            game = self.library.open(game_id)
            report = self.library.review(game_id)["report"]
            summary = await self.codex.review_game(self.library.export(game_id), report)
            self.library.review_update(game_id, agent_state="done", summary=summary, agent_error=None)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.library.review_update(game_id, agent_state="failed", agent_error=str(exc))
        finally:
            self.tasks.pop(game_id, None)

    async def close(self):
        tasks = list(self.tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
