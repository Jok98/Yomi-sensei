import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { canPlay, parseFen, pieceColor, squares } from '../../shared/game';
import {
  arrowGeometry,
  squareAtPoint,
  squareCenter,
  type BoardMark,
} from '../../shared/board-geometry';
import type { Color, Promotion } from '../../shared/types';
import type { GameController, GameState } from '../controller';
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
}: {
  game: GameState;
  controller: GameController;
  orientation: Color;
  suggestedArrows: boolean;
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
    setAnnotations({ position, marks: [] });
    cancelDrawing();
  }, [position]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPromotion(null);
        setSelected(null);
        setAnnotations({ position: null, marks: [] });
        cancelDrawing();
      }
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);
  const pieces = parseFen(position?.fen ?? '8/8/8/8/8/8/8/8');
  const playable = canPlay(position, game.mode, !!game.busy);
  const legalFrom = (square: string) =>
    playable ? position!.legal_moves.filter((move) => move.from_square === square) : [];
  const destinations = new Set(selected ? legalFrom(selected).map((move) => move.to_square) : []);
  const last = game.moves.at(-1);
  const lastJudged = game.moves.findLast((move) => move.classification);
  const candidates =
    game.analysis?.fen === position?.fen && !game.busy && !position?.is_game_over
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
          <div className="board-player">
            <span className="side-piece">
              <Piece piece={orientation === 'white' ? 'k' : 'K'} />
            </span>
            <span>{orientation === 'white' ? 'Nero' : 'Bianco'}</span>
            <small>
              {game.mode === 'computer'
                ? game.engine === 'maia'
                  ? 'Maia-3'
                  : 'Stockfish'
                : 'Partita libera'}
            </small>
          </div>
          <div className="board-surface">
            <EvaluationBar game={game} orientation={orientation} />
            <div
              ref={boardRef}
              className="chessboard"
              role="grid"
              aria-label="Scacchiera"
              aria-describedby="board-annotation-help"
              aria-busy={!!game.busy}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDownCapture={(event) => {
                if (event.button === 0) {
                  setAnnotations({ position, marks: [] });
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
                  setAnnotations((previous) => {
                    const marks = previous.position === position ? previous.marks : [];
                    const exists = marks.some(
                      (item) => item.from === mark.from && item.to === mark.to,
                    );
                    return {
                      position,
                      marks: exists
                        ? marks.filter((item) => item.from !== mark.from || item.to !== mark.to)
                        : [...marks, mark],
                    };
                  });
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
          <div className="board-player">
            <span className="side-piece">
              <Piece piece={orientation === 'white' ? 'K' : 'k'} />
            </span>
            <span>{orientation === 'white' ? 'Bianco' : 'Nero'}</span>
            <small>{game.mode === 'computer' ? 'Tu' : 'Partita libera'}</small>
            <span className="board-state">{game.busy || position?.status || 'Caricamento'}</span>
          </div>
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
