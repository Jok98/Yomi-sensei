import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { canPlay, capturesBy, parseFen, pieceColor, squares } from '../../shared/game';
import { formatClock } from '../../shared/library';
import {
  arrowGeometry,
  squareAtPoint,
  squareCenter,
  type BoardMark,
} from '../../shared/board-geometry';
import type { Color, Promotion } from '../../shared/types';
import {
  hintsHidden,
  pathRecords,
  studyKey,
  visibleRecords,
  type GameController,
  type GameState,
} from '../controller';
import { Icon } from '../Icon';
import { Piece } from './Piece';
import { EvaluationBar } from './EvaluationBar';

const names: Record<string, string> = {
  k: 're',
  q: 'donna',
  r: 'torre',
  b: 'alfiere',
  n: 'cavallo',
  p: 'pedone',
};

function PlayerLine({
  color,
  game,
  records,
  bottom = false,
}: {
  color: Color;
  game: GameState;
  records: ReturnType<typeof visibleRecords>;
  bottom?: boolean;
}) {
  const captured = capturesBy(records, color);
  const groups = [...new Set(captured)].map((piece) => ({
    piece,
    count: captured.filter((item) => item === piece).length,
  }));
  const label = color === 'white' ? 'Bianco' : 'Nero';
  const clock = game.clock;
  return (
    <div className="board-player" data-player-color={color}>
      <span className="side-piece">
        <Piece piece={color === 'white' ? 'K' : 'k'} />
      </span>
      <span>{label}</span>
      <small>
        {game.mode === 'computer'
          ? color === game.playerColor
            ? 'Tu'
            : game.engine === 'maia'
              ? 'Maia-3'
              : 'Stockfish'
          : 'Libera'}
      </small>
      <span
        className="captured-pieces"
        data-testid={`captures-${color}`}
        data-count={captured.length}
        role="img"
        aria-label={`Pezzi presi dal ${label}: ${groups.map(({ piece, count }) => `${count} ${names[piece.toLowerCase()]}`).join(', ') || 'nessuno'}`}
      >
        {groups.map(({ piece, count }) => (
          <span
            className="captured-group"
            key={piece}
            title={`${count} ${names[piece.toLowerCase()]}`}
          >
            <Piece piece={piece} />
            {count > 1 && <small>{count}</small>}
          </span>
        ))}
      </span>
      {clock && (
        <span
          className={`player-clock ${game.livePosition?.turn === color && !clock.paused && !game.gameResult ? 'ticking' : ''}`}
          aria-label={`Tempo ${label}`}
          title={clock.paused ? 'Orologio in pausa' : 'Tempo rimanente'}
        >
          {formatClock(clock[`${color}_ms`])}
        </span>
      )}
      {bottom && !clock && !captured.length && (
        <span className="board-state">{game.busy || game.position?.status || 'Caricamento'}</span>
      )}
    </div>
  );
}

function Mark({
  mark,
  orientation,
  kind,
  active,
  rank,
}: {
  mark: BoardMark;
  orientation: Color;
  kind: 'manual' | 'suggested' | 'draft';
  active?: boolean;
  rank?: number;
}) {
  const geometry = arrowGeometry(mark, orientation);
  const center = squareCenter(mark.from, orientation);
  return (
    <g
      className={`${kind}-mark ${geometry ? `${kind}-arrow` : `${kind}-circle`}${active ? ' active' : ''}`}
      data-from={mark.from}
      data-to={mark.to}
      data-rank={rank}
    >
      {geometry ? (
        <>
          <path
            d={geometry.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon points={geometry.head} fill="currentColor" />
          {rank && (
            <g className="arrow-rank" transform={`translate(${center.x + 28} ${center.y - 28})`}>
              <circle r="16" fill="currentColor" />
              <text textAnchor="middle" dominantBaseline="central" fill="#fff">
                {rank}
              </text>
            </g>
          )}
        </>
      ) : (
        <circle
          cx={center.x}
          cy={center.y}
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
        />
      )}
    </g>
  );
}

export function Board({
  game,
  controller,
  orientation,
  suggestedArrows,
  onFlip,
  onFinish,
}: {
  game: GameState;
  controller: GameController;
  orientation: Color;
  suggestedArrows: boolean;
  onFlip: () => void;
  onFinish: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
    options: Promotion[];
  } | null>(null);
  const position = game.position;
  const boardRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ from: string; pointerId: number; position: typeof position } | null>(
    null,
  );
  const [annotations, setAnnotations] = useState<{ position: typeof position; marks: BoardMark[] }>(
    { position, marks: [] },
  );
  const [draft, setDraft] = useState<BoardMark | null>(null);
  const cancelDrawing = () => {
    const pointerId = gesture.current?.pointerId;
    gesture.current = null;
    setDraft(null);
    if (pointerId !== undefined && boardRef.current?.hasPointerCapture(pointerId))
      boardRef.current.releasePointerCapture(pointerId);
  };
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
    setAnnotations({ position, marks: game.marks[studyKey(game)] ?? [] });
    cancelDrawing();
  }, [position]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPromotion(null);
        setSelected(null);
        setAnnotations({ position: null, marks: [] });
        controller.setMarks([]);
        cancelDrawing();
      }
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);
  const pieces = parseFen(position?.fen ?? '8/8/8/8/8/8/8/8');
  const playable =
    !!game.gameId &&
    (game.exercise
      ? !game.exercise.solved && !game.busy
      : game.variationId
        ? !game.busy && !position?.is_game_over
        : game.historyPly === null && canPlay(position, game.mode, !!game.busy, game.playerColor));
  const legalFrom = (square: string) =>
    playable ? position!.legal_moves.filter((move) => move.from_square === square) : [];
  const destinations = new Set(selected ? legalFrom(selected).map((move) => move.to_square) : []);
  const records = visibleRecords(game);
  const last = records.at(-1);
  const lastJudged = hintsHidden(game)
    ? undefined
    : records.findLast((move) => move.classification);
  const candidates =
    !hintsHidden(game) &&
    game.analysis?.fen === position?.fen &&
    !game.busy &&
    !position?.is_game_over
      ? game.analysisSource === 'human'
        ? game.analysis?.human?.candidates
        : game.analysis?.candidates
      : undefined;
  const preview = candidates?.find((move) => move.uci === game.activeCandidate)?.uci;
  const atPointer = (event: PointerEvent<HTMLDivElement>) =>
    squareAtPoint(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      orientation,
    );
  const tryMove = (from: string, to: string) => {
    const moves = legalFrom(from).filter((move) => move.to_square === to);
    if (!moves.length) return;
    if (moves.some((move) => move.promotion))
      setPromotion({ from, to, options: moves.map((move) => move.promotion!).filter(Boolean) });
    else {
      setSelected(null);
      void controller.move(from, to);
    }
  };

  return (
    <>
      <div className="board-stage">
        <div className="board-frame">
          <PlayerLine
            color={orientation === 'white' ? 'black' : 'white'}
            game={game}
            records={records}
          />
          <div className="board-surface">
            <EvaluationBar game={game} orientation={orientation} />
            <nav className="board-controls" aria-label="Controlli accanto alla scacchiera">
              <button
                className="icon-button"
                aria-label="Mossa precedente"
                title="Mossa precedente · esplora lo storico"
                disabled={
                  !!game.busy || !(game.historyPly ?? pathRecords(game).length) || !!game.exercise
                }
                onClick={controller.previous}
              >
                <Icon name="chevron-left" />
              </button>
              <button
                className="icon-button"
                aria-label="Mossa successiva"
                title="Mossa successiva"
                disabled={
                  !!game.busy ||
                  game.historyPly === null ||
                  game.historyPly >= pathRecords(game).length ||
                  !!game.exercise
                }
                onClick={controller.next}
              >
                <Icon name="chevron-right" />
              </button>
              {!game.gameResult && (game.historyPly !== null || game.clock?.paused) && (
                <button
                  className="icon-button"
                  aria-label="Torna alla partita"
                  title="Riprendi la partita"
                  disabled={!!game.busy || !!game.exercise}
                  onClick={() => void controller.resumeGame()}
                >
                  <Icon name="play" />
                </button>
              )}
              <button
                className="icon-button"
                aria-label="Annulla mossa"
                title="Annulla ultima mossa · Ctrl+Z"
                disabled={
                  !!game.busy ||
                  !game.moves.length ||
                  !!game.gameResult ||
                  game.historyPly !== null ||
                  !!game.exercise
                }
                onClick={() => controller.undo()}
              >
                <Icon name="undo" />
              </button>
              <button
                className="icon-button"
                aria-label="Ruota scacchiera"
                title="Ruota scacchiera · Ctrl+F"
                disabled={!!game.busy}
                onClick={onFlip}
              >
                <Icon name="flip" />
              </button>
              {game.mode === 'computer' && (
                <button
                  className="icon-button"
                  aria-label="Cambia colore giocato"
                  title={`Nuova partita con il ${game.playerColor === 'white' ? 'Nero' : 'Bianco'}`}
                  disabled={!!game.busy || !!game.exercise}
                  onClick={() =>
                    void controller.newGame(
                      game.mode,
                      game.playerColor === 'white' ? 'black' : 'white',
                    )
                  }
                >
                  <Icon name="color" />
                </button>
              )}
              {!game.gameResult && !game.exercise && (
                <button
                  className="icon-button"
                  aria-label="Concludi partita"
                  title="Abbandona o concorda una patta"
                  disabled={!!game.busy}
                  onClick={onFinish}
                >
                  <Icon name="flag" />
                </button>
              )}
            </nav>
            <div
              ref={boardRef}
              className="chessboard"
              role="grid"
              data-fen={game.position?.fen}
              data-game-id={game.gameId ?? undefined}
              aria-label="Scacchiera"
              aria-describedby="board-annotation-help"
              aria-busy={!!game.busy}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDownCapture={(event) => {
                if (event.button === 0) {
                  setAnnotations({ position, marks: [] });
                  controller.setMarks([]);
                  cancelDrawing();
                  return;
                }
                if (event.button !== 2) return;
                event.preventDefault();
                event.stopPropagation();
                const from = atPointer(event);
                if (!from) return;
                setSelected(null);
                gesture.current = { from, pointerId: event.pointerId, position };
                event.currentTarget.setPointerCapture(event.pointerId);
                setDraft({ from, to: from });
              }}
              onPointerMove={(event) => {
                const current = gesture.current;
                if (!current || current.pointerId !== event.pointerId) return;
                if (current.position !== position || !(event.buttons & 2)) return cancelDrawing();
                const to = atPointer(event);
                setDraft(to ? { from: current.from, to } : null);
              }}
              onPointerUp={(event) => {
                const current = gesture.current;
                if (!current || current.pointerId !== event.pointerId) return;
                event.preventDefault();
                const to = atPointer(event);
                if (to && current.position === position) {
                  const mark = { from: current.from, to };
                  const marks = annotations.position === position ? annotations.marks : [];
                  const exists = marks.some(
                    (item) => item.from === mark.from && item.to === mark.to,
                  );
                  const nextMarks = exists
                    ? marks.filter((item) => item.from !== mark.from || item.to !== mark.to)
                    : [...marks, mark];
                  setAnnotations({ position, marks: nextMarks });
                  controller.setMarks(nextMarks);
                }
                cancelDrawing();
              }}
              onPointerCancel={cancelDrawing}
              onLostPointerCapture={cancelDrawing}
            >
              {squares(orientation).map((square, index) => {
                const piece = pieces[square];
                const isLast = last?.uci.slice(0, 2) === square || last?.uci.slice(2, 4) === square;
                const isPreview =
                  preview?.slice(0, 2) === square || preview?.slice(2, 4) === square;
                const badge =
                  lastJudged?.uci.slice(2, 4) === square ? lastJudged.classification : null;
                const label = `${square}${piece ? ` · ${names[piece.toLowerCase()]} ${pieceColor(piece) === 'white' ? 'bianco' : 'nero'}` : ''}`;
                return (
                  <button
                    key={square}
                    type="button"
                    role="gridcell"
                    data-square={square}
                    aria-label={label}
                    aria-selected={selected === square}
                    disabled={!playable}
                    className={`square ${(square.charCodeAt(0) - 97 + Number(square[1])) % 2 ? 'light' : 'dark'}${isLast ? ' last-move' : ''}${selected === square ? ' selected' : ''}${destinations.has(square) ? ' legal' : ''}${isPreview && !selected ? ' preview' : ''}`}
                    onClick={() => {
                      if (selected && destinations.has(square)) tryMove(selected, square);
                      else
                        setSelected(
                          selected === square ? null : legalFrom(square).length ? square : null,
                        );
                    }}
                    onDragOver={(event) => {
                      if (playable) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      tryMove(event.dataTransfer.getData('text/plain'), square);
                    }}
                  >
                    {index % 8 === 0 && <span className="coordinate rank">{square[1]}</span>}
                    {index >= 56 && <span className="coordinate file">{square[0]}</span>}
                    {piece && (
                      <span
                        className={`piece ${pieceColor(piece)}`}
                        draggable={legalFrom(square).length > 0}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', square);
                          event.dataTransfer.effectAllowed = 'move';
                          setSelected(square);
                        }}
                        onDragEnd={() => setSelected(null)}
                      >
                        <Piece piece={piece} />
                      </span>
                    )}
                    {badge && (
                      <span className={`move-badge judgement-${badge.code}`} title={badge.label}>
                        {badge.code === 'book' ? <Icon name="book" size={14} /> : badge.marker}
                      </span>
                    )}
                  </button>
                );
              })}
              <svg className="board-overlay" viewBox="0 0 800 800" aria-hidden="true">
                {game.exercise && game.exercise.hint >= 2 && (
                  <Mark
                    kind="suggested"
                    active
                    orientation={orientation}
                    mark={{
                      from: game.exercise.exercise.best_move.slice(0, 2),
                      to:
                        game.exercise.hint >= 3
                          ? game.exercise.exercise.best_move.slice(2, 4)
                          : game.exercise.exercise.best_move.slice(0, 2),
                    }}
                  />
                )}
                {suggestedArrows &&
                  candidates?.map((candidate) => (
                    <Mark
                      key={candidate.uci}
                      kind="suggested"
                      orientation={orientation}
                      rank={candidate.rank}
                      active={candidate.uci === game.activeCandidate}
                      mark={{ from: candidate.uci.slice(0, 2), to: candidate.uci.slice(2, 4) }}
                    />
                  ))}
                {annotations.position === position &&
                  annotations.marks.map((mark) => (
                    <Mark
                      key={mark.from + mark.to}
                      kind="manual"
                      orientation={orientation}
                      mark={mark}
                    />
                  ))}
                {draft && gesture.current?.position === position && (
                  <Mark kind="draft" orientation={orientation} mark={draft} />
                )}
              </svg>
            </div>
          </div>
          <PlayerLine color={orientation} game={game} records={records} bottom />
        </div>
      </div>
      <span id="board-annotation-help" className="visually-hidden">
        Trascina con il tasto destro per disegnare una freccia. Click destro per un cerchio. Ripeti
        per rimuovere; click sinistro o Escape per cancellare le annotazioni.
      </span>
      {promotion && (
        <div className="modal-backdrop" onClick={() => setPromotion(null)}>
          <section
            className="promotion-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pane-title">
              <h2 id="promotion-title">Promozione</h2>
              <button
                className="icon-button"
                aria-label="Annulla promozione"
                onClick={() => setPromotion(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="promotion-options">
              {promotion.options.map((piece, index) => (
                <button
                  autoFocus={index === 0}
                  key={piece}
                  aria-label={`Promuovi a ${names[piece]}`}
                  onClick={() => {
                    void controller.move(promotion.from, promotion.to, piece);
                    setPromotion(null);
                  }}
                >
                  <span className={`piece ${position?.turn}`}>
                    <Piece piece={position?.turn === 'black' ? piece : piece.toUpperCase()} />
                  </span>
                  <small>{names[piece]}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
