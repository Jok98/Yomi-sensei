import asyncio
import uuid

import chess
import chess.pgn
import pytest

from app.chess_service import ChessRuleError
from app.library import Library
from app.library_models import GameSnapshot, SaveGameRequest, SavedMove, Variation
from app.models import AnalyzeResponse, CandidateMove
from app.reviews import Reviews


def save(library, moves=(), fen=chess.STARTING_FEN):
    return library.save(SaveGameRequest(revision=1, snapshot=GameSnapshot(initial_fen=fen, moves=[SavedMove(uci=uci) for uci in moves])))


def test_archive_survives_reopening_and_rejects_old_snapshots(tmp_path):
    library = Library(tmp_path)
    game = save(library, ["e2e4"])
    snapshot = GameSnapshot.model_validate(library.open(game["id"])["snapshot"])
    snapshot.moves.append(SavedMove(uci="e7e5"))
    library.save(SaveGameRequest(game_id=game["id"], revision=3, snapshot=snapshot))
    library.save(SaveGameRequest(game_id=game["id"], revision=2, snapshot=GameSnapshot(initial_fen=chess.STARTING_FEN)))
    reopened = Library(tmp_path).open(game["id"])
    assert [m["uci"] for m in reopened["records"]] == ["e2e4", "e7e5"]
    assert reopened["revision"] == 3


def test_completed_line_is_immutable_but_notes_are_editable(tmp_path):
    library = Library(tmp_path)
    game = save(library, ["e2e4"])
    library.finish(game["id"], "resignation", "black")
    data = library.open(game["id"])
    assert data["result"] == "1-0"
    assert data["frames"][-1]["is_game_over"]
    assert not data["frames"][-1]["is_checkmate"]
    snapshot = GameSnapshot.model_validate(data["snapshot"])
    snapshot.comments["main:1"] = "Piano da ripassare"
    library.save(SaveGameRequest(game_id=game["id"], revision=3, snapshot=snapshot))
    snapshot.moves = []
    with pytest.raises(ChessRuleError, match="linea originale"):
        library.save(SaveGameRequest(game_id=game["id"], revision=4, snapshot=snapshot))
    assert library.open(game["id"])["snapshot"]["comments"]["main:1"] == "Piano da ripassare"


def test_captures_include_en_passant_and_captured_promoted_piece(tmp_path):
    library = Library(tmp_path)
    game = save(library, ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"])
    assert library.open(game["id"])["records"][-1]["captured_piece"] == "p"
    promoted = save(library, ["a7b8q", "b7b8"], "1r5k/Pr6/8/8/8/8/8/7K w - - 0 1")
    assert [m["captured_piece"] for m in library.open(promoted["id"])["records"]] == ["r", "Q"]


def test_pgn_roundtrip_preserves_variations_comments_and_result(tmp_path):
    library = Library(tmp_path)
    imported = library.import_games('[Event "Test"]\n[Result "1-0"]\n\n1. e4 {Centro} (1. d4 d5) e5 2. Nf3 1-0', None)[0]
    data = library.open(imported["id"])
    assert data["result"] == "1-0"
    assert len(data["variations"]) == 1
    assert data["variations"][0]["moves_uci"] == ["d2d4", "d7d5"]
    exported = library.export(imported["id"])
    roundtrip = library.import_games(exported, None)[0]
    assert library.open(roundtrip["id"])["snapshot"]["comments"]["main:1"] == "Centro"
    assert "( 1. d4 d5 )" in exported


def test_illegal_import_batch_does_not_partially_write(tmp_path):
    library = Library(tmp_path)
    with pytest.raises(ChessRuleError):
        library.import_games('[Event "Valid"]\n\n1. e4 *\n\n[Event "Invalid"]\n\n1. e5 *', None)
    assert library.list() == []


def test_pgn_side_line_annotations_roundtrip(tmp_path):
    library = Library(tmp_path)
    imported = library.import_games('1. e4 (1. d4 {Centro [%cal Rd4d5]} d5) e5 *', None)[0]
    data = library.open(imported['id'])
    branch_id = data['snapshot']['variations'][0]['id']
    assert data['snapshot']['marks'][f'{branch_id}:1'] == [{'from': 'd4', 'to': 'd5'}]
    exported = library.export(imported['id'])
    assert 'Centro' in exported
    assert '[%cal Rd4d5]' in exported


def test_old_games_remain_searchable_beyond_the_latest_500(tmp_path):
    library = Library(tmp_path)
    game = save(library)
    with library.connection() as db:
        db.execute("UPDATE games SET title='Partita dimenticata', updated_at='2020-01-01' WHERE id=?", (game['id'],))
        db.executemany("INSERT INTO games SELECT ?, revision,created_at,'2026-01-01','Recente',result,finish_reason,snapshot FROM games WHERE id=?", [(str(uuid.uuid4()), game['id']) for _ in range(501)])
    assert len(library.list()) == 500
    assert library.list('DIMENTICATA')[0]['id'] == game['id']


def test_nonfinal_claimable_draw_does_not_end_imported_history_or_study_variant(tmp_path):
    library = Library(tmp_path)
    moves = ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8','e2e4','e7e5']
    game = save(library, moves)
    data = library.open(game['id'])
    assert not data['frames'][7]['is_game_over']
    assert not data['frames'][-1]['is_game_over']
    snapshot = GameSnapshot.model_validate(data['snapshot'])
    snapshot.variations = [Variation(id='knight-line', root_ply=0, moves_uci=moves[:8])]
    library.save(SaveGameRequest(game_id=game['id'], revision=2, snapshot=snapshot))
    assert not library.open(game['id'])['variations'][0]['frames'][-1]['is_game_over']


def test_hydrated_variation_move_ids_are_unique_from_original_prefix(tmp_path):
    library = Library(tmp_path)
    game = library.import_games('1. e4 e5 (1... c5 2. Nf3) 2. Bc4 *', None)[0]
    data = library.open(game['id'])
    branch = data['variations'][0]
    line = [*data['records'][:branch['root_ply']], *branch['records']]
    assert len({move['id'] for move in line}) == len(line)


def test_timeout_draw_when_opponent_has_only_king(tmp_path):
    library = Library(tmp_path)
    game = save(library, [], "7k/8/8/8/8/8/8/KR6 w - - 0 1")
    ended = library.finish(game["id"], "timeout", "white")
    assert ended["result"] == "1/2-1/2"


class FakeStockfish:
    def __init__(self):
        self.calls = 0

    async def analyze(self, fen, depth, *_args, **_kwargs):
        self.calls += 1
        board = chess.Board(fen)
        move = next(iter(board.legal_moves))
        await asyncio.sleep(0)
        return AnalyzeResponse(fen=fen, side_to_move="white" if board.turn else "black", depth=depth, candidates=[CandidateMove(rank=1, uci=move.uci(), san=board.san(move), evaluation="+0.50", expected_score_percent=80, win_percent=70, draw_percent=20, loss_percent=10, principal_variation=[board.san(move)])])


class FakeAgent:
    available = True

    def __init__(self, fail=False):
        self.calls = 0
        self.fail = fail
        self.authenticated = True

    async def status(self):
        return {"authenticated": self.authenticated}

    async def review_game(self, pgn, report):
        self.calls += 1
        await asyncio.sleep(0)
        if self.fail:
            raise TimeoutError("Risposta incerta")
        return "Revisione salvata una sola volta"


@pytest.mark.parametrize("agent_fails", [False, True])
def test_review_is_claimed_once_across_requests_and_reopening(tmp_path, agent_fails):
    async def scenario():
        library = Library(tmp_path)
        game = save(library, ["f2f3", "e7e5", "g2g4", "d8h4"])
        engine = FakeStockfish()
        agent = FakeAgent(agent_fails)
        service = Reviews(library, engine, agent)
        for _ in range(5):
            service.ensure(game["id"])
        await asyncio.gather(*service.tasks.values())
        report = library.review(game["id"])
        assert report["state"] == "complete", report["error"]
        assert report["agent_state"] == ("failed" if agent_fails else "done")
        assert agent.calls == 1
        calls = engine.calls
        reopened = Reviews(Library(tmp_path), engine, agent)
        reopened.ensure(game["id"], run_agent=True)
        if reopened.tasks:
            await asyncio.gather(*reopened.tasks.values())
        assert engine.calls == calls
        assert agent.calls == 1
        assert library.review(game["id"])["agent_attempted"]
        exercise = library.exercises()[0]
        with pytest.raises(ChessRuleError):
            library.attempt(exercise["id"], "a1a8")
        assert library.attempt(exercise["id"], exercise["best_move"])["correct"]
        assert Library(tmp_path).exercises()[0]["attempts"] >= 0
        assert any(e["successes"] == 1 for e in library.exercises())
    asyncio.run(scenario())


def test_unavailable_agent_can_be_generated_later_without_rerunning_engine(tmp_path):
    async def scenario():
        library = Library(tmp_path)
        game = save(library, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
        engine = FakeStockfish()
        agent = FakeAgent()
        agent.available = False
        service = Reviews(library, engine, agent)
        service.ensure(game['id'])
        await asyncio.gather(*service.tasks.values())
        assert not library.review(game['id'])['agent_attempted']
        assert library.review(game['id'])['agent_state'] == 'unavailable'
        engine_calls = engine.calls
        agent.available = True
        # A normal open never spends an account call later on its own.
        service.ensure(game['id'])
        assert agent.calls == 0
        for _ in range(4):
            service.ensure(game['id'], run_agent=True)
        await asyncio.gather(*service.tasks.values())
        assert agent.calls == 1
        assert engine.calls == engine_calls
        assert library.review(game['id'])['summary']
    asyncio.run(scenario())


def test_engine_interruption_resumes_saved_positions_only_by_explicit_request(tmp_path):
    async def scenario():
        library = Library(tmp_path)
        game = save(library, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
        library.claim_review(game['id'])
        engine = FakeStockfish()
        first = await engine.analyze(chess.STARTING_FEN, 8)
        library.review_update(game['id'], report={'depth': 8, 'points': [{'ply': 0, 'white_score': .5, 'evaluation': '+0.50', 'analysis': first.model_dump()}]}, progress=20)
        agent = FakeAgent()
        service = Reviews(library, engine, agent)
        assert service.ensure(game['id'])['state'] == 'interrupted'
        assert not service.tasks
        service.ensure(game['id'], run_agent=True)
        await asyncio.gather(*service.tasks.values())
        assert library.review(game['id'])['state'] == 'complete'
        # Four nonterminal positions total, including the already persisted first.
        assert engine.calls == 4
        assert agent.calls == 1
    asyncio.run(scenario())


def test_interrupted_agent_claim_is_not_repeated_after_restart(tmp_path):
    async def scenario():
        library = Library(tmp_path)
        game = save(library, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
        library.claim_review(game['id'])
        library.review_update(game['id'], state='complete', report={'depth': 8, 'points': []})
        assert library.claim_agent(game['id'])
        agent = FakeAgent()
        service = Reviews(Library(tmp_path), FakeStockfish(), agent)
        for _ in range(3):
            service.ensure(game['id'], run_agent=True)
        assert not service.tasks
        assert agent.calls == 0
        assert library.review(game['id'])['agent_state'] == 'failed'
        assert library.review(game['id'])['agent_attempted']
    asyncio.run(scenario())


def test_logged_out_agent_does_not_consume_the_single_review_attempt(tmp_path):
    async def scenario():
        library = Library(tmp_path)
        game = save(library, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
        agent = FakeAgent()
        agent.authenticated = False
        service = Reviews(library, FakeStockfish(), agent)
        service.ensure(game['id'])
        await asyncio.gather(*service.tasks.values())
        assert not library.review(game['id'])['agent_attempted']
        assert agent.calls == 0
        agent.authenticated = True
        service.ensure(game['id'], run_agent=True)
        await asyncio.gather(*service.tasks.values())
        assert agent.calls == 1
    asyncio.run(scenario())
