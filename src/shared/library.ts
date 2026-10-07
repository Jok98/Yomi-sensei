import type {
  Analysis,
  ChatMessage,
  Classification,
  Color,
  ComputerEngine,
  Difficulty,
  GameMode,
  MaiaProfile,
  MoveRecord,
  Position,
} from './types';
import type { BoardMark } from './board-geometry';

export interface ClockState {
  base_ms: number;
  increment_ms: number;
  white_ms: number;
  black_ms: number;
  paused: boolean;
}
export interface GameOptions {
  mode: GameMode;
  engine: ComputerEngine;
  difficulty: Difficulty;
  player_color: Color;
  profile: MaiaProfile;
  training: boolean;
  clock: ClockState | null;
}
export interface StudyVariation {
  id: string;
  title: string;
  root_ply: number;
  moves_uci: string[];
  frames: Position[];
  records: MoveRecord[];
}
export interface GameSnapshot {
  title: string;
  initial_fen: string;
  moves: Pick<MoveRecord, 'uci' | 'computer' | 'engine' | 'classification'>[];
  options: GameOptions;
  chat: ChatMessage[];
  comments: Record<string, string>;
  marks: Record<string, BoardMark[]>;
  variations: Pick<StudyVariation, 'id' | 'title' | 'root_ply' | 'moves_uci'>[];
  tags: Record<string, string>;
}
export interface GameSummary {
  id: string;
  revision: number;
  title: string;
  created_at: string;
  updated_at: string;
  result: '1-0' | '0-1' | '1/2-1/2' | null;
  finish_reason: string | null;
  plies: number;
  options: GameOptions;
}
export interface SavedGame extends GameSummary {
  snapshot: GameSnapshot;
  frames: Position[];
  records: MoveRecord[];
  variations: StudyVariation[];
  review: GameReview | null;
}
export interface ReviewPoint {
  ply: number;
  white_score: number;
  evaluation: string;
  analysis: Analysis;
  classification?: Classification;
}
export interface ReviewMoment {
  ply: number;
  color: Color;
  played: string;
  best: Analysis['candidates'][number];
  loss: number;
  classification: Classification;
  human_probability: number | null;
}
export interface GameReview {
  game_id: string;
  state: 'running' | 'complete' | 'failed' | 'interrupted';
  progress: number;
  report: {
    depth: number;
    created_at?: string;
    points: ReviewPoint[];
    moments?: ReviewMoment[];
    counts?: Record<Color, Record<string, number>>;
    exercise_count?: number;
  } | null;
  error: string | null;
  agent_attempted: boolean;
  agent_state: 'pending' | 'running' | 'unavailable' | 'done' | 'failed';
  summary: string | null;
  agent_error: string | null;
}
export interface Exercise {
  id: string;
  game_id: string;
  game_title: string;
  ply: number;
  fen: string;
  initial_fen: string;
  moves_uci: string[];
  position: Position;
  best_move: string;
  best_san: string;
  acceptable_moves: string[];
  variation: string[];
  played: string;
  classification: Classification;
  depth: number;
  attempts: number;
  successes: number;
  streak: number;
  due_at: string;
  last_attempt: string | null;
}
export interface ExerciseSession {
  exercise: Exercise;
  hint: number;
  solved: boolean;
  feedback: string;
  played_uci?: string;
}

export function formatClock(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
