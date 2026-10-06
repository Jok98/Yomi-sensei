import { useEffect, useMemo, useState } from 'react';
import { boardEvaluation, type BoardEvaluation } from '../../shared/evaluation';
import type { Color } from '../../shared/types';
import type { GameState } from '../controller';

export function EvaluationBar({ game, orientation }: { game: GameState; orientation: Color }) {
  const current = useMemo(
    () => boardEvaluation(game.position, game.analysis),
    [game.position, game.analysis],
  );
  const [previous, setPrevious] = useState<{ fen: string; value: BoardEvaluation } | null>(null);
  const updating = !game.position?.is_game_over && !!(game.busy || game.analysisPending);
  useEffect(() => {
    if (current && game.position) setPrevious({ fen: game.position.fen, value: current });
    else if (!game.moves.length && !game.busy && !game.analysisPending) setPrevious(null);
  }, [current, game.position, game.moves.length, game.busy, game.analysisPending]);
  const retained =
    updating && previous && (game.moves.length > 0 || previous.fen === game.position?.fen)
      ? previous.value
      : null;
  const value = current ?? retained;
  const state = updating ? 'updating' : current ? 'ready' : 'unavailable';
  const description = updating
    ? `${value ? `Ultima valutazione: ${value.description}. ` : ''}Stockfish sta aggiornando la posizione.`
    : (current?.description ?? 'Valutazione Stockfish non disponibile');
  return (
    <div
      className={`evaluation-bar ${state}`}
      data-testid="evaluation-bar"
      data-state={state}
      data-orientation={orientation}
      data-white-share={value?.whiteShare ?? 50}
      data-white-score={value?.whiteScore ?? ''}
      role={value ? 'meter' : 'img'}
      aria-label={value ? 'Barra del vantaggio Stockfish' : description}
      aria-valuemin={value ? -10 : undefined}
      aria-valuemax={value ? 10 : undefined}
      aria-valuenow={value ? Math.max(-10, Math.min(10, value.whiteScore)) : undefined}
      aria-valuetext={value ? description : undefined}
      aria-busy={updating}
      title={`${description}\nPositivo: Bianco; negativo: Nero. La barra non indica una probabilità di vittoria.`}
      tabIndex={0}
    >
      <span className="evaluation-white" style={{ height: `${value?.whiteShare ?? 50}%` }} />
      <span className="evaluation-midpoint" />
      <span className={`evaluation-value favors-${value?.favored ?? 'white'}`}>
        {value?.label ?? '—'}
      </span>
      {updating && (
        <span className="evaluation-loading" aria-hidden="true">
          ···
        </span>
      )}
    </div>
  );
}
