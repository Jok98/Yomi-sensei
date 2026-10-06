import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowGeometry, squareAtPoint, squareCenter } from '../../src/shared/board-geometry';

test('square hit testing respects board position, scale and orientation', () => {
  const rect = { left: 120, top: 80, width: 400, height: 400 };
  assert.equal(squareAtPoint(145, 105, rect, 'white'), 'a8');
  assert.equal(squareAtPoint(495, 455, rect, 'white'), 'h1');
  assert.equal(squareAtPoint(345, 405, rect, 'white'), 'e2');
  assert.equal(squareAtPoint(145, 105, rect, 'black'), 'h1');
  assert.equal(squareAtPoint(495, 455, rect, 'black'), 'a8');
  assert.equal(squareAtPoint(345, 405, rect, 'black'), 'd7');
});

test('releasing outside the board cancels a drawing instead of clamping to a square', () => {
  const rect = { left: 120, top: 80, width: 400, height: 400 };
  for (const [x, y] of [
    [119, 200],
    [200, 79],
    [520, 200],
    [200, 480],
  ])
    assert.equal(squareAtPoint(x, y, rect, 'white'), null);
  assert.equal(squareAtPoint(120, 80, { ...rect, width: 0 }, 'white'), null);
});

test('rotating the board moves arrow endpoints to the same chess squares', () => {
  assert.deepEqual(squareCenter('e2', 'white'), { x: 450, y: 650 });
  assert.deepEqual(squareCenter('e2', 'black'), { x: 350, y: 150 });
  const mark = { from: 'e2', to: 'e4' };
  assert.equal(arrowGeometry(mark, 'white')?.path, 'M 450 650 L 450 481');
  assert.equal(arrowGeometry(mark, 'black')?.path, 'M 350 150 L 350 319');
  assert.match(arrowGeometry(mark, 'white')!.head, /^450,450 /);
  assert.match(arrowGeometry(mark, 'black')!.head, /^350,350 /);
});

test('knight annotations use a legible L path and same-square marks become circles', () => {
  assert.equal(
    arrowGeometry({ from: 'g1', to: 'f3' }, 'white')?.path,
    'M 650 750 L 650 550 L 581 550',
  );
  assert.equal(
    arrowGeometry({ from: 'b1', to: 'd2' }, 'white')?.path,
    'M 150 750 L 350 750 L 350 681',
  );
  assert.equal(arrowGeometry({ from: 'e4', to: 'e4' }, 'white'), null);
});
