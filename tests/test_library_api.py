import json

import chess
from fastapi.testclient import TestClient

import app.main as main
from app.library import Library
from app.library_models import GameSnapshot, SaveGameRequest


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
