import test from 'node:test';
import assert from 'node:assert/strict';
import { boardEvaluation } from '../../src/shared/evaluation';
import type { Analysis, Candidate, Color, Position } from '../../src/shared/types';

function position(turn: Color = 'white'): Position {
  return {
    fen: `8/8/8/8/8/8/4k3/6K1 ${turn === 'white' ? 'w' : 'b'} - - 0 1`,
    turn,
    status: 'Partita in corso',
    is_game_over: false,
    result: null,
    legal_moves: [],
    last_move_san: null,
    last_move_uci: null,
  };
}
function candidate(evaluation: string, rank = 1): Candidate {
  return {
    rank,
    uci: 'g1f1',
    san: 'Kf1',
    evaluation,
    expected_score_percent: 99,
    win_percent: 98,
    draw_percent: 2,
    loss_percent: 0,
    principal_variation: [],
  };
}
function analysis(at: Position, score: string): Analysis {
  return {
    fen: at.fen,
    side_to_move: at.turn,
    depth: 12,
    candidates: [candidate(score)],
    replies: [],
  };
}

test('evaluation always uses the White perspective on either turn', () => {
  for (const [turn, score, expected] of [
    ['white', '+1.25', 1.25],
    ['white', '-2.50', -2.5],
    ['black', '+1.25', -1.25],
    ['black', '-2.50', 2.5],
  ] as const) {
    const at = position(turn);
    const value = boardEvaluation(at, analysis(at, score))!;
    assert.equal(value.whiteScore, expected);
    assert.equal(value.favored, expected > 0 ? 'white' : 'black');
    assert.equal(value.whiteShare > 50, expected > 0);
  }
});

test('the bar uses the top Stockfish score independently of Maia probabilities and order', () => {
  const at = position();
  const data = analysis(at, '+0.80');
  data.candidates.unshift(candidate('-5.00', 2));
  data.human = {
    fen: at.fen,
    model: '79m',
    white_elo: 1500,
    black_elo: 1500,
    device: 'cpu',
    replies: [],
    candidates: [
      {
        rank: 1,
        uci: 'g1h1',
        san: 'Kh1',
        move_probability_percent: 99,
        win_percent: 99,
        draw_percent: 1,
        loss_percent: 0,
        stockfish: candidate('-4.00'),
      },
    ],
  };
  const value = boardEvaluation(at, data)!;
  assert.equal(value.whiteScore, 0.8);
  assert.equal(value.label, '+0.8');
  assert.ok(value.whiteShare < 70);
});

test('missing, failed, stale or invalid evaluation stays unavailable instead of claiming equality', () => {
  const at = position();
  const data = analysis(at, '+0.20');
  assert.equal(boardEvaluation(null, data), null);
  assert.equal(boardEvaluation(at, null), null);
  assert.equal(boardEvaluation(at, { ...data, fen: 'old position' }), null);
  assert.equal(boardEvaluation(at, { ...data, side_to_move: 'black' }), null);
  assert.equal(boardEvaluation(at, { ...data, stockfish_error: 'Engine unavailable' }), null);
  assert.equal(boardEvaluation(at, { ...data, candidates: [] }), null);
  for (const score of ['—', 'NaN', 'Infinity', '99%', '', '#mate'])
    assert.equal(boardEvaluation(at, analysis(at, score)), null);
});

test('mate scores identify the winner on either turn, including negative zero', () => {
  for (const [turn, score, favored, distance] of [
    ['white', '#+3', 'white', 3],
    ['white', '#-2', 'black', 2],
    ['black', '#+4', 'black', 4],
    ['black', '#-1', 'white', 1],
    ['white', '#-0', 'black', 0],
  ] as const) {
    const at = position(turn);
    const value = boardEvaluation(at, analysis(at, score))!;
    assert.equal(value.kind, 'mate');
    assert.equal(value.favored, favored);
    assert.equal(value.label, `M${distance}`);
    assert.equal(value.whiteShare, favored === 'white' ? 100 : 0);
  }
});

test('terminal results override analysis and report both winners and a draw', () => {
  for (const [result, favored, share, label] of [
    ['1-0', 'white', 100, 'M0'],
    ['0-1', 'black', 0, 'M0'],
    ['1/2-1/2', null, 50, '½'],
  ] as const) {
    const at = { ...position(), is_game_over: true, result };
    const value = boardEvaluation(at, analysis(at, '-3.00'))!;
    assert.equal(value.kind, 'result');
    assert.equal(value.favored, favored);
    assert.equal(value.whiteShare, share);
    assert.equal(value.label, label);
  }
  assert.equal(boardEvaluation({ ...position(), is_game_over: true }, null), null);
});

test('pawn scores produce a bounded symmetric visual scale, separate from expected result percent', () => {
  const at = position();
  const values = [-100, -4, -1, 0, 1, 4, 100].map(
    (score) => boardEvaluation(at, analysis(at, String(score)))!,
  );
  for (let index = 0; index < values.length; index++) {
    assert.ok(values[index].whiteShare >= 0 && values[index].whiteShare <= 100);
    if (index) assert.ok(values[index].whiteShare > values[index - 1].whiteShare);
    assert.ok(
      Math.abs(values[index].whiteShare + values[values.length - 1 - index].whiteShare - 100) <
        1e-10,
    );
  }
  assert.equal(values[3].whiteShare, 50);
  assert.equal(values[3].label, '0.0');
  assert.equal(values[3].favored, null);
});
