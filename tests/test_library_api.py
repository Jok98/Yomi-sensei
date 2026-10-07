import json

import chess
from fastapi.testclient import TestClient

import app.main as main
from app.library import Library
from app.library_models import GameSnapshot, SaveGameRequest
from app.models import AnalyzeResponse, CandidateMove, HumanAnalysis, HumanCandidate


def test_library_routes_validate_and_reopen_persisted_data(tmp_path, monkeypatch):
    library = Library(tmp_path)
    monkeypatch.setattr(main, 'library', library)
    monkeypatch.setattr(main, 'reviews', None)
    with TestClient(main.app) as client:
        imported = client.post('/api/library/import', json={'pgn': '1. e4 a6 2. e5 d5 3. exd6 *'})
        assert imported.status_code == 200
        game_id = imported.json()['games'][0]['id']
        opened = client.post('/api/library/open', json={'game_id': game_id}).json()
        assert opened['records'][-1]['captured_piece'] == 'p'
        assert len(opened['records']) == 5
        assert 'exd6' in client.post('/api/library/export', json={'game_id': game_id}).json()['pgn']
        assert len(client.post('/api/library/list', json={'query': 'bianco'}).json()['games']) == 1
        before = library.list()
        invalid = client.post('/api/library/import', json={'fen': '8/8/8/8/8/8/8/8 w - - 0 1'})
        assert invalid.status_code == 422
        assert library.list() == before
        assert client.post('/api/library/review', json={'game_id': game_id}).status_code == 422


def test_chat_uses_server_saved_review_without_invoking_review_again(tmp_path, monkeypatch):
    library = Library(tmp_path)
    monkeypatch.setattr(main, 'library', library)
    monkeypatch.setattr(main, 'reviews', None)
    game = library.save(SaveGameRequest(revision=1, snapshot=GameSnapshot(initial_fen=chess.STARTING_FEN)))
    library.finish(game['id'], 'draw', 'white')
    library.claim_review(game['id'])
    library.review_update(game['id'], state='complete', report={'depth': 12, 'moments': []}, summary='Controlla le case centrali')

    async def fake_chat(request):
        data = json.loads(request.review_context)
        assert data['summary'] == 'Controlla le case centrali'
        assert data['depth'] == 12
        return 'Approfondimento della revisione salvata'

    monkeypatch.setattr(main.codex, 'chat', fake_chat)
    with TestClient(main.app) as client:
        response = client.post('/api/chat', json={'fen': chess.STARTING_FEN, 'game_id': game['id'], 'message': 'Quale piano?', 'review_context': 'Contesto falso del client'})
    assert response.status_code == 200
    assert not library.review(game['id'])['agent_attempted']


def test_study_analyzes_claimable_draw_without_auto_claiming_it(monkeypatch):
    moves = ['g1f3','g8f6','f3g1','f6g8'] * 2
    board = chess.Board()
    for move in moves:
        board.push_uci(move)
    assert board.can_claim_threefold_repetition()
    candidate = CandidateMove(rank=1, uci='e2e4', san='e4', evaluation='+0.2', expected_score_percent=50, win_percent=10, draw_percent=80, loss_percent=10, principal_variation=['e4'])

    async def sf(fen, *args, **kwargs):
        assert kwargs['claim_draw'] is False
        return AnalyzeResponse(fen=fen, side_to_move='white', depth=8, candidates=[candidate])

    async def human(position, *args, **kwargs):
        assert kwargs['claim_draw'] is False
        return HumanAnalysis(fen=position.fen(), model='79m', white_elo=1500, black_elo=1500, device='cpu', candidates=[HumanCandidate(rank=1, uci='e2e4', san='e4', move_probability_percent=50, win_percent=10, draw_percent=80, loss_percent=10)])

    monkeypatch.setattr(main.stockfish, 'analyze', sf)
    monkeypatch.setattr(main.maia, 'analyze', human)
    with TestClient(main.app) as client:
        response = client.post('/api/analyze', json={'fen': board.fen(), 'initial_fen': chess.STARTING_FEN, 'moves_uci': moves, 'study': True, 'include_replies': False})
    assert response.status_code == 200
    assert response.json()['candidates']
    assert response.json()['human']['candidates']
