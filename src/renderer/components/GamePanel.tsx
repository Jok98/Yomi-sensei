import { useEffect, useRef } from 'react';
import type { ComputerEngine, Difficulty, MaiaProfile } from '../../shared/types';
import type { GameController, GameState } from '../controller';
import { Icon } from '../Icon';

export const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Facile',
  medium: 'Medio',
  hard: 'Difficile',
  expert: 'Esperto',
};
export function GamePanel({
  game,
  controller,
  tab,
}: {
  game: GameState;
  controller: GameController;
  tab: 'game' | 'history';
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [game.moves.length]);
  return (
    <div className="navigator-content">
      {tab === 'game' && (
        <>
          <section className="panel-section">
            <div className="section-label">Modalità</div>
            <div className="segmented" role="group" aria-label="Modalità partita">
              <button
                className={game.mode === 'free' ? 'active' : ''}
                aria-pressed={game.mode === 'free'}
                disabled={!!game.busy}
                onClick={() => {
                  if (game.mode !== 'free') void controller.newGame('free');
                }}
              >
                Libera
              </button>
              <button
                className={game.mode === 'computer' ? 'active' : ''}
                aria-pressed={game.mode === 'computer'}
                disabled={!!game.busy}
                onClick={() => {
                  if (game.mode !== 'computer') void controller.newGame('computer');
                }}
              >
                Computer
              </button>
            </div>
            {game.mode === 'computer' && (
              <label className="field">
                Avversario
                <select
                  aria-label="Avversario"
                  value={game.engine}
                  disabled={!!game.busy}
                  onChange={(event) => controller.setEngine(event.target.value as ComputerEngine)}
                >
                  <option value="maia">Maia-3 · gioco umano</option>
                  <option value="stockfish">Stockfish</option>
                </select>
                <small>Giochi con il Bianco</small>
              </label>
            )}
            {game.mode === 'computer' && game.engine === 'stockfish' && (
              <label className="field">
                Livello Stockfish
                <select
                  aria-label="Livello Stockfish"
                  value={game.difficulty}
                  disabled={!!game.busy}
                  onChange={(event) => controller.setDifficulty(event.target.value as Difficulty)}
                >
                  {Object.entries(difficultyLabels).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>
          <section className="panel-section human-profile">
            <div className="section-label">Profilo umano · Maia-3</div>
            <label className="field">
              {game.mode === 'computer' ? 'Il tuo rating' : 'Rating Bianco'}
              <select
                aria-label="Rating Bianco"
                value={game.maiaProfile.white_elo}
                disabled={!!game.busy}
                onChange={(event) =>
                  controller.setMaiaProfile({ white_elo: Number(event.target.value) })
                }
              >
                {Array.from({ length: 24 }, (_, index) => 600 + index * 100).map((elo) => (
                  <option value={elo} key={elo}>
                    {elo}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {game.mode === 'computer' ? 'Rating avversario Maia' : 'Rating Nero'}
              <select
                aria-label="Rating Nero"
                value={game.maiaProfile.black_elo}
                disabled={!!game.busy}
                onChange={(event) =>
                  controller.setMaiaProfile({ black_elo: Number(event.target.value) })
                }
              >
                {Array.from({ length: 24 }, (_, index) => 600 + index * 100).map((elo) => (
                  <option value={elo} key={elo}>
                    {elo}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Modello Maia
              <select
                aria-label="Modello Maia"
                value={game.maiaProfile.maia_model}
                disabled={!!game.busy}
                onChange={(event) =>
                  controller.setMaiaProfile({
                    maia_model: event.target.value as MaiaProfile['maia_model'],
                  })
                }
              >
                <option value="79m">Accurato · 79M</option>
                <option value="5m">Rapido · 5M</option>
              </select>
              <small>Rating di riferimento: Lichess blitz.</small>
            </label>
          </section>
          <section className="panel-section">
            <div className="section-label">Posizione</div>
            <div className="position-status">
              <span className={`turn-dot ${game.position?.turn}`} />
              <span>{game.position?.status ?? 'Caricamento…'}</span>
            </div>
            {game.moves.at(-1)?.classification && (
              <div
                className={`last-judgement judgement-text-${game.moves.at(-1)!.classification!.code}`}
              >
                {game.moves.at(-1)!.classification!.label}
              </div>
            )}
            {game.mode === 'computer' &&
              game.position?.turn === 'black' &&
              !game.position.is_game_over &&
              !game.busy && (
                <button className="retry-computer" onClick={() => void controller.retryComputer()}>
                  <Icon name="refresh" size={14} />
                  Riprova risposta computer
                </button>
              )}
          </section>
        </>
      )}
      <div className="section-label history-heading">
        Registro mosse <span>{game.moves.length}</span>
      </div>
      <div className="move-list" ref={list} aria-label="Registro mosse" aria-live="polite">
        {!game.moves.length && (
          <div className="empty-state">
            <Icon name="history" size={24} />
            <span>Nessuna mossa</span>
            <small>Seleziona un pezzo per iniziare.</small>
          </div>
        )}
        {game.moves.map((move, index) => (
          <div
            className={`move-row ${index === game.moves.length - 1 ? 'current' : ''}`}
            key={move.id}
            data-testid="move-row"
          >
            <span className="move-number">
              {Math.floor(index / 2) + 1}
              {move.color === 'white' ? '.' : '…'}
            </span>
            <span className={`move-side ${move.color}`}>{move.color === 'white' ? '♙' : '♟'}</span>
            <strong>{move.san}</strong>
            {move.classification ? (
              <span
                className={`move-label judgement-text-${move.classification.code}`}
                title={
                  move.classification.best_move_san
                    ? `Migliore: ${move.classification.best_move_san}`
                    : move.classification.label
                }
              >
                {move.classification.label}
              </span>
            ) : move.computer ? (
              <small className="move-label">
                {move.engine === 'maia' ? 'Maia-3' : 'Stockfish'}
              </small>
            ) : (
              <small className="move-label">—</small>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
