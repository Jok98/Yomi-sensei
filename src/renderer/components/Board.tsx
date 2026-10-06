import { useEffect, useState } from 'react';
import { canPlay, parseFen, pieceColor, squares } from '../../shared/game';
import type { Color, Promotion } from '../../shared/types';
import type { GameController, GameState } from '../controller';
import { Icon } from '../Icon';

const glyphs: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const names: Record<string, string> = {
  k: 're',
  q: 'donna',
  r: 'torre',
  b: 'alfiere',
  n: 'cavallo',
  p: 'pedone',
};

export function Board({
  game,
  controller,
  orientation,
}: {
  game: GameState;
  controller: GameController;
  orientation: Color;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
    options: Promotion[];
  } | null>(null);
  const position = game.position;
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [position?.fen]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPromotion(null);
        setSelected(null);
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
  const preview = (
    game.analysisSource === 'human' ? game.analysis?.human?.candidates : game.analysis?.candidates
  )?.find((move) => move.uci === game.activeCandidate)?.uci;
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
            <span className="side-piece">{orientation === 'white' ? '♚' : '♔'}</span>
            <span>{orientation === 'white' ? 'Nero' : 'Bianco'}</span>
            <small>
              {game.mode === 'computer'
                ? game.engine === 'maia'
                  ? 'Maia-3'
                  : 'Stockfish'
                : 'Partita libera'}
            </small>
          </div>
          <div className="chessboard" role="grid" aria-label="Scacchiera" aria-busy={!!game.busy}>
            {squares(orientation).map((square, index) => {
              const piece = pieces[square];
              const isLast = last?.uci.slice(0, 2) === square || last?.uci.slice(2, 4) === square;
              const isPreview = preview?.slice(0, 2) === square || preview?.slice(2, 4) === square;
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
                      {glyphs[piece.toLowerCase()]}
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
          </div>
          <div className="board-player">
            <span className="side-piece">{orientation === 'white' ? '♔' : '♚'}</span>
            <span>{orientation === 'white' ? 'Bianco' : 'Nero'}</span>
            <small>{game.mode === 'computer' ? 'Tu' : 'Partita libera'}</small>
            <span className="board-state">{game.busy || position?.status || 'Caricamento'}</span>
          </div>
        </div>
      </div>
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
                  <span className={`piece ${position?.turn}`}>{glyphs[piece]}</span>
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
