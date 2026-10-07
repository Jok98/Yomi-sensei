import { pgnHistory, undoSteps, canPlay, capturedPiece } from '../shared/game';
import type { BoardMark } from '../shared/board-geometry';
import type {
  Analysis,
  ApiRoute,
  ChatMessage,
  Classification,
  Color,
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
import type {
  ClockState,
  Exercise,
  ExerciseSession,
  GameReview,
  GameSnapshot,
  GameSummary,
  SavedGame,
  StudyVariation,
} from '../shared/library';

export interface Transport {
  request<T>(route: ApiRoute, body?: unknown): Promise<T>;
}
export interface GameState {
  position: Position | null;
  livePosition: Position | null;
  initialPosition: Position | null;
  moves: MoveRecord[];
  mode: GameMode;
  difficulty: Difficulty;
  engine: ComputerEngine;
  analysisSource: AnalysisSource;
  maiaProfile: MaiaProfile;
  playerColor: Color;
  training: boolean;
  hintsRevealed: boolean;
  clock: ClockState | null;
  busy: string | null;
  analysis: Analysis | null;
  analysisPending: boolean;
  humanPending: boolean;
  analysisError: string | null;
  activeCandidate: string | null;
  error: string | null;
  health: Health | null;
  models: ModelOptions | null;
  chat: ChatMessage[];
  chatBusy: boolean;
  gameId: string | null;
  title: string;
  gameResult: GameSummary['result'];
  library: GameSummary[];
  libraryPending: boolean;
  savePending: boolean;
  savedAt: string | null;
  historyPly: number | null;
  variationId: string | null;
  variations: StudyVariation[];
  comments: Record<string, string>;
  marks: Record<string, BoardMark[]>;
  tags: Record<string, string>;
  review: GameReview | null;
  exercises: Exercise[];
  exercise: ExerciseSession | null;
  mateNotice: Color | null;
}
export function pathRecords(game: GameState): MoveRecord[] {
  const branch = game.variations.find((item) => item.id === game.variationId);
  return branch ? [...game.moves.slice(0, branch.root_ply), ...branch.records] : game.moves;
}
export function visibleRecords(game: GameState): MoveRecord[] {
  if (game.exercise) return game.moves.slice(0, game.exercise.exercise.ply);
  const records = pathRecords(game);
  return records.slice(0, game.historyPly ?? records.length);
}
export function studyKey(game: GameState): string {
  const branch = game.variations.find((item) => item.id === game.variationId);
  const ply = game.historyPly ?? pathRecords(game).length;
  return `${branch?.id ?? 'main'}:${branch ? Math.max(0, ply - branch.root_ply) : ply}`;
}
export function hintsHidden(game: GameState): boolean {
  return !!game.exercise || (game.training && !game.hintsRevealed && !game.gameResult);
}
const message = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    '',
  );

export class GameController {
  private value: GameState = {
    position: null,
    livePosition: null,
    initialPosition: null,
    moves: [],
    mode: 'free',
    difficulty: 'medium',
    engine: 'maia',
    analysisSource: 'human',
    maiaProfile: { maia_model: '79m', white_elo: 1500, black_elo: 1500 },
    playerColor: 'white',
    training: false,
    hintsRevealed: false,
    clock: null,
    busy: null,
    analysis: null,
    analysisPending: false,
    humanPending: false,
    analysisError: null,
    activeCandidate: null,
    error: null,
    health: null,
    models: null,
    chat: [],
    chatBusy: false,
    gameId: null,
    title: '',
    gameResult: null,
    library: [],
    libraryPending: false,
    savePending: false,
    savedAt: null,
    historyPly: null,
    variationId: null,
    variations: [],
    comments: {},
    marks: {},
    tags: {},
    review: null,
    exercises: [],
    exercise: null,
    mateNotice: null,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private analysisId = 0;
  private serial = 0;
  private revision = 0;
  private saveChain: Promise<void> = Promise.resolve();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private reviewTimer: ReturnType<typeof setTimeout> | undefined;
  private clockAnchor: number | null = null;
  private lastClockSave = 0;
  private finishing = false;
  private transitioning = false;
  private saveFailed = false;
  private libraryRequestId = 0;
  constructor(private api: Transport) {}
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(patch: Partial<GameState>) {
    this.value = { ...this.value, ...patch };
    for (const listener of this.listeners) listener();
  }
  dismissError = () => this.update({ error: null });
  selectCandidate = (uci: string) => this.update({ activeCandidate: uci });
  setDifficulty = (difficulty: Difficulty) => {
    if (!this.value.busy) {
      this.update({ difficulty });
      this.scheduleSave();
    }
  };
  setEngine = (engine: ComputerEngine) => {
    if (!this.value.busy) {
      this.update({ engine });
      this.scheduleSave();
    }
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
    this.scheduleSave();
    void this.analyze();
  };
  setTraining = (training: boolean) => {
    this.update({ training, hintsRevealed: false });
    this.scheduleSave();
  };
  revealHints = () => this.update({ hintsRevealed: true });
  dismissMate = () => this.update({ mateNotice: null });
  setTitle = (title: string) => {
    this.update({ title: title.slice(0, 100) });
    this.scheduleSave();
  };
  setComment = (text: string) => {
    this.update({
      comments: { ...this.value.comments, [studyKey(this.value)]: text.slice(0, 4000) },
    });
    this.scheduleSave();
  };
  setMarks = (marks: BoardMark[]) => {
    this.update({ marks: { ...this.value.marks, [studyKey(this.value)]: marks.slice(0, 64) } });
    this.scheduleSave();
  };

  private context(position: Position) {
    if (this.value.exercise) {
      const exercise = this.value.exercise;
      return {
        fen: position.fen,
        initial_fen: exercise.exercise.initial_fen,
        moves_uci: [
          ...exercise.exercise.moves_uci,
          ...(exercise.played_uci ? [exercise.played_uci] : []),
        ],
      };
    }
    return {
      fen: position.fen,
      initial_fen:
        this.value.initialPosition?.fen ?? this.value.moves[0]?.before.fen ?? position.fen,
      moves_uci: visibleRecords(this.value).map((move) => move.uci),
    };
  }
  private invalidateAnalysis() {
    this.analysisId++;
    this.update({
      analysis: null,
      analysisPending: false,
      humanPending: false,
      analysisError: null,
      activeCandidate: null,
    });
  }
  async initialize() {
    await Promise.all([this.loadServices(), this.loadLibrary(), this.loadExercises()]);
    if (this.value.library[0]) await this.openGame(this.value.library[0].id);
    else await this.newGame();
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
  async loadLibrary(query = '') {
    const requestId = ++this.libraryRequestId;
    this.update({ libraryPending: true });
    try {
      const response = await this.api.request<{ games: GameSummary[] }>('/api/library/list', {
        query,
      });
      if (requestId === this.libraryRequestId) this.update({ library: response.games });
    } catch (error) {
      this.update({ error: `Archivio: ${message(error)}` });
    } finally {
      if (requestId === this.libraryRequestId) this.update({ libraryPending: false });
    }
  }
  async loadExercises() {
    try {
      const response = await this.api.request<{ exercises: Exercise[] }>('/api/exercises/list', {});
      this.update({ exercises: response.exercises });
    } catch (error) {
      this.update({ error: `Allenamento: ${message(error)}` });
    }
  }
  private snapshot(): GameSnapshot | null {
    if (!this.value.initialPosition) return null;
    return {
      title: this.value.title,
      initial_fen: this.value.initialPosition.fen,
      moves: this.value.moves.map(({ uci, computer, engine, classification }) => ({
        uci,
        computer,
        engine,
        classification,
      })),
      options: {
        mode: this.value.mode,
        engine: this.value.engine,
        difficulty: this.value.difficulty,
        player_color: this.value.playerColor,
        profile: this.value.maiaProfile,
        training: this.value.training,
        clock: this.value.clock,
      },
      chat: this.value.chat
        .slice(-100)
        .map((item) => ({ ...item, content: item.content.slice(0, 12000) })),
      comments: this.value.comments,
      marks: this.value.marks,
      tags: this.value.tags,
      variations: this.value.variations.map(({ id, title, root_ply, moves_uci }) => ({
        id,
        title,
        root_ply,
        moves_uci,
      })),
    };
  }
  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.update({ savePending: true });
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      void this.persistNow().catch(() => {});
    }, 180);
    (this.saveTimer as unknown as { unref?: () => void }).unref?.();
  }
  private persistNow(): Promise<void> {
    const snapshot = this.snapshot();
    const gameId = this.value.gameId;
    if (!snapshot) return this.saveChain;
    const revision = ++this.revision;
    this.update({ savePending: true });
    this.saveChain = this.saveChain
      .catch(() => {})
      .then(async () => {
        try {
          const saved = await this.api.request<GameSummary>('/api/library/save', {
            game_id: gameId,
            revision,
            snapshot,
          });
          if (this.value.gameId === gameId) {
            this.saveFailed = false;
            this.update({
              gameId: saved.id,
              title: snapshot.title || saved.title,
              savedAt: saved.updated_at,
              savePending: !!this.saveTimer || revision < this.revision,
              gameResult: saved.result ?? this.value.gameResult,
              ...(this.value.error?.startsWith('Salvataggio') ? { error: null } : {}),
            });
          }
          const current = this.value.library.filter((item) => item.id !== saved.id);
          this.update({ library: [saved, ...current] });
        } catch (error) {
          this.saveFailed = true;
          this.update({ error: `Salvataggio non riuscito: ${message(error)}`, savePending: true });
          throw error;
        }
      });
    return this.saveChain;
  }
  async flushSave() {
    if (this.saveTimer || this.saveFailed) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
      await this.persistNow();
    } else await this.saveChain;
  }
  async prepareClose() {
    ++this.generation;
    ++this.analysisId;
    this.update({
      busy: 'Salvataggio partita',
      chatBusy: false,
      analysisPending: false,
      humanPending: false,
    });
    this.pauseClock();
    try {
      await this.flushSave();
    } finally {
      this.update({ busy: null });
    }
  }
  dispose() {
    clearTimeout(this.saveTimer);
    clearTimeout(this.reviewTimer);
  }

  async newGame(
    mode: GameMode = this.value.mode,
    color: Color | 'random' = this.value.playerColor,
  ) {
    if (this.value.busy || this.transitioning) return;
    this.transitioning = true;
    this.update({ busy: 'Nuova partita' });
    this.pauseClock();
    try {
      await this.flushSave();
    } catch {
      this.transitioning = false;
      this.update({ busy: null });
      return;
    }
    const generation = ++this.generation;
    clearTimeout(this.reviewTimer);
    this.invalidateAnalysis();
    this.update({ busy: 'Nuova partita', error: null, chatBusy: false });
    try {
      const position = await this.api.request<Position>('/api/game/new');
      if (generation !== this.generation) return;
      const playerColor = color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color;
      const oldClock = this.value.clock;
      const clock = oldClock
        ? { ...oldClock, white_ms: oldClock.base_ms, black_ms: oldClock.base_ms, paused: false }
        : null;
      this.revision = 1;
      this.saveFailed = false;
      this.update({
        position,
        livePosition: position,
        initialPosition: position,
        moves: [],
        mode,
        playerColor,
        clock,
        chat: [],
        chatBusy: false,
        gameId: null,
        title: '',
        gameResult: position.result ?? null,
        savedAt: null,
        savePending: true,
        historyPly: null,
        variationId: null,
        variations: [],
        comments: {},
        marks: {},
        tags: {},
        review: null,
        exercise: null,
        hintsRevealed: false,
        mateNotice: null,
      });
      const saved = await this.api.request<GameSummary>('/api/library/save', {
        revision: 1,
        snapshot: this.snapshot(),
      });
      if (generation !== this.generation) return;
      this.update({
        gameId: saved.id,
        title: saved.title,
        savedAt: saved.updated_at,
        savePending: false,
        library: [saved, ...this.value.library],
      });
      this.clockAnchor = clock ? Date.now() : null;
      if (mode === 'computer' && playerColor === 'black') await this.computerMove(generation);
    } catch (error) {
      this.saveFailed = !this.value.gameId;
      this.update({
        error: this.saveFailed ? `Salvataggio non riuscito: ${message(error)}` : message(error),
      });
    } finally {
      this.transitioning = false;
      if (generation === this.generation) this.update({ busy: null });
    }
    if (generation === this.generation && this.value.position) void this.analyze();
  }
  private install(saved: SavedGame) {
    const options = saved.options;
    const last = saved.frames.at(-1)!;
    this.revision = saved.revision;
    this.clockAnchor = null;
    this.serial = Math.max(
      this.serial,
      ...saved.records.map((move) => move.id),
      ...saved.variations.flatMap((branch) => branch.records.map((move) => move.id)),
      ...saved.snapshot.chat.map((item) => item.id),
    );
    this.update({
      gameId: saved.id,
      title: saved.title,
      savedAt: saved.updated_at,
      gameResult: saved.result,
      initialPosition: saved.frames[0],
      livePosition: last,
      position: last,
      moves: saved.records,
      mode: options.mode,
      playerColor: options.player_color,
      engine: options.engine,
      difficulty: options.difficulty,
      maiaProfile: options.profile,
      training: options.training,
      hintsRevealed: false,
      clock: options.clock ? { ...options.clock, paused: true } : null,
      historyPly: saved.records.length,
      variationId: null,
      variations: saved.variations,
      comments: saved.snapshot.comments,
      marks: saved.snapshot.marks,
      tags: saved.snapshot.tags,
      chat: saved.snapshot.chat,
      chatBusy: false,
      review: saved.review,
      exercise: null,
      mateNotice: null,
      analysisSource: saved.result ? 'stockfish' : this.value.analysisSource,
    });
  }
  async openGame(gameId: string) {
    if (this.value.busy || this.transitioning) return;
    this.transitioning = true;
    this.update({ busy: 'Apertura partita' });
    this.pauseClock();
    try {
      await this.flushSave();
    } catch {
      this.transitioning = false;
      this.update({ busy: null });
      return;
    }
    const generation = ++this.generation;
    clearTimeout(this.reviewTimer);
    this.invalidateAnalysis();
    this.update({ busy: 'Apertura partita', error: null });
    try {
      const saved = await this.api.request<SavedGame>('/api/library/open', { game_id: gameId });
      if (generation === this.generation) this.install(saved);
    } catch (error) {
      this.update({ error: message(error) });
    } finally {
      this.transitioning = false;
      if (generation === this.generation) this.update({ busy: null });
    }
    if (generation === this.generation) {
      void this.analyze();
      if (this.value.gameResult) void this.refreshReview();
    }
  }
  async importGames(text: string, kind: 'pgn' | 'fen') {
    await this.flushSave();
    const response = await this.api.request<{ games: { id: string }[] }>(
      '/api/library/import',
      kind === 'fen' ? { fen: text } : { pgn: text },
    );
    await this.loadLibrary();
    if (response.games[0]) await this.openGame(response.games[0].id);
  }
  async exportPgn(): Promise<string> {
    await this.flushSave();
    if (!this.value.gameId) throw new Error('Nessuna partita salvata.');
    return (
      await this.api.request<{ pgn: string }>('/api/library/export', { game_id: this.value.gameId })
    ).pgn;
  }
  navigate(ply: number, variationId: string | null = this.value.variationId) {
    if (this.value.busy || this.value.exercise) return;
    this.pauseClock();
    this.invalidateAnalysis();
    const branch = this.value.variations.find((item) => item.id === variationId);
    const records = branch
      ? [...this.value.moves.slice(0, branch.root_ply), ...branch.records]
      : this.value.moves;
    const nextPly = Math.max(0, Math.min(records.length, ply));
    const position = nextPly ? records[nextPly - 1].after : this.value.initialPosition;
    this.update({ historyPly: nextPly, variationId: branch?.id ?? null, position, error: null });
    void this.analyze();
  }
  previous = () => this.navigate((this.value.historyPly ?? pathRecords(this.value).length) - 1);
  next = () => this.navigate((this.value.historyPly ?? pathRecords(this.value).length) + 1);
  async resumeGame() {
    if (this.value.busy || this.value.gameResult) return;
    this.invalidateAnalysis();
    this.update({
      historyPly: null,
      variationId: null,
      position: this.value.livePosition,
      exercise: null,
      error: null,
    });
    this.resumeClock();
    if (this.value.mode === 'computer' && this.value.position?.turn !== this.value.playerColor)
      await this.retryComputer();
    else void this.analyze();
  }
  async startVariation() {
    if (
      !this.value.position ||
      this.value.busy ||
      this.value.exercise ||
      !this.value.position.legal_moves.length
    )
      return;
    const root = this.value.historyPly ?? this.value.moves.length;
    if (this.value.variationId) return;
    const id = crypto.randomUUID();
    const generation = this.generation;
    this.update({ busy: 'Preparazione variante' });
    try {
      const position = await this.api.request<Position>(
        '/api/study/position',
        this.context(this.value.position),
      );
      if (generation !== this.generation) return;
      this.pauseClock();
      this.invalidateAnalysis();
      const branch: StudyVariation = {
        id,
        title: `Variante alla mossa ${Math.floor(root / 2) + 1}`,
        root_ply: root,
        moves_uci: [],
        frames: [position],
        records: [],
      };
      this.update({
        variations: [...this.value.variations, branch],
        variationId: id,
        historyPly: root,
        position,
      });
      this.scheduleSave();
    } catch (error) {
      if (generation === this.generation) this.update({ error: message(error) });
    } finally {
      if (generation === this.generation) {
        this.update({ busy: null });
        void this.analyze();
      }
    }
  }
  async analyze() {
    const { position } = this.value;
    if (!position || this.value.busy || this.value.exercise) return;
    const id = ++this.analysisId;
    const generation = this.generation;
    const cached =
      !this.value.variationId && this.value.gameResult
        ? this.value.review?.report?.points[this.value.historyPly ?? this.value.moves.length]
            ?.analysis
        : null;
    if (cached && cached.fen === position.fen) {
      this.update({
        analysis: cached,
        analysisPending: false,
        humanPending: false,
        activeCandidate: cached.candidates[0]?.uci ?? null,
      });
      return;
    }
    const context = this.context(position);
    const profile = { ...this.value.maiaProfile };
    const valid = () =>
      id === this.analysisId &&
      generation === this.generation &&
      this.value.position?.fen === position.fen;
    this.update({
      analysis: null,
      activeCandidate: null,
      analysisPending: true,
      humanPending: true,
      analysisError: null,
    });
    try {
      const fast = await this.api.request<Analysis>('/api/analyze', {
        ...context,
        ...profile,
        depth: 8,
        study: this.value.historyPly !== null,
        include_human: false,
        include_replies: false,
      });
      if (!valid()) return;
      this.update({
        analysis: fast,
        analysisPending: false,
        activeCandidate:
          this.value.analysisSource === 'stockfish' ? (fast.candidates[0]?.uci ?? null) : null,
      });
      const analysis = await this.api.request<Analysis>('/api/analyze', {
        ...context,
        ...profile,
        include_human: true,
        study: this.value.historyPly !== null,
        include_replies: this.value.mode === 'free',
      });
      if (!valid()) return;
      this.update({
        analysis,
        activeCandidate:
          (this.value.analysisSource === 'human'
            ? analysis.human?.candidates
            : analysis.candidates)?.[0]?.uci ?? null,
      });
    } catch (error) {
      if (valid()) this.update({ analysisError: message(error) });
    } finally {
      if (valid()) this.update({ analysisPending: false, humanPending: false });
    }
  }
  private commitMove(before: Position, after: Position, computer: boolean): MoveRecord {
    this.consumeClock();
    const clock = this.value.clock;
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
      captured_piece: capturedPiece(before, after.last_move_uci!),
    };
    const nextClock = clock
      ? {
          ...clock,
          [`${before.turn}_ms`]: Math.min(
            86400000,
            clock[`${before.turn}_ms`] + clock.increment_ms,
          ),
          paused: after.is_game_over,
        }
      : null;
    this.invalidateAnalysis();
    this.update({
      position: after,
      livePosition: after,
      moves: [...this.value.moves, record],
      gameResult: after.result ?? null,
      clock: nextClock,
      mateNotice: after.is_checkmate
        ? after.result === '1-0'
          ? 'white'
          : 'black'
        : this.value.mateNotice,
    });
    this.clockAnchor = nextClock && !nextClock.paused ? Date.now() : null;
    this.scheduleSave();
    return record;
  }
  private async judge(
    record: MoveRecord,
    context: ReturnType<GameController['context']>,
    generation: number,
  ) {
    try {
      const classification = await this.api.request<Classification>('/api/classify-move', {
        ...context,
        move_uci: record.uci,
      });
      if (
        generation === this.generation &&
        this.value.moves.some((move) => move.id === record.id)
      ) {
        this.update({
          moves: this.value.moves.map((move) =>
            move.id === record.id ? { ...move, classification } : move,
          ),
        });
        this.scheduleSave();
      }
    } catch (error) {
      if (generation === this.generation)
        this.update({ error: `Giudizio non disponibile: ${message(error)}` });
    }
  }
  async move(from: string, to: string, promotion: Promotion | null = null) {
    const before = this.value.position;
    if (
      !before ||
      this.value.busy ||
      !this.value.gameId ||
      !before.legal_moves.some(
        (move) =>
          move.from_square === from && move.to_square === to && move.promotion === promotion,
      )
    )
      return;
    if (this.value.exercise) {
      await this.attemptExercise(from + to + (promotion ?? ''));
      return;
    }
    if (this.value.historyPly !== null) {
      if (!this.value.variationId) return;
      await this.variationMove(from, to, promotion);
      return;
    }
    if (!canPlay(before, this.value.mode, false, this.value.playerColor)) return;
    const generation = this.generation;
    this.invalidateAnalysis();
    const context = this.context(before);
    this.update({ busy: 'Mossa in corso', error: null, hintsRevealed: false });
    try {
      const after = await this.api.request<Position>('/api/game/move', {
        ...context,
        from_square: from,
        to_square: to,
        promotion,
      });
      if (generation !== this.generation) return;
      if (await this.clockExpired(before.turn)) return;
      const record = this.commitMove(before, after, false);
      void this.judge(record, context, generation);
      if (this.value.mode === 'computer' && !after.is_game_over)
        await this.computerMove(generation);
    } catch (error) {
      if (generation === this.generation) this.update({ error: message(error) });
    } finally {
      if (generation === this.generation) {
        this.update({ busy: null });
        if (this.value.gameResult) {
          this.pauseClock();
          try {
            await this.flushSave();
            void this.refreshReview();
          } catch {
            // Retain the unsaved terminal position for an explicit save retry.
          }
        }
        void this.analyze();
      }
    }
  }
  private async computerMove(generation = this.generation) {
    const before = this.value.livePosition!;
    this.update({
      busy: this.value.engine === 'maia' ? 'Maia sta pensando' : 'Stockfish sta pensando',
    });
    const context = this.context(before);
    const after = await this.api.request<Position>('/api/game/computer-move', {
      ...context,
      ...this.value.maiaProfile,
      engine: this.value.engine,
      difficulty: this.value.difficulty,
    });
    if (generation !== this.generation || this.value.gameResult) return;
    if (await this.clockExpired(before.turn)) return;
    const record = this.commitMove(before, after, true);
    void this.judge(record, context, generation);
  }
  async retryComputer() {
    if (
      this.value.busy ||
      this.value.mode !== 'computer' ||
      this.value.historyPly !== null ||
      this.value.position?.turn === this.value.playerColor ||
      this.value.position?.is_game_over
    )
      return;
    const generation = this.generation;
    this.update({ error: null });
    try {
      await this.computerMove(generation);
    } catch (error) {
      if (generation === this.generation) this.update({ error: message(error) });
    } finally {
      if (generation === this.generation) {
        this.update({ busy: null });
        void this.analyze();
        if (this.value.gameResult) {
          await this.flushSave();
          void this.refreshReview();
        }
      }
    }
  }
  undo() {
    if (this.value.busy || this.value.gameResult || this.value.exercise) return;
    if (this.value.historyPly !== null) {
      this.previous();
      return;
    }
    const steps = undoSteps(this.value.moves, this.value.mode, this.value.playerColor);
    if (!steps) return;
    const nextMoves = this.value.moves.slice(0, -steps);
    const annotated = [
      ...Object.entries(this.value.comments),
      ...Object.entries(this.value.marks),
    ].some(
      ([key, value]) =>
        key.startsWith('main:') && Number(key.slice(5)) > nextMoves.length && value.length > 0,
    );
    if (annotated || this.value.variations.some((branch) => branch.root_ply > nextMoves.length)) {
      this.update({
        error:
          'Queste mosse contengono note o varianti salvate. Usa Mossa precedente per esplorarle.',
      });
      return;
    }
    const position = this.value.moves[this.value.moves.length - steps].before;
    this.consumeClock();
    this.invalidateAnalysis();
    this.update({ position, livePosition: position, moves: nextMoves, error: null });
    this.scheduleSave();
    void this.analyze();
  }
  private async variationMove(from: string, to: string, promotion: Promotion | null) {
    const before = this.value.position!;
    const id = this.value.variationId!;
    const branch = this.value.variations.find((item) => item.id === id)!;
    const ply = this.value.historyPly!;
    const length = ply - branch.root_ply;
    if (length !== branch.records.length) {
      this.update({ error: 'Torna alla fine della variante per aggiungere una mossa.' });
      return;
    }
    const generation = this.generation;
    this.update({ busy: 'Variante', error: null });
    try {
      const after = await this.api.request<Position>('/api/study/move', {
        ...this.context(before),
        from_square: from,
        to_square: to,
        promotion,
      });
      if (generation !== this.generation) return;
      const record: MoveRecord = {
        id: ++this.serial,
        before,
        after,
        san: after.last_move_san!,
        uci: after.last_move_uci!,
        color: before.turn,
        computer: false,
        engine: null,
        classification: null,
        captured_piece: capturedPiece(before, after.last_move_uci!),
      };
      this.invalidateAnalysis();
      this.update({
        position: after,
        historyPly: ply + 1,
        variations: this.value.variations.map((item) =>
          item.id === id
            ? {
                ...item,
                records: [...item.records, record],
                frames: [...item.frames, after],
                moves_uci: [...item.moves_uci, record.uci],
              }
            : item,
        ),
      });
      this.scheduleSave();
    } catch (error) {
      this.update({ error: message(error) });
    } finally {
      this.update({ busy: null });
      void this.analyze();
    }
  }
  setTimeControl(baseMs: number, incrementMs = 0) {
    if (
      this.value.moves.some((move) => !move.computer) ||
      this.value.moves.length > 1 ||
      this.value.busy ||
      this.value.gameResult
    )
      return;
    this.update({
      clock: baseMs
        ? {
            base_ms: baseMs,
            increment_ms: incrementMs,
            white_ms: baseMs,
            black_ms: baseMs,
            paused: this.value.historyPly !== null,
          }
        : null,
    });
    this.clockAnchor = baseMs && this.value.historyPly === null ? Date.now() : null;
    this.scheduleSave();
  }
  private consumeClock(time = Date.now()) {
    const clock = this.value.clock;
    const turn = this.value.livePosition?.turn;
    if (!clock || clock.paused || this.clockAnchor === null || !turn) return;
    const elapsed = Math.max(0, time - this.clockAnchor);
    this.clockAnchor = time;
    this.update({
      clock: { ...clock, [`${turn}_ms`]: Math.max(0, clock[`${turn}_ms`] - elapsed) },
    });
  }
  private async clockExpired(turn: Color): Promise<boolean> {
    this.consumeClock();
    if (this.value.clock && !this.value.clock.paused && this.value.clock[`${turn}_ms`] === 0) {
      await this.finishGame('timeout', turn);
      return true;
    }
    return false;
  }
  pauseClock() {
    this.consumeClock();
    this.clockAnchor = null;
    if (this.value.clock && !this.value.clock.paused) {
      this.update({ clock: { ...this.value.clock, paused: true } });
      this.scheduleSave();
    }
  }
  resumeClock() {
    if (this.value.clock && !this.value.gameResult && this.value.historyPly === null) {
      this.update({ clock: { ...this.value.clock, paused: false } });
      this.clockAnchor = Date.now();
      this.scheduleSave();
    }
  }
  tick(time = Date.now()) {
    if (this.value.historyPly !== null || this.value.exercise || this.value.gameResult) return;
    this.consumeClock(time);
    const clock = this.value.clock;
    const turn = this.value.livePosition?.turn;
    if (clock && !clock.paused && turn) {
      if (clock[`${turn}_ms`] === 0 && !this.finishing) void this.finishGame('timeout', turn);
      else if (time - this.lastClockSave >= 5000) {
        this.lastClockSave = time;
        this.scheduleSave();
      }
    }
  }
  async finishGame(
    reason: 'resignation' | 'draw' | 'timeout',
    color: Color = this.value.mode === 'computer'
      ? this.value.playerColor
      : (this.value.livePosition?.turn ?? 'white'),
  ) {
    if (
      !this.value.gameId ||
      this.value.gameResult ||
      this.finishing ||
      (this.value.busy && reason !== 'timeout')
    )
      return;
    this.finishing = true;
    this.pauseClock();
    const generation = ++this.generation;
    this.invalidateAnalysis();
    this.update({ busy: 'Conclusione partita', chatBusy: false });
    try {
      await this.flushSave();
      const saved = await this.api.request<SavedGame>('/api/library/finish', {
        game_id: this.value.gameId,
        reason,
        color,
      });
      if (generation === this.generation) {
        this.install(saved);
        void this.refreshReview();
        void this.loadLibrary();
      }
    } catch (error) {
      this.update({ error: message(error) });
    } finally {
      this.finishing = false;
      this.update({ busy: null });
      void this.analyze();
    }
  }
  async refreshReview(runAgent = false) {
    const gameId = this.value.gameId;
    if (!gameId || !this.value.gameResult) return;
    try {
      const review = await this.api.request<GameReview>('/api/library/review', {
        game_id: gameId,
        run_agent: runAgent,
      });
      if (this.value.gameId !== gameId) return;
      this.update({
        review,
        ...(review.state === 'complete' && review.report
          ? {
              moves: this.value.moves.map((move, index) => ({
                ...move,
                classification:
                  review.report!.points[index + 1]?.classification ?? move.classification,
              })),
            }
          : {}),
      });
      clearTimeout(this.reviewTimer);
      if (review.state === 'running' || review.agent_state === 'running') {
        this.reviewTimer = setTimeout(() => void this.refreshReview(), 1200);
        (this.reviewTimer as unknown as { unref?: () => void }).unref?.();
      } else if (review.state === 'complete') {
        void this.loadExercises();
        if (!this.value.exercise) void this.analyze();
      }
    } catch (error) {
      this.update({ error: `Revisione: ${message(error)}` });
    }
  }
  async startExercise(exercise: Exercise) {
    if (this.value.busy) return;
    if (this.value.gameId !== exercise.game_id) await this.openGame(exercise.game_id);
    this.pauseClock();
    ++this.generation;
    this.invalidateAnalysis();
    this.update({
      position: exercise.position,
      historyPly: exercise.ply,
      variationId: null,
      exercise: { exercise, hint: 0, solved: false, feedback: '' },
    });
  }
  exerciseHint = () => {
    if (this.value.exercise)
      this.update({
        exercise: { ...this.value.exercise, hint: Math.min(3, this.value.exercise.hint + 1) },
      });
  };
  async attemptExercise(uci: string) {
    const session = this.value.exercise;
    if (!session || session.solved || this.value.busy) return;
    this.update({ busy: 'Verifica esercizio' });
    try {
      const result = await this.api.request<{
        correct: boolean;
        position: Position;
        due_at: string;
      }>('/api/exercises/attempt', { exercise_id: session.exercise.id, move_uci: uci });
      if (this.value.exercise?.exercise.id !== session.exercise.id) return;
      this.update({
        exercise: {
          ...session,
          solved: result.correct,
          played_uci: result.correct ? uci : undefined,
          feedback: result.correct
            ? 'Corretto. La posizione tornerà nel ripasso.'
            : 'Questa mossa non risolve il problema. Riprova o chiedi un suggerimento.',
        },
        position: result.correct ? result.position : session.exercise.position,
      });
      void this.loadExercises();
    } catch (error) {
      this.update({ error: message(error) });
    } finally {
      this.update({ busy: null });
    }
  }
  stopExercise() {
    this.update({ exercise: null });
    this.navigate(this.value.moves.length, null);
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
    this.scheduleSave();
    try {
      const response = await this.api.request<{ answer: string; model: string }>('/api/chat', {
        ...this.context(position),
        game_id: this.value.gameId,
        pgn: pgnHistory(visibleRecords(this.value)),
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
      if (generation === this.generation) {
        this.update({ chatBusy: false });
        this.scheduleSave();
      }
    }
  }
}
