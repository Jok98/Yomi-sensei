from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import io
import json
from pathlib import Path
import sqlite3
import uuid

import chess
import chess.pgn
import chess.svg

from app.chess_service import ChessRuleError, parse_board, position_state
from app.library_models import BoardMark, GameSnapshot, SaveGameRequest, SavedMove, Variation


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def replay(snapshot: GameSnapshot) -> tuple[chess.Board, list[dict], list[dict]]:
    board = parse_board(snapshot.initial_fen)
    frames = [position_state(board).model_dump()]
    moves = []
    for index, saved in enumerate(snapshot.moves):
        if board.is_game_over(claim_draw=False):
            raise ChessRuleError("Lo storico continua dopo la fine della partita.")
        move = chess.Move.from_uci(saved.uci)
        if move not in board.legal_moves:
            raise ChessRuleError(f"Mossa {index + 1} illegale: {saved.uci}.")
        san = board.san(move)
        captured = board.piece_at(move.to_square)
        if board.is_en_passant(move):
            captured = chess.Piece(chess.PAWN, not board.turn)
        color = "white" if board.turn else "black"
        before = frames[-1]
        board.push(move)
        after = position_state(board, san, saved.uci).model_dump()
        frames.append(after)
        moves.append({
            "id": index + 1, "before": before, "after": after, "uci": saved.uci,
            "san": san, "color": color, "computer": saved.computer,
            "engine": saved.engine, "classification": saved.classification.model_dump() if saved.classification else None,
            "captured_piece": captured.symbol() if captured else None,
        })
    return board, frames, moves


def validate_snapshot(snapshot: GameSnapshot) -> chess.Board:
    board, frames, _ = replay(snapshot)
    for variation in snapshot.variations:
        if variation.root_ply > len(snapshot.moves):
            raise ChessRuleError("La variante inizia fuori dallo storico.")
        root = parse_board(frames[variation.root_ply]["fen"])
        for uci in variation.moves_uci:
            move = chess.Move.from_uci(uci)
            if move not in root.legal_moves or root.is_game_over(claim_draw=False):
                raise ChessRuleError("La variante contiene una mossa illegale.")
            root.push(move)
    return board


class Library:
    def __init__(self, directory: Path):
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / "yomi.sqlite3"
        with self.connection() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS games (
                    id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    title TEXT NOT NULL, result TEXT, finish_reason TEXT,
                    snapshot TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reviews (
                    game_id TEXT PRIMARY KEY REFERENCES games(id),
                    state TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0,
                    report TEXT, error TEXT,
                    agent_attempted INTEGER NOT NULL DEFAULT 0,
                    agent_state TEXT NOT NULL DEFAULT 'pending',
                    summary TEXT, agent_error TEXT
                );
                CREATE TABLE IF NOT EXISTS exercises (
                    id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id),
                    payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
                    successes INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0,
                    due_at TEXT NOT NULL, last_attempt TEXT
                );
                PRAGMA user_version=1;
            """)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def _row(self, db, game_id: str):
        row = db.execute("SELECT * FROM games WHERE id=?", (game_id,)).fetchone()
        if row is None:
            raise ChessRuleError("Partita non trovata nell'archivio.")
        return row

    def save(self, request: SaveGameRequest) -> dict:
        snapshot = request.snapshot
        board = validate_snapshot(snapshot)
        game_id = request.game_id or str(uuid.uuid4())
        timestamp = now()
        outcome = board.outcome(claim_draw=True)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            old = self._row(db, game_id) if request.game_id else None
            if old and request.revision <= old["revision"]:
                return self._summary(old)
            if old and old["result"]:
                previous = json.loads(old["snapshot"])
                if previous["initial_fen"] != snapshot.initial_fen or [m["uci"] for m in previous["moves"]] != [m.uci for m in snapshot.moves]:
                    raise ChessRuleError("Una partita conclusa conserva la linea originale; usa una variante o una nuova partita.")
            result = old["result"] if old and old["result"] else outcome.result() if outcome else None
            reason = old["finish_reason"] if old and old["finish_reason"] else "natural" if result else None
            title = snapshot.title.strip() or f"{snapshot.options.engine.title() if snapshot.options.mode == 'computer' else 'Partita libera'} · {timestamp[:10]}"
            snapshot.title = title
            db.execute("""INSERT INTO games VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,
                updated_at=excluded.updated_at, title=excluded.title, result=excluded.result,
                finish_reason=excluded.finish_reason, snapshot=excluded.snapshot""",
                (game_id, request.revision, old["created_at"] if old else timestamp, timestamp,
                 title, result, reason, snapshot.model_dump_json(by_alias=True)))
            return self._summary(self._row(db, game_id))

    @staticmethod
    def _summary(row) -> dict:
        snapshot = json.loads(row["snapshot"])
        return {
            "id": row["id"], "revision": row["revision"], "title": row["title"],
            "created_at": row["created_at"], "updated_at": row["updated_at"],
            "result": row["result"], "finish_reason": row["finish_reason"],
            "plies": len(snapshot["moves"]), "options": snapshot["options"],
        }

    def list(self, query: str = "") -> list[dict]:
        with self.connection() as db:
            rows = db.execute("SELECT * FROM games ORDER BY updated_at DESC LIMIT 500").fetchall()
            return [self._summary(row) for row in rows if query.casefold() in row["title"].casefold()]

    def open(self, game_id: str) -> dict:
        with self.connection() as db:
            row = self._row(db, game_id)
            snapshot = GameSnapshot.model_validate_json(row["snapshot"])
            board, frames, moves = replay(snapshot)
            if row["result"]:
                final = frames[-1]
                final["is_game_over"] = True
                final["result"] = row["result"]
                if not board.is_game_over(claim_draw=True):
                    final["status"] = {"resignation": "Partita conclusa per abbandono", "draw": "Patta concordata", "timeout": "Partita conclusa per tempo", "import": "Partita importata conclusa"}.get(row["finish_reason"], "Partita conclusa") + f" · {row['result']}"
            variations = []
            for item in snapshot.variations:
                root = frames[item.root_ply]["fen"]
                branch = GameSnapshot(initial_fen=root, moves=[SavedMove(uci=uci) for uci in item.moves_uci])
                _, branch_frames, branch_moves = replay(branch)
                variations.append({**item.model_dump(), "frames": branch_frames, "records": branch_moves})
            review = self._review(db, game_id)
            if review and review["state"] == "complete" and review["report"]:
                points = review["report"].get("points", [])
                for index, record in enumerate(moves):
                    if index + 1 < len(points) and points[index + 1].get("classification"):
                        record["classification"] = points[index + 1]["classification"]
            return {**self._summary(row), "snapshot": snapshot.model_dump(by_alias=True),
                    "frames": frames, "records": moves, "variations": variations,
                    "review": review}

    def finish(self, game_id: str, reason: str, color: str) -> dict:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self._row(db, game_id)
            if row["result"]:
                return self._summary(row)
            snapshot = GameSnapshot.model_validate_json(row["snapshot"])
            board, _, _ = replay(snapshot)
            loser = chess.WHITE if color == "white" else chess.BLACK
            if reason == "timeout" and board.turn != loser:
                raise ChessRuleError("Il colore fuori tempo non è al tratto.")
            draw = reason == "draw" or (reason == "timeout" and board.has_insufficient_material(not loser))
            result = "1/2-1/2" if draw else "0-1" if loser == chess.WHITE else "1-0"
            if snapshot.options.clock:
                snapshot.options.clock.paused = True
            db.execute("UPDATE games SET result=?, finish_reason=?, revision=revision+1, updated_at=?, snapshot=? WHERE id=?",
                       (result, reason, now(), snapshot.model_dump_json(by_alias=True), game_id))
            return self._summary(self._row(db, game_id))

    def import_games(self, pgn: str, fen: str | None) -> list[dict]:
        if fen:
            board = parse_board(fen)
            snapshot = GameSnapshot(initial_fen=board.fen(), title="Posizione importata")
            return [self.save(SaveGameRequest(revision=1, snapshot=snapshot))]
        stream = io.StringIO(pgn)
        snapshots = []
        results = []
        while game := chess.pgn.read_game(stream):
            if len(snapshots) >= 20:
                raise ChessRuleError("Importa al massimo 20 partite per file.")
            if game.errors:
                raise ChessRuleError(f"PGN non valido: {game.errors[0]}")
            board = game.board()
            players = [game.headers.get(color) for color in ("White", "Black")]
            title = game.headers.get("Event", "?")
            if title == "?":
                title = f"{players[0] if players[0] not in (None, '?') else 'Bianco'} – {players[1] if players[1] not in (None, '?') else 'Nero'}"
            snapshot = GameSnapshot(initial_fen=board.fen(), title=title[:100],
                                    tags=dict(game.headers), moves=[SavedMove(uci=m.uci()) for m in game.mainline_moves()])
            node = game
            ply = 0
            while True:
                if node.comment:
                    snapshot.comments[f"main:{ply}"] = node.comment[:4000]
                arrows = node.arrows()
                if arrows:
                    snapshot.marks[f"main:{ply}"] = [BoardMark.model_validate({"from": chess.square_name(a.tail), "to": chess.square_name(a.head)}) for a in arrows[:64]]
                for side in node.variations[1:]:
                    branch = []
                    branch_node = side
                    branch_id = str(uuid.uuid4())
                    while branch_node is not None:
                        branch.append(branch_node.move.uci())
                        key = f"{branch_id}:{len(branch)}"
                        if branch_node.comment:
                            snapshot.comments[key] = branch_node.comment[:4000]
                        if branch_node.arrows():
                            snapshot.marks[key] = [BoardMark.model_validate({"from": chess.square_name(a.tail), "to": chess.square_name(a.head)}) for a in branch_node.arrows()[:64]]
                        branch_node = branch_node.variations[0] if branch_node.variations else None
                    if len(branch) > 200:
                        raise ChessRuleError("Una variante importata supera 200 mosse.")
                    snapshot.variations.append(Variation(id=branch_id, root_ply=ply, moves_uci=branch))
                if not node.variations:
                    break
                node = node.variations[0]
                ply += 1
            snapshot = GameSnapshot.model_validate(snapshot.model_dump(by_alias=True))
            validate_snapshot(snapshot)
            snapshots.append(snapshot)
            results.append(game.headers.get("Result", "*"))
        if not snapshots:
            raise ChessRuleError("Incolla una partita PGN valida o una FEN.")
        # Validate the complete batch before the first write.
        saved = []
        for snapshot, result in zip(snapshots, results):
            item = self.save(SaveGameRequest(revision=1, snapshot=snapshot))
            if result in ("1-0", "0-1", "1/2-1/2") and not item["result"]:
                with self.connection() as db:
                    db.execute("UPDATE games SET result=?, finish_reason='import' WHERE id=?", (result, item["id"]))
                item = self.open(item["id"])
            saved.append({key: item[key] for key in ("id", "title", "result")})
        return saved

    def export(self, game_id: str) -> str:
        data = self.open(game_id)
        snapshot = GameSnapshot.model_validate(data["snapshot"])
        board, _, _ = replay(snapshot)
        game = chess.pgn.Game.from_board(board)
        game.headers.update(snapshot.tags)
        game.headers["Event"] = snapshot.title
        game.headers["Result"] = data["result"] or "*"
        game.setup(chess.Board(snapshot.initial_fen))
        nodes = [game, *list(game.mainline())]
        for ply, node in enumerate(nodes):
            key = f"main:{ply}"
            node.comment = snapshot.comments.get(key, "")
            node.set_arrows([chess.svg.Arrow(chess.parse_square(mark.from_square), chess.parse_square(mark.to), color="red") for mark in snapshot.marks.get(key, [])])
        for variation in snapshot.variations:
            node = nodes[variation.root_ply]
            for index, uci in enumerate(variation.moves_uci):
                node = node.add_variation(chess.Move.from_uci(uci))
                key = f"{variation.id}:{index + 1}"
                node.comment = snapshot.comments.get(key, "")
                node.set_arrows([chess.svg.Arrow(chess.parse_square(mark.from_square), chess.parse_square(mark.to), color="red") for mark in snapshot.marks.get(key, [])])
        return str(game.accept(chess.pgn.StringExporter(headers=True, variations=True, comments=True)))

    @staticmethod
    def _review(db, game_id) -> dict | None:
        row = db.execute("SELECT * FROM reviews WHERE game_id=?", (game_id,)).fetchone()
        if row is None:
            return None
        return {"game_id": game_id, "state": row["state"], "progress": row["progress"],
                "report": json.loads(row["report"]) if row["report"] else None,
                "error": row["error"], "agent_attempted": bool(row["agent_attempted"]),
                "agent_state": row["agent_state"], "summary": row["summary"], "agent_error": row["agent_error"]}

    def review(self, game_id: str) -> dict | None:
        with self.connection() as db:
            self._row(db, game_id)
            return self._review(db, game_id)

    def claim_review(self, game_id: str) -> bool:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            game = self._row(db, game_id)
            if not game["result"]:
                raise ChessRuleError("La revisione finale richiede una partita conclusa.")
            return db.execute("INSERT OR IGNORE INTO reviews(game_id,state) VALUES (?, 'running')", (game_id,)).rowcount == 1

    def review_update(self, game_id: str, **changes):
        allowed = {"state", "progress", "report", "error", "agent_state", "summary", "agent_error"}
        if not changes.keys() <= allowed:
            raise ValueError("Campo revisione non consentito.")
        if "report" in changes:
            changes["report"] = json.dumps(changes["report"], ensure_ascii=False)
        with self.connection() as db:
            db.execute(f"UPDATE reviews SET {', '.join(key + '=?' for key in changes)} WHERE game_id=?", (*changes.values(), game_id))

    def claim_agent(self, game_id: str) -> bool:
        with self.connection() as db:
            return db.execute("UPDATE reviews SET agent_attempted=1,agent_state='running' WHERE game_id=? AND agent_attempted=0 AND state='complete'", (game_id,)).rowcount == 1

    def recover_reviews(self):
        with self.connection() as db:
            db.execute("UPDATE reviews SET state='interrupted',error='Analisi motore interrotta: puoi riprenderla.' WHERE state='running'")
            db.execute("UPDATE reviews SET agent_state='failed',agent_error='Il processo si è chiuso durante la chiamata. Il tentativo non viene ripetuto automaticamente.' WHERE agent_state='running'")

    def resume_review(self, game_id: str) -> bool:
        with self.connection() as db:
            return db.execute("UPDATE reviews SET state='running',error=NULL WHERE game_id=? AND state IN ('failed','interrupted') AND agent_attempted=0", (game_id,)).rowcount == 1

    def add_exercises(self, game_id: str, exercises: list[dict]):
        with self.connection() as db:
            for exercise in exercises:
                db.execute("INSERT OR IGNORE INTO exercises(id,game_id,payload,due_at) VALUES(?,?,?,?)",
                           (exercise["id"], game_id, json.dumps(exercise, ensure_ascii=False), now()))

    def exercises(self) -> list[dict]:
        with self.connection() as db:
            return [{**json.loads(row["payload"]), "game_title": row["current_title"], **{key: row[key] for key in ("attempts", "successes", "streak", "due_at", "last_attempt")}}
                    for row in db.execute("SELECT e.*, g.title AS current_title FROM exercises e JOIN games g ON g.id=e.game_id ORDER BY e.due_at LIMIT 500")]

    def attempt(self, exercise_id: str, move_uci: str) -> dict:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM exercises WHERE id=?", (exercise_id,)).fetchone()
            if row is None:
                raise ChessRuleError("Esercizio non trovato.")
            payload = json.loads(row["payload"])
            board = parse_board(payload["fen"], payload["initial_fen"], payload["moves_uci"])
            move = chess.Move.from_uci(move_uci)
            if move not in board.legal_moves:
                raise ChessRuleError("Mossa illegale nell'esercizio.")
            correct = move_uci in payload["acceptable_moves"]
            streak = row["streak"] + 1 if correct else 0
            delay = timedelta(days=(1, 3, 7, 14)[min(streak - 1, 3)]) if correct else timedelta(hours=4)
            timestamp = now()
            due = (datetime.now(timezone.utc) + delay).isoformat()
            db.execute("UPDATE exercises SET attempts=attempts+1,successes=successes+?,streak=?,due_at=?,last_attempt=? WHERE id=?",
                       (int(correct), streak, due, timestamp, exercise_id))
            san = board.san(move)
            board.push(move)
            return {"correct": correct, "position": position_state(board, san, move_uci).model_dump(), "due_at": due, "streak": streak}
