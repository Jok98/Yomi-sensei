import type { Color } from './types';

export interface BoardMark {
  from: string;
  to: string;
}
interface Point {
  x: number;
  y: number;
}

// SVG coordinates use 100 units per square, independently of screen size or zoom.
export function squareCenter(square: string, orientation: Color): Point {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === 'white'
    ? { x: file * 100 + 50, y: (7 - rank) * 100 + 50 }
    : { x: (7 - file) * 100 + 50, y: rank * 100 + 50 };
}

export function squareAtPoint(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
  orientation: Color,
): string | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const column = Math.floor(((x - rect.left) / rect.width) * 8);
  const row = Math.floor(((y - rect.top) / rect.height) * 8);
  if (column < 0 || column > 7 || row < 0 || row > 7) return null;
  return orientation === 'white' ? 'abcdefgh'[column] + (8 - row) : 'hgfedcba'[column] + (row + 1);
}

export function arrowGeometry(mark: BoardMark, orientation: Color) {
  const start = squareCenter(mark.from, orientation);
  const tip = squareCenter(mark.to, orientation);
  if (mark.from === mark.to) return null;
  const dx = tip.x - start.x;
  const dy = tip.y - start.y;
  const knight = Math.abs(dx * dy) === 20_000 && Math.abs(dx) + Math.abs(dy) === 300;
  const elbow = knight
    ? Math.abs(dx) > Math.abs(dy)
      ? { x: tip.x, y: start.y }
      : { x: start.x, y: tip.y }
    : start;
  const length = Math.hypot(tip.x - elbow.x, tip.y - elbow.y);
  const ux = (tip.x - elbow.x) / length;
  const uy = (tip.y - elbow.y) / length;
  const base = { x: tip.x - ux * 31, y: tip.y - uy * 31 };
  const path = `M ${start.x} ${start.y}${knight ? ` L ${elbow.x} ${elbow.y}` : ''} L ${base.x} ${base.y}`;
  const head = `${tip.x},${tip.y} ${base.x - uy * 19},${base.y + ux * 19} ${base.x + uy * 19},${base.y - ux * 19}`;
  return { path, head };
}
