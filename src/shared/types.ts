export type Color = 'white' | 'black';
export type GameMode = 'free' | 'computer';
export type ComputerEngine = 'maia' | 'stockfish';
export type AnalysisSource = 'human' | 'stockfish';
export interface MaiaProfile {
  maia_model: '5m' | '79m';
  white_elo: number;
  black_elo: number;
}
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type Promotion = 'q' | 'r' | 'b' | 'n';
export interface LegalMove {
  uci: string;
  from_square: string;
  to_square: string;
  promotion: Promotion | null;
}
export interface Position {
  fen: string;
  legal_moves: LegalMove[];
  turn: Color;
  status: string;
  is_game_over: boolean;
  is_checkmate?: boolean;
  result?: '1-0' | '0-1' | '1/2-1/2' | null;
  last_move_san: string | null;
  last_move_uci: string | null;
}
export interface Classification {
  code: 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  label: string;
  marker: string;
  expected_points_loss: number;
  best_move_san: string | null;
  played_move_san: string;
}
export interface Candidate {
  rank: number;
  uci: string;
  san: string;
  evaluation: string;
  expected_score_percent: number;
  win_percent: number;
  draw_percent: number;
  loss_percent: number;
  principal_variation: string[];
}
export interface Analysis {
  fen: string;
  side_to_move: Color;
  depth: number;
  candidates: Candidate[];
  replies: { after_uci: string; after_san: string; side_to_move: Color; candidates: Candidate[] }[];
  human?: HumanAnalysis | null;
  human_error?: string | null;
  stockfish_error?: string | null;
}
export interface HumanCandidate {
  rank: number;
  uci: string;
  san: string;
  move_probability_percent: number;
  win_percent: number;
  draw_percent: number;
  loss_percent: number;
  stockfish: Candidate | null;
}
export interface HumanAnalysis {
  fen: string;
  model: '5m' | '79m';
  white_elo: number;
  black_elo: number;
  device: string;
  candidates: HumanCandidate[];
  replies: {
    after_uci: string;
    after_san: string;
    side_to_move: Color;
    candidates: HumanCandidate[];
  }[];
}
export interface Health {
  stockfish: boolean;
  codex: boolean;
  codex_authenticated: boolean;
  auth_mode: string;
  model: string;
  maia: boolean;
  maia_models: ('5m' | '79m')[];
}
export interface ModelOption {
  slug: string;
  display_name: string;
  default_reasoning_level: string;
  supported_reasoning_levels: string[];
}
export interface ModelOptions {
  models: ModelOption[];
  configured_model: string | null;
  default_reasoning_level: string;
  catalog_source: string;
}
export interface MoveRecord {
  id: number;
  before: Position;
  after: Position;
  san: string;
  uci: string;
  color: Color;
  computer: boolean;
  engine: ComputerEngine | null;
  classification: Classification | null;
  captured_piece?: string | null;
}
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  fen: string;
  error?: boolean;
}
export const API_ROUTES = [
  '/api/health',
  '/api/codex/options',
  '/api/game/new',
  '/api/game/move',
  '/api/game/computer-move',
  '/api/classify-move',
  '/api/analyze',
  '/api/chat',
  '/api/position',
  '/api/study/position',
  '/api/study/move',
  '/api/library/save',
  '/api/library/list',
  '/api/library/open',
  '/api/library/import',
  '/api/library/export',
  '/api/library/finish',
  '/api/library/review',
  '/api/exercises/list',
  '/api/exercises/attempt',
] as const;
export type ApiRoute = (typeof API_ROUTES)[number];
export type DesktopCommand =
  | 'new-game'
  | 'undo'
  | 'flip'
  | 'analysis'
  | 'toggle-left'
  | 'toggle-right'
  | 'settings';
export interface DesktopBridge {
  request<T>(route: ApiRoute, body?: unknown): Promise<T>;
  onCommand(listener: (command: DesktopCommand) => void): () => void;
}
declare global {
  interface Window {
    yomi: DesktopBridge;
    yomiFlush?: () => Promise<void>;
  }
}
