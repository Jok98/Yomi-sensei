import type { Color, GameMode, MoveRecord, Position } from './types';

export function parseFen(fen: string): Record<string, string> {
  const pieces: Record<string, string> = {};
  fen
    .split(' ')[0]
    .split('/')
    .forEach((row, rowIndex) => {
      let file = 0;
      for (const token of row) {
        if (/\d/.test(token)) file += Number(token);
        else pieces['abcdefgh'[file++] + (8 - rowIndex)] = token;
      }
    });
  return pieces;
}
export function pieceColor(piece: string): Color {
  return piece === piece.toUpperCase() ? 'white' : 'black';
}
export function squares(orientation: Color): string[] {
  const files = orientation === 'white' ? [...'abcdefgh'] : [...'hgfedcba'];
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  return ranks.flatMap((rank) => files.map((file) => file + rank));
}
export function undoSteps(records: MoveRecord[], mode: GameMode, player: Color = 'white'): number {
  if (!records.length) return 0;
  if (mode === 'free') return 1;
  if (records.length === 1 && records[0].computer && player === 'black') return 0;
  return records.at(-1)!.computer ? Math.min(2, records.length) : 1;
}
export function pgnHistory(records: MoveRecord[]): string {
  return records
    .map(
      (move, index) =>
        `${move.color === 'white' ? `${move.before.fen.split(' ')[5]}. ` : index === 0 ? `${move.before.fen.split(' ')[5]}... ` : ''}${move.san}`,
    )
    .join(' ');
}
export function canPlay(
  position: Position | null,
  mode: GameMode,
  busy: boolean,
  player: Color = 'white',
): boolean {
  return (
    !!position && !busy && !position.is_game_over && (mode === 'free' || position.turn === player)
  );
}

export function capturedPiece(before: Position, uci: string): string | null {
  const pieces = parseFen(before.fen);
  const target = pieces[uci.slice(2, 4)];
  if (target) return target;
  const piece = pieces[uci.slice(0, 2)];
  if (piece?.toLowerCase() === 'p' && uci[0] !== uci[2]) return before.turn === 'white' ? 'p' : 'P';
  return null;
}

export function capturesBy(records: MoveRecord[], color: Color): string[] {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return records
    .filter((move) => move.color === color)
    .map((move) => move.captured_piece ?? capturedPiece(move.before, move.uci))
    .filter((piece): piece is string => !!piece)
    .sort((a, b) => values[b.toLowerCase()] - values[a.toLowerCase()]);
}
