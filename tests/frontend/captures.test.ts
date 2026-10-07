import test from 'node:test';
import assert from 'node:assert/strict';
import { capturedPiece, capturesBy, pgnHistory } from '../../src/shared/game';
import type { MoveRecord, Position } from '../../src/shared/types';

const at = (fen: string): Position => ({
  fen,
  turn: fen.split(' ')[1] === 'w' ? 'white' : 'black',
  legal_moves: [],
  status: '',
  is_game_over: false,
  last_move_san: null,
  last_move_uci: null,
});
test('capture identity includes en passant and a promoted piece, without treating castling as a capture', () => {
  assert.equal(capturedPiece(at('7k/8/8/3pP3/8/8/8/7K w - d6 0 1'), 'e5d6'), 'p');
  assert.equal(capturedPiece(at('1Q5k/1r6/8/8/8/8/8/7K b - - 0 1'), 'b7b8'), 'Q');
  assert.equal(capturedPiece(at('4k3/8/8/8/8/8/8/4K2R w K - 0 1'), 'e1g1'), null);
});
test('captured lists follow the selected history prefix and the capturing side', () => {
  const before = at('7k/8/8/3pP3/8/8/8/7K w - d6 0 1');
  const first: MoveRecord = {
    id: 1,
    before,
    after: before,
    uci: 'e5d6',
    san: 'exd6',
    color: 'white',
    computer: false,
    engine: null,
    classification: null,
    captured_piece: 'p',
  };
  const second: MoveRecord = { ...first, id: 2, color: 'black', captured_piece: 'Q' };
  assert.deepEqual(capturesBy([first, second].slice(0, 1), 'white'), ['p']);
  assert.deepEqual(capturesBy([first, second].slice(0, 1), 'black'), []);
  assert.deepEqual(capturesBy([first, second], 'black'), ['Q']);
});
test('notation from a FEN beginning with Black preserves the actual move number', () => {
  const before = at('7k/8/8/8/8/8/8/K7 b - - 0 37');
  const record: MoveRecord = {
    id: 1,
    before,
    after: before,
    uci: 'h8g8',
    san: 'Kg8',
    color: 'black',
    computer: false,
    engine: null,
    classification: null,
  };
  assert.equal(pgnHistory([record]), '37... Kg8');
});
