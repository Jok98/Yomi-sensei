import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController, type Transport } from '../../src/renderer/controller';
import { validateRequest } from '../../src/desktop/backend';
import { parseFen, squares } from '../../src/shared/game';
import type { Analysis, ApiRoute, Position } from '../../src/shared/types';

const initial: Position = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn: 'white',
  status: 'Muove il Bianco',
  is_game_over: false,
  last_move_san: null,
  last_move_uci: null,
  legal_moves: [{ from_square: 'e2', to_square: 'e4', promotion: null, uci: 'e2e4' }],
};
const whiteMove: Position = {
  ...initial,
  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  turn: 'black',
  status: 'Muove il Nero',
  last_move_san: 'e4',
  last_move_uci: 'e2e4',
  legal_moves: [{ from_square: 'e7', to_square: 'e5', promotion: null, uci: 'e7e5' }],
};
const blackMove: Position = {
  ...initial,
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  last_move_san: 'e5',
  last_move_uci: 'e7e5',
  legal_moves: [{ from_square: 'f1', to_square: 'c4', promotion: null, uci: 'f1c4' }],
};
const secondWhite: Position = {
  ...whiteMove,
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2',
  last_move_san: 'Bc4',
  last_move_uci: 'f1c4',
};
function analysis(
  fen: string,
  profile = { maia_model: '79m' as '5m' | '79m', white_elo: 1500, black_elo: 1500 },
): Analysis {
  return {
    fen,
    side_to_move: fen.split(' ')[1] === 'w' ? 'white' : 'black',
    depth: 8,
    replies: [],
    candidates: [
      {
        rank: 1,
        uci: 'e2e4',
        san: 'e4',
        evaluation: '+0.2',
        expected_score_percent: 51,
        win_percent: 10,
        draw_percent: 82,
        loss_percent: 8,
        principal_variation: ['e4', 'e5'],
      },
    ],
    human: {
      fen,
      model: profile.maia_model,
      white_elo: profile.white_elo,
      black_elo: profile.black_elo,
      device: 'cpu',
      candidates: [
        {
          rank: 1,
          uci: 'e2e4',
          san: 'e4',
          move_probability_percent: 64,
          win_percent: 50,
          draw_percent: 3,
          loss_percent: 47,
          stockfish: null,
        },
      ],
      replies: [],
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
class FakeApi implements Transport {
  calls: { route: ApiRoute; body: any }[] = [];
  failComputer = false;
  classificationWait: Promise<unknown> | null = null;
  analysisWait: Promise<Analysis> | null = null;
  chatWait: Promise<unknown> | null = null;
  async request<T>(route: ApiRoute, body?: any): Promise<T> {
    this.calls.push({ route, body });
    let response: unknown;
    switch (route) {
      case '/api/game/new':
        response = structuredClone(initial);
        break;
      case '/api/game/move':
        response = body.from_square === 'e2' ? whiteMove : secondWhite;
        break;
      case '/api/game/computer-move':
        if (this.failComputer) throw new Error('Engine stopped');
        response = blackMove;
        break;
      case '/api/classify-move':
        response = this.classificationWait ?? {
          code: 'book',
          label: 'Da manuale',
          marker: 'B',
          expected_points_loss: 0,
          played_move_san: 'e4',
          best_move_san: null,
        };
        break;
      case '/api/analyze':
        response = this.analysisWait ?? analysis(body.fen, body);
        break;
      case '/api/chat':
        response = this.chatWait ?? { answer: 'Una risposta sintetica.', model: 'test' };
        break;
      case '/api/health':
        response = { stockfish: true, codex: false, codex_authenticated: false };
        break;
      case '/api/codex/options':
        response = {
          models: [],
          configured_model: null,
          default_reasoning_level: 'medium',
          catalog_source: 'fallback',
        };
        break;
    }
    return (await response) as T;
  }
}
test('YS-02: undo after failed computer response returns control to white', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame('computer');
  await game.move('e2', 'e4');
  api.failComputer = true;
  await game.move('f1', 'c4');
  assert.equal(game.getSnapshot().moves.length, 3);
  assert.equal(game.getSnapshot().position?.turn, 'black');
  game.undo();
  assert.equal(game.getSnapshot().position?.fen, blackMove.fen);
  assert.equal(game.getSnapshot().position?.turn, 'white');
  assert.equal(game.getSnapshot().moves.length, 2);
});
test('YS-02: undo removes the complete turn after a computer reply', async () => {
  const game = new GameController(new FakeApi());
  await game.newGame('computer');
  await game.move('e2', 'e4');
  game.undo();
  assert.equal(game.getSnapshot().position?.fen, initial.fen);
  assert.equal(game.getSnapshot().moves.length, 0);
});
test('YS-03: chat cannot receive candidates for the preceding position', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame();
  await settle();
  assert.equal(game.getSnapshot().analysis?.candidates.length, 1);
  const waiting = deferred<unknown>();
  api.classificationWait = waiting.promise;
  const move = game.move('e2', 'e4');
  await settle();
  await game.sendChat('Quale mossa?', null, 'medium');
  const chat = api.calls.find((call) => call.route === '/api/chat')!.body;
  assert.equal(chat.fen, whiteMove.fen);
  assert.equal(chat.pgn, '1. e4');
  assert.deepEqual(chat.candidates, []);
  assert.deepEqual(chat.opponent_candidates, []);
  waiting.resolve({ code: 'book' });
  await move;
});
test('YS-03: late analysis is discarded across a new game even with identical FEN', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  const old = deferred<Analysis>();
  api.analysisWait = old.promise;
  await game.newGame();
  api.analysisWait = null;
  await game.newGame();
  await settle();
  const stale = { ...analysis(initial.fen), depth: 24 };
  old.resolve(stale);
  await settle();
  assert.equal(game.getSnapshot().analysis?.depth, 8);
});
test('YS-04: replies are requested in free mode and skipped against computer', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame('free');
  await game.newGame('computer');
  assert.deepEqual(
    api.calls
      .filter((call) => call.route === '/api/analyze')
      .map((call) => call.body.include_replies),
    [true, false],
  );
});
test('the controller rejects concurrent duplicate moves', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame();
  await Promise.all([game.move('e2', 'e4'), game.move('e2', 'e4')]);
  assert.equal(api.calls.filter((call) => call.route === '/api/game/move').length, 1);
  assert.equal(game.getSnapshot().moves.length, 1);
});
test('a computer failure is retryable without replaying the user move', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  api.failComputer = true;
  await game.newGame('computer');
  await game.move('e2', 'e4');
  api.failComputer = false;
  await game.retryComputer();
  assert.equal(game.getSnapshot().position?.turn, 'white');
  assert.equal(game.getSnapshot().moves.length, 2);
  assert.equal(api.calls.filter((call) => call.route === '/api/game/move').length, 1);
});
test('an answer from a previous game cannot enter the new conversation', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame();
  const old = deferred<unknown>();
  api.chatWait = old.promise;
  const chat = game.sendChat('Piano?', null, null);
  await game.newGame();
  old.resolve({ answer: 'old', model: 'test' });
  await chat;
  assert.deepEqual(game.getSnapshot().chat, []);
  assert.equal(game.getSnapshot().chatBusy, false);
});
test('IPC only accepts bounded requests to known API routes', () => {
  assert.throws(() => validateRequest('https://example.com', {}));
  assert.throws(() => validateRequest('/api/chat', { message: 'x'.repeat(160_001) }));
  assert.doesNotThrow(() => validateRequest('/api/game/new', undefined));
});
test('board orientation and piece positions remain consistent', () => {
  assert.equal(parseFen(initial.fen).e1, 'K');
  assert.equal(parseFen(initial.fen).d8, 'q');
  assert.equal(squares('white')[0], 'a8');
  assert.equal(squares('black')[0], 'h1');
  assert.equal(new Set(squares('white')).size, 64);
});
test('complete UCI history accompanies moves, analysis, chat and undo', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame('computer');
  await game.move('e2', 'e4');
  await settle();
  const reply = api.calls.find((call) => call.route === '/api/game/computer-move')!.body;
  assert.equal(reply.initial_fen, initial.fen);
  assert.deepEqual(reply.moves_uci, ['e2e4']);
  assert.equal(reply.engine, 'maia');
  await game.sendChat('Piano umano?', null, null);
  const chat = api.calls.find((call) => call.route === '/api/chat')!.body;
  assert.deepEqual(chat.moves_uci, ['e2e4', 'e7e5']);
  assert.equal(chat.human_analysis.fen, blackMove.fen);
  game.undo();
  const afterUndo = api.calls.filter((call) => call.route === '/api/analyze').at(-1)!.body;
  assert.deepEqual(afterUndo.moves_uci, []);
  assert.equal(afterUndo.fen, initial.fen);
});
test('same-FEN human analysis is discarded after the rating changes', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  const old = deferred<Analysis>();
  api.analysisWait = old.promise;
  await game.newGame();
  api.analysisWait = null;
  game.setMaiaProfile({ white_elo: 1100, maia_model: '5m' });
  await settle();
  old.resolve(analysis(initial.fen));
  await settle();
  assert.equal(game.getSnapshot().analysis?.human?.white_elo, 1100);
  assert.equal(game.getSnapshot().analysis?.human?.model, '5m');
});
test('changing ratings invalidates human context while the next analysis is pending', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame();
  await settle();
  const pending = deferred<Analysis>();
  api.analysisWait = pending.promise;
  game.setMaiaProfile({ black_elo: 1900 });
  await game.sendChat('Quali risposte?', null, null);
  const chat = api.calls.find((call) => call.route === '/api/chat')!.body;
  assert.equal(chat.human_analysis, null);
  assert.deepEqual(chat.candidates, []);
  pending.resolve(analysis(initial.fen));
});
test('the selected opponent is preserved in computer requests and move history', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  game.setEngine('stockfish');
  await game.newGame('computer');
  await game.move('e2', 'e4');
  assert.equal(
    api.calls.find((call) => call.route === '/api/game/computer-move')!.body.engine,
    'stockfish',
  );
  assert.equal(game.getSnapshot().moves.at(-1)?.engine, 'stockfish');
});
