import type { Analysis, Color, Position } from './types';

export interface BoardEvaluation {
  kind: 'score' | 'mate' | 'result';
  label: string;
  description: string;
  whiteShare: number;
  whiteScore: number;
  favored: Color | null;
}

export function boardEvaluation(
  position: Position | null,
  analysis: Analysis | null,
): BoardEvaluation | null {
  if (!position) return null;
  if (position.is_game_over) {
    if (!position.result) return null;
    const favored =
      position.result === '1-0' ? 'white' : position.result === '0-1' ? 'black' : null;
    return {
      kind: 'result',
      label: favored ? 'M0' : '½',
      description: position.status,
      favored,
      whiteShare: favored === 'white' ? 100 : favored === 'black' ? 0 : 50,
      whiteScore: favored === 'white' ? 10 : favored === 'black' ? -10 : 0,
    };
  }
  if (
    !analysis ||
    analysis.fen !== position.fen ||
    analysis.side_to_move !== position.turn ||
    analysis.stockfish_error
  )
    return null;
  const candidate = analysis.candidates.find((item) => item.rank === 1) ?? analysis.candidates[0];
  if (!candidate) return null;
  const score = candidate.evaluation;
  const mate = /^#([+-]?\d+)$/.exec(score);
  if (mate) {
    const winner = mate[1].startsWith('-')
      ? analysis.side_to_move === 'white'
        ? 'black'
        : 'white'
      : analysis.side_to_move;
    const distance = Math.abs(Number(mate[1]));
    if (!Number.isSafeInteger(distance)) return null;
    return {
      kind: 'mate',
      label: `M${distance}`,
      favored: winner,
      description: `Stockfish: matto in ${distance} per il ${winner === 'white' ? 'Bianco' : 'Nero'}`,
      whiteShare: winner === 'white' ? 100 : 0,
      whiteScore: winner === 'white' ? 10 : -10,
    };
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(score)) return null;
  const whiteScore = Number(score) * (analysis.side_to_move === 'white' ? 1 : -1);
  if (!Number.isFinite(whiteScore)) return null;
  const rounded = Math.round(whiteScore * 10) / 10;
  const label =
    rounded === 0
      ? '0.0'
      : `${rounded > 0 ? '+' : ''}${Math.abs(rounded) >= 10 ? Math.round(rounded) : rounded.toFixed(1)}`;
  const favored = whiteScore > 0 ? 'white' : whiteScore < 0 ? 'black' : null;
  return {
    kind: 'score',
    label,
    favored,
    whiteScore,
    // A visual scale in pawn units, not a win probability or Maia policy.
    whiteShare: 50 + 50 * Math.tanh(whiteScore / 4),
    description: `Stockfish: ${whiteScore >= 0 ? '+' : ''}${whiteScore.toFixed(2)} · ${favored ? `vantaggio del ${favored === 'white' ? 'Bianco' : 'Nero'}` : 'posizione equilibrata'}`,
  };
}
