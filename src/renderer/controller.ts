import { pgnHistory, undoSteps, canPlay } from '../shared/game';
import type {
  Analysis,
  ApiRoute,
  ChatMessage,
  Classification,
  Difficulty,
  GameMode,
  Health,
  ModelOptions,
  MoveRecord,
  Position,
  Promotion,
  ComputerEngine,
  AnalysisSource,
  MaiaProfile,
} from '../shared/types';

export interface Transport {
  request<T>(route: ApiRoute, body?: unknown): Promise<T>;
}
export interface GameState {
  position: Position | null;
  moves: MoveRecord[];
  mode: GameMode;
  difficulty: Difficulty;
  engine: ComputerEngine;
  analysisSource: AnalysisSource;
  maiaProfile: MaiaProfile;
  busy: string | null;
  analysis: Analysis | null;
  analysisPending: boolean;
  analysisError: string | null;
  activeCandidate: string | null;
  error: string | null;
  health: Health | null;
  models: ModelOptions | null;
  chat: ChatMessage[];
  chatBusy: boolean;
}
const message = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    '',
  );

export class GameController {
  private value: GameState = {
    position: null,
    moves: [],
    mode: 'free',
    difficulty: 'medium',
    engine: 'maia',
    analysisSource: 'human',
    maiaProfile: { maia_model: '79m', white_elo: 1500, black_elo: 1500 },
    busy: null,
    analysis: null,
    analysisPending: false,
    analysisError: null,
    activeCandidate: null,
    error: null,
    health: null,
    models: null,
    chat: [],
    chatBusy: false,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private analysisId = 0;
  private serial = 0;
  constructor(private api: Transport) {}
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<GameState>) {
    this.value = { ...this.value, ...patch };
    for (const listener of this.listeners) listener();
  }
  dismissError = () => this.update({ error: null });
  selectCandidate = (uci: string) => this.update({ activeCandidate: uci });
  setDifficulty = (difficulty: Difficulty) => {
    if (!this.value.busy) this.update({ difficulty });
  };
  setEngine = (engine: ComputerEngine) => {
    if (!this.value.busy) this.update({ engine });
  };
  setAnalysisSource = (analysisSource: AnalysisSource) => {
    const analysis = this.value.analysis;
    this.update({
      analysisSource,
      activeCandidate:
        (analysisSource === 'human' ? analysis?.human?.candidates : analysis?.candidates)?.[0]
          ?.uci ?? null,
    });
  };
  setMaiaProfile = (patch: Partial<MaiaProfile>) => {
    if (this.value.busy) return;
    this.invalidateAnalysis();
    this.update({ maiaProfile: { ...this.value.maiaProfile, ...patch } });
    void this.analyze();
  };
  private context(position: Position) {
    return {
      fen: position.fen,
      initial_fen: this.value.moves[0]?.before.fen ?? position.fen,
      moves_uci: this.value.moves.map((move) => move.uci),
    };
  }
  private invalidateAnalysis() {
    this.analysisId++;
    this.update({
      analysis: null,
      analysisPending: false,
      analysisError: null,
      activeCandidate: null,
    });
  }
  async initialize() {
    await Promise.all([this.newGame(), this.loadServices()]);
  }
  async loadServices() {
    await Promise.all([
      this.api
        .request<Health>('/api/health')
        .then((health) => this.update({ health }))
        .catch((error) => this.update({ error: message(error) })),
      this.api
        .request<ModelOptions>('/api/codex/options')
        .then((models) => this.update({ models }))
        .catch((error) => this.update({ error: message(error) })),
    ]);
  }
  async newGame(mode: GameMode = this.value.mode) {
    if (this.value.busy) return;
    const generation = ++this.generation;
    this.invalidateAnalysis();
    this.update({ busy: 'Nuova partita', error: null, chatBusy: false });
    try {
      const position = await this.api.request<Position>('/api/game/new');
      if (generation !== this.generation) return;
      this.update({ position, moves: [], mode, chat: [], chatBusy: false });
    } catch (error) {
      this.update({ error: message(error) });
    } finally {
      this.update({ busy: null });
    }
    if (generation === this.generation && this.value.position) void this.analyze();
  }
  async analyze() {
    const { position, mode } = this.value;
    if (!position || this.value.busy) return;
    const id = ++this.analysisId;
    const generation = this.generation;
    this.update({
      analysis: null,
      activeCandidate: null,
      analysisPending: true,
      analysisError: null,
    });
    try {
      const analysis = await this.api.request<Analysis>('/api/analyze', {
        ...this.context(position),
        ...this.value.maiaProfile,
        include_human: true,
        include_replies: mode === 'free',
      });
      if (
        id !== this.analysisId ||
        generation !== this.generation ||
        this.value.position?.fen !== analysis.fen
      )
        return;
      this.update({
        analysis,
        activeCandidate:
          (this.value.analysisSource === 'human'
            ? analysis.human?.candidates
            : analysis.candidates)?.[0]?.uci ?? null,
      });
    } catch (error) {
      if (id === this.analysisId && generation === this.generation)
        this.update({ analysisError: message(error) });
    } finally {
      if (id === this.analysisId) this.update({ analysisPending: false });
    }
  }
  private commitMove(before: Position, after: Position, computer: boolean): MoveRecord {
    const record: MoveRecord = {
      id: ++this.serial,
      before,
      after,
      san: after.last_move_san!,
      uci: after.last_move_uci!,
      color: before.turn,
      computer,
      engine: computer ? this.value.engine : null,
      classification: null,
    };
    this.invalidateAnalysis();
    this.update({ position: after, moves: [...this.value.moves, record] });
    return record;
  }
  async move(from: string, to: string, promotion: Promotion | null = null) {
    const before = this.value.position;
    if (!canPlay(before, this.value.mode, !!this.value.busy) || !before) return;
    if (
      !before.legal_moves.some(
        (move) =>
          move.from_square === from && move.to_square === to && move.promotion === promotion,
      )
    )
      return;
    const generation = this.generation;
    this.invalidateAnalysis();
    const context = this.context(before);
    this.update({ busy: 'Mossa in corso', error: null });
    try {
      const after = await this.api.request<Position>('/api/game/move', {
        ...context,
        from_square: from,
        to_square: to,
        promotion,
      });
      if (generation !== this.generation) return;
      const record = this.commitMove(before, after, false);
      this.update({ busy: 'Valutazione della mossa' });
      try {
        const classification = await this.api.request<Classification>('/api/classify-move', {
          ...context,
          move_uci: record.uci,
        });
        if (generation === this.generation)
          this.update({
            moves: this.value.moves.map((move) =>
              move.id === record.id ? { ...move, classification } : move,
            ),
          });
      } catch (error) {
        this.update({ error: `Giudizio non disponibile: ${message(error)}` });
      }
      if (this.value.mode === 'computer' && !after.is_game_over && generation === this.generation)
        await this.computerMove();
    } catch (error) {
      if (generation === this.generation) this.update({ error: message(error) });
    } finally {
      if (generation === this.generation) {
        this.update({ busy: null });
        void this.analyze();
      }
    }
  }
  private async computerMove() {
    const before = this.value.position!;
    this.update({
      busy: this.value.engine === 'maia' ? 'Maia sta pensando' : 'Stockfish sta pensando',
    });
    const after = await this.api.request<Position>('/api/game/computer-move', {
      ...this.context(before),
      ...this.value.maiaProfile,
      engine: this.value.engine,
      difficulty: this.value.difficulty,
    });
    this.commitMove(before, after, true);
  }
  async retryComputer() {
    if (
      this.value.busy ||
      this.value.mode !== 'computer' ||
      this.value.position?.turn !== 'black' ||
      this.value.position.is_game_over
    )
      return;
    this.update({ error: null });
    try {
      await this.computerMove();
    } catch (error) {
      this.update({ error: message(error) });
    } finally {
      this.update({ busy: null });
      void this.analyze();
    }
  }
  undo() {
    if (this.value.busy) return;
    const steps = undoSteps(this.value.moves, this.value.mode);
    if (!steps) return;
    const nextMoves = this.value.moves.slice(0, -steps);
    const position = this.value.moves[this.value.moves.length - steps].before;
    this.invalidateAnalysis();
    this.update({ position, moves: nextMoves, error: null });
    void this.analyze();
  }
  async sendChat(text: string, model: string | null, reasoning: string | null) {
    const { position, chatBusy, chat, analysis, activeCandidate } = this.value;
    const clean = text.trim();
    if (!position || chatBusy || !clean) return;
    const generation = this.generation;
    const current = analysis?.fen === position.fen ? analysis : null;
    const reply = current?.replies.find((item) => item.after_uci === activeCandidate);
    this.update({
      chatBusy: true,
      chat: [...chat, { id: ++this.serial, role: 'user', content: clean, fen: position.fen }],
    });
    try {
      const response = await this.api.request<{ answer: string; model: string }>('/api/chat', {
        ...this.context(position),
        pgn: pgnHistory(this.value.moves),
        message: clean,
        history: chat
          .filter((item) => !item.error)
          .slice(-12)
          .map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
        candidates: current?.candidates ?? [],
        opponent_candidates: reply?.candidates ?? [],
        opponent_after_san: reply?.after_san ?? null,
        human_analysis: current?.human ?? null,
        selected_move_uci: activeCandidate,
        model,
        reasoning_effort: reasoning,
      });
      if (generation === this.generation)
        this.update({
          chat: [
            ...this.value.chat,
            { id: ++this.serial, role: 'assistant', content: response.answer, fen: position.fen },
          ],
        });
    } catch (error) {
      if (generation === this.generation)
        this.update({
          chat: [
            ...this.value.chat,
            {
              id: ++this.serial,
              role: 'assistant',
              content: message(error),
              fen: position.fen,
              error: true,
            },
          ],
        });
    } finally {
      if (generation === this.generation) this.update({ chatBusy: false });
    }
  }
}
