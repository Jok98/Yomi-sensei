import asyncio
import sys

import chess
import chess.engine
import pytest
from fastapi.testclient import TestClient

from app.chess_service import ChessRuleError, StockfishService, parse_board, position_state
from app.llm_service import CodexCliService
from app.main import app
from app.maia_service import MaiaService
from app.models import AnalyzeResponse, CandidateMove, ChatRequest, HumanAnalysis, HumanCandidate, MaiaProfile


def replay(moves):
    board = chess.Board()
    for move in moves:
        board.push_uci(move)
    return board


def test_threefold_and_fivefold_are_detected_from_complete_history():
    cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8']
    for repetitions, phrase in [(2, 'triplice'), (4, 'quintupla')]:
        moves = cycle * repetitions
        board = replay(moves)
        restored = parse_board(board.fen(), chess.STARTING_FEN, moves)
        assert len(restored.move_stack) == len(moves)
        state = position_state(restored)
        assert state.is_game_over
        assert phrase in state.status


def test_history_must_be_legal_and_match_fen():
    with pytest.raises(ChessRuleError, match='illegale'):
        parse_board(chess.STARTING_FEN, chess.STARTING_FEN, ['e2e5'])
    with pytest.raises(ChessRuleError, match='non corrisponde'):
        parse_board(chess.STARTING_FEN, chess.STARTING_FEN, ['e2e4'])
    with pytest.raises(ChessRuleError, match='UCI'):
        parse_board(chess.STARTING_FEN, chess.STARTING_FEN, ['bad'])


def test_stockfish_analysis_and_replies_retain_move_stack(monkeypatch):
    board = replay(['e2e4', 'e7e5'])
    seen = []
    service = StockfishService('unused')
    def analyze(current, depth):
        seen.append(len(current.move_stack))
        return [{'pv': [next(iter(current.legal_moves))], 'score': chess.engine.PovScore(chess.engine.Cp(10), current.turn)}]
    monkeypatch.setattr(service, '_analyze_sync', analyze)
    asyncio.run(service.analyze(board.fen(), 8, True, chess.STARTING_FEN, ['e2e4', 'e7e5']))
    assert seen == [2, 3]


def test_move_api_reports_repetition_and_rejects_tampered_history():
    moves = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1']
    board = replay(moves)
    body = {'fen': board.fen(), 'initial_fen': chess.STARTING_FEN, 'moves_uci': moves, 'from_square': 'f6', 'to_square': 'g8'}
    with TestClient(app) as client:
        response = client.post('/api/game/move', json=body)
        assert response.status_code == 200
        assert response.json()['is_game_over']
        assert 'triplice' in response.json()['status']
        body['moves_uci'] = []
        assert client.post('/api/game/move', json=body).status_code == 422


def test_maia_is_default_opponent_and_receives_full_history_and_ratings(monkeypatch):
    board = replay(['e2e4'])
    async def play(current, profile):
        assert current.move_stack == board.move_stack
        assert (profile.white_elo, profile.black_elo, profile.maia_model) == (1100, 1700, '5m')
        current.push_uci('e7e5')
        return position_state(current, 'e5', 'e7e5')
    monkeypatch.setattr('app.main.maia.play', play)
    with TestClient(app) as client:
        response = client.post('/api/game/computer-move', json={
            'fen': board.fen(), 'initial_fen': chess.STARTING_FEN, 'moves_uci': ['e2e4'],
            'white_elo': 1100, 'black_elo': 1700, 'maia_model': '5m',
        })
    assert response.status_code == 200
    assert response.json()['last_move_uci'] == 'e7e5'


def sf_candidate(uci='e2e4', san='e4'):
    return CandidateMove(rank=1, uci=uci, san=san, evaluation='+0.40', expected_score_percent=65,
        win_percent=50, draw_percent=30, loss_percent=20, principal_variation=[san])


def human():
    return HumanAnalysis(fen=chess.STARTING_FEN, model='79m', white_elo=1500, black_elo=1500, device='cpu',
        candidates=[HumanCandidate(rank=1, uci='b1c3', san='Nc3', move_probability_percent=12.5,
            win_percent=40, draw_percent=5, loss_percent=55)])


@pytest.mark.parametrize('failed_engine', [None, 'maia', 'stockfish'])
def test_analysis_keeps_metrics_distinct_and_handles_one_engine_failure(monkeypatch, failed_engine):
    async def sf(*args):
        if failed_engine == 'stockfish':
            raise RuntimeError('SF unavailable')
        return AnalyzeResponse(fen=chess.STARTING_FEN, side_to_move='white', depth=8, candidates=[sf_candidate()])
    async def maia(*args):
        if failed_engine == 'maia':
            raise RuntimeError('Maia unavailable')
        return human()
    async def evaluate(board, moves, depth):
        assert moves == ['b1c3']  # Outside the ordinary Stockfish candidates.
        return {'b1c3': sf_candidate('b1c3', 'Nc3')}
    monkeypatch.setattr('app.main.stockfish.analyze', sf)
    monkeypatch.setattr('app.main.maia.analyze', maia)
    monkeypatch.setattr('app.main.stockfish.evaluate_moves', evaluate)
    with TestClient(app) as client:
        response = client.post('/api/analyze', json={'fen': chess.STARTING_FEN, 'depth': 8})
    assert response.status_code == 200
    result = response.json()
    if failed_engine == 'maia':
        assert result['human'] is None and result['human_error']
        assert result['candidates']
    else:
        candidate = result['human']['candidates'][0]
        assert candidate['move_probability_percent'] == 12.5
        assert candidate['win_percent'] == 40
        if failed_engine == 'stockfish':
            assert candidate['stockfish'] is None and result['stockfish_error']
        else:
            assert candidate['stockfish']['expected_score_percent'] == 65


def test_coach_distinguishes_maia_probability_and_stockfish_quality():
    analysis = human()
    analysis.candidates[0].stockfish = sf_candidate('b1c3', 'Nc3')
    request = ChatRequest(fen=chess.STARTING_FEN, message='Perché questa mossa?', human_analysis=analysis)
    prompt = CodexCliService._prompt(request)
    assert 'probabilità scelta umana 12.50%' in prompt
    assert 'W/D/L Maia 40.0/5.0/55.0' in prompt
    assert 'valutazione Stockfish +0.40' in prompt


def test_chat_rejects_human_analysis_for_another_position():
    analysis = human()
    analysis.fen = replay(['e2e4']).fen()
    with TestClient(app) as client:
        response = client.post('/api/chat', json={'fen': chess.STARTING_FEN, 'message': 'Piano?', 'human_analysis': analysis.model_dump()})
    assert response.status_code == 422


def test_maia_cache_uses_history_and_rating_and_never_caches_play(monkeypatch):
    service = MaiaService('unused', [])
    calls = []
    def request(packet):
        calls.append(packet)
        return {'fen': packet['fen'], 'model': packet['model'], 'device': 'cpu', 'candidates': [{'uci': 'e2e4', 'probability': .5, 'wdl': [500, 100, 400]}]}
    monkeypatch.setattr(service, '_request_sync', request)
    async def run():
        board = replay(['g1f3', 'g8f6', 'f3g1', 'f6g8'])
        await service.predict(board, MaiaProfile())
        await service.predict(board, MaiaProfile())
        await service.predict(chess.Board(board.fen()), MaiaProfile())
        await service.predict(board, MaiaProfile(white_elo=1100))
        await service.predict(board, MaiaProfile(), 'play')
        await service.predict(board, MaiaProfile(), 'play')
    asyncio.run(run())
    assert len(calls) == 5
    assert calls[0]['moves_uci'] == ['g1f3', 'g8f6', 'f3g1', 'f6g8']
    assert calls[1]['moves_uci'] == []


def test_maia_worker_is_owned_and_exits_on_close(tmp_path):
    runtime = tmp_path / 'runtime'
    (runtime / 'models').mkdir(parents=True)
    for model in ('5m', '79m'):
        (runtime / 'models' / f'maia3-{model}.pt').touch()
    worker = tmp_path / 'fake_worker.py'
    worker.write_text("import sys,json\nfor line in sys.stdin:\n r=json.loads(line)\n r.update(candidates=[dict(uci='e2e4',probability=.5,wdl=[500,100,400])],device='cpu')\n print(json.dumps(r),flush=True)\n")
    service = MaiaService(str(runtime), [sys.executable, str(worker)])
    async def run():
        await service.predict(chess.Board(), MaiaProfile())
        process = service._process
        assert process.poll() is None
        await service.close()
        assert process.poll() == 0
    asyncio.run(run())
