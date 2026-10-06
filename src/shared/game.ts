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
export function undoSteps(records: MoveRecord[], mode: GameMode): number {
  if (!records.length) return 0;
  if (mode === 'free') return 1;
  return records.at(-1)!.computer ? Math.min(2, records.length) : 1;
}
export function pgnHistory(records: MoveRecord[]): string {
  return records
    .map((move, index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}${move.san}`)
    .join(' ');
}
export function canPlay(position: Position | null, mode: GameMode, busy: boolean): boolean {
  return (
    !!position && !busy && !position.is_game_over && (mode === 'free' || position.turn === 'white')
  );
}
