import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GameController,
  visibleRecords,
  hintsHidden,
  type Transport,
} from '../../src/renderer/controller';
import { validateRequest } from '../../src/desktop/backend';
import { parseFen, squares } from '../../src/shared/game';
import type { Analysis, ApiRoute, Position } from '../../src/shared/types';
import type { GameSnapshot, GameSummary, SavedGame } from '../../src/shared/library';

const initial: Position = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn: 'white',
  status: 'Muove il Bianco',
  is_game_over: false,
  last_move_san: null,
  last_move_uci: null,
  legal_moves: [
    { from_square: 'e2', to_square: 'e4', promotion: null, uci: 'e2e4' },
    { from_square: 'd2', to_square: 'd4', promotion: null, uci: 'd2d4' },
  ],
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
const d4: Position = {
  ...whiteMove,
  fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
  last_move_san: 'd4',
  last_move_uci: 'd2d4',
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
  computerWait: Promise<Position> | null = null;
  failSave = false;
  saved = new Map<string, { summary: GameSummary; snapshot: GameSnapshot }>();
  private open(id: string): SavedGame {
    const value = this.saved.get(id)!;
    const frames = [structuredClone(initial)];
    const records = value.snapshot.moves.map((move, index) => {
      const before = frames.at(-1)!;
      const after = structuredClone(
        (
          { e2e4: whiteMove, e7e5: blackMove, f1c4: secondWhite, d2d4: d4 } as Record<
            string,
            Position
          >
        )[move.uci],
      );
      frames.push(after);
      return {
        ...move,
        id: index + 1,
        before,
        after,
        color: before.turn,
        san: after.last_move_san!,
      };
    });
    if (value.summary.result)
      Object.assign(frames.at(-1)!, {
        is_game_over: true,
        result: value.summary.result,
        is_checkmate: false,
      });
    const variations = value.snapshot.variations.map((branch) => {
      const branchFrames = [frames[branch.root_ply]];
      const branchRecords = branch.moves_uci.map((uci, index) => {
        const before = branchFrames.at(-1)!;
        const after = structuredClone(uci === 'd2d4' ? d4 : whiteMove);
        branchFrames.push(after);
        return {
          id: 100 + index,
          before,
          after,
          color: before.turn,
          san: after.last_move_san!,
          uci,
          computer: false,
          engine: null,
          classification: null,
        };
      });
      return { ...branch, frames: branchFrames, records: branchRecords };
    });
    return {
      ...value.summary,
      snapshot: structuredClone(value.snapshot),
      frames,
      records,
      variations,
      review: null,
    };
  }
  async request<T>(route: ApiRoute, body?: any): Promise<T> {
    this.calls.push({ route, body });
    let response: unknown;
    switch (route) {
      case '/api/game/new':
        response = structuredClone(initial);
        break;
      case '/api/game/move':
      case '/api/study/move':
        response =
          body.from_square === 'e2'
            ? whiteMove
            : body.from_square === 'd2'
              ? d4
              : body.from_square === 'e7'
                ? blackMove
                : secondWhite;
        break;
      case '/api/game/computer-move':
        if (this.failComputer) throw new Error('Engine stopped');
        response =
          this.computerWait ??
          (body.fen === initial.fen
            ? whiteMove
            : body.fen === blackMove.fen
              ? secondWhite
              : blackMove);
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
        response = this.analysisWait ?? {
          ...analysis(body.fen, body),
          ...(body.include_human === false ? { human: null } : {}),
        };
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
      case '/api/library/save': {
        if (this.failSave) throw new Error('Database non accessibile');
        const id = body.game_id ?? crypto.randomUUID();
        const summary: GameSummary = {
          id,
          revision: body.revision,
          title: body.snapshot.title || 'Partita test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          result: this.saved.get(id)?.summary.result ?? null,
          finish_reason: null,
          plies: body.snapshot.moves.length,
          options: body.snapshot.options,
        };
        this.saved.set(id, { summary, snapshot: structuredClone(body.snapshot) });
        response = summary;
        break;
      }
      case '/api/library/list':
        response = { games: [...this.saved.values()].map((value) => value.summary) };
        break;
      case '/api/library/open':
        response = this.open(body.game_id);
        break;
      case '/api/study/position':
        response = body.fen === initial.fen ? initial : whiteMove;
        break;
      case '/api/library/finish': {
        const value = this.saved.get(body.game_id)!;
        value.summary.result =
          body.reason === 'draw' ? '1/2-1/2' : body.color === 'white' ? '0-1' : '1-0';
        value.summary.revision += 1;
        response = this.open(body.game_id);
        break;
      }
      case '/api/library/review':
        response = {
          game_id: body.game_id,
          state: 'complete',
          progress: 100,
          report: null,
          agent_attempted: true,
          agent_state: 'done',
          summary: 'Saved',
          error: null,
          agent_error: null,
        };
        break;
      case '/api/exercises/list':
        response = { exercises: [] };
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
  const pendingAnalysis = deferred<Analysis>();
  api.classificationWait = waiting.promise;
  api.analysisWait = pendingAnalysis.promise;
  const move = game.move('e2', 'e4');
  await settle();
  await game.sendChat('Quale mossa?', null, 'medium');
  const chat = api.calls.find((call) => call.route === '/api/chat')!.body;
  assert.equal(chat.fen, whiteMove.fen);
  assert.equal(chat.pgn, '1. e4');
  assert.deepEqual(chat.candidates, []);
  assert.deepEqual(chat.opponent_candidates, []);
  waiting.resolve({ code: 'book' });
  pendingAnalysis.resolve(analysis(whiteMove.fen));
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
  await settle();
  await game.newGame('computer');
  await settle();
  assert.deepEqual(
    api.calls
      .filter((call) => call.route === '/api/analyze' && call.body.include_human)
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

test('classification does not block the opponent and stays bound to its saved move', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame('computer');
  const pending = deferred<unknown>();
  api.classificationWait = pending.promise;
  await game.move('e2', 'e4');
  assert.equal(game.getSnapshot().moves.length, 2);
  assert.equal(game.getSnapshot().busy, null);
  assert.equal(game.getSnapshot().moves[0].classification, null);
  pending.resolve({ code: 'book', label: 'Da manuale' });
  await settle();
  await game.flushSave();
  assert.equal(
    api.saved.get(game.getSnapshot().gameId!)!.snapshot.moves[0].classification?.code,
    'book',
  );
  game.dispose();
});

test('study and a saved variation preserve the original line and persist annotations and chat', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame();
  await game.move('e2', 'e4');
  await game.move('e7', 'e5');
  game.navigate(0);
  assert.equal(visibleRecords(game.getSnapshot()).length, 0);
  await game.move('d2', 'd4');
  assert.equal(game.getSnapshot().moves.length, 2);
  await game.startVariation();
  await game.move('d2', 'd4');
  game.setComment('Controllo del centro');
  game.setMarks([{ from: 'd4', to: 'd5' }]);
  await game.sendChat('Piano della variante?', null, null);
  await game.prepareClose();
  const id = game.getSnapshot().gameId!;
  const branchId = game.getSnapshot().variationId!;
  const chat = api.calls.filter((c) => c.route === '/api/chat').at(-1)!.body;
  assert.equal(chat.pgn, '1. d4');
  assert.deepEqual(chat.moves_uci, ['d2d4']);
  const reopened = new GameController(api);
  await reopened.initialize();
  assert.equal(reopened.getSnapshot().gameId, id);
  assert.equal(reopened.getSnapshot().historyPly, 2);
  assert.deepEqual(
    reopened.getSnapshot().moves.map((m) => m.uci),
    ['e2e4', 'e7e5'],
  );
  assert.deepEqual(reopened.getSnapshot().variations[0].moves_uci, ['d2d4']);
  assert.equal(reopened.getSnapshot().comments[`${branchId}:1`], 'Controllo del centro');
  assert.deepEqual(reopened.getSnapshot().marks[`${branchId}:1`], [{ from: 'd4', to: 'd5' }]);
  assert.equal(reopened.getSnapshot().chat.length, 2);
  assert.equal(reopened.getSnapshot().mateNotice, null);
  game.dispose();
  reopened.dispose();
});

test('playing Black starts with an AI move and undo preserves that opening move', async () => {
  const game = new GameController(new FakeApi());
  await game.newGame('computer', 'black');
  assert.equal(game.getSnapshot().position?.turn, 'black');
  assert.equal(game.getSnapshot().moves[0].computer, true);
  game.setTimeControl(300000, 2000);
  assert.equal(game.getSnapshot().clock!.base_ms, 300000);
  game.undo();
  assert.equal(game.getSnapshot().moves.length, 1);
  await game.move('e7', 'e5');
  assert.equal(game.getSnapshot().moves.length, 3);
  game.undo();
  assert.equal(game.getSnapshot().moves.length, 1);
  assert.equal(game.getSnapshot().position?.fen, whiteMove.fen);
  game.dispose();
});

test('study pauses the clock and training hides hints until explicitly requested', async () => {
  const game = new GameController(new FakeApi());
  await game.newGame();
  game.setTimeControl(60000, 2000);
  game.setTraining(true);
  assert.equal(hintsHidden(game.getSnapshot()), true);
  game.revealHints();
  assert.equal(hintsHidden(game.getSnapshot()), false);
  await game.move('e2', 'e4');
  assert.equal(hintsHidden(game.getSnapshot()), true);
  assert.ok(game.getSnapshot().clock!.white_ms > 60000);
  game.previous();
  const clock = game.getSnapshot().clock!;
  game.tick(Date.now() + 600000);
  assert.deepEqual(game.getSnapshot().clock, clock);
  assert.equal(clock.paused, true);
  await game.resumeGame();
  assert.equal(game.getSnapshot().clock!.paused, false);
  await game.prepareClose();
  game.dispose();
});

test('timeout while the opponent thinks discards its late response and persists the result', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame('computer');
  game.setTimeControl(60000);
  const pending = deferred<Position>();
  api.computerWait = pending.promise;
  const moving = game.move('e2', 'e4');
  await settle();
  game.tick(Date.now() + 61000);
  await settle();
  await settle();
  pending.resolve(blackMove);
  await moving;
  assert.equal(game.getSnapshot().gameResult, '1-0');
  assert.deepEqual(
    game.getSnapshot().moves.map((m) => m.uci),
    ['e2e4'],
  );
  assert.equal(api.saved.get(game.getSnapshot().gameId!)!.summary.result, '1-0');
  assert.equal(game.getSnapshot().clock!.paused, true);
  game.dispose();
});

test('a failed save keeps changes and blocks switching until the save succeeds', async () => {
  const api = new FakeApi();
  const game = new GameController(api);
  await game.newGame();
  const id = game.getSnapshot().gameId!;
  await game.move('e2', 'e4');
  await settle();
  api.failSave = true;
  await assert.rejects(game.prepareClose(), /Database/);
  assert.equal(game.getSnapshot().savePending, true);
  await game.newGame();
  assert.equal(game.getSnapshot().gameId, id);
  api.failSave = false;
  await game.prepareClose();
  assert.equal(api.saved.get(id)!.snapshot.moves.length, 1);
  assert.equal(game.getSnapshot().savePending, false);
  game.dispose();
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
