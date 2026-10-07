import { useEffect, useRef } from 'react';
import type { Color, ComputerEngine, Difficulty, MaiaProfile } from '../../shared/types';
import { hintsHidden, pathRecords, type GameController, type GameState } from '../controller';
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
  const records = game.exercise
    ? game.moves.slice(0, game.exercise.exercise.ply)
    : pathRecords(game);
  const ply = game.historyPly ?? records.length;
  const hidden = hintsHidden(game);
  const clockStarted = game.moves.some((move) => !move.computer) || game.moves.length > 1;
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
                  disabled={!!game.busy || !!game.gameResult}
                  onChange={(event) => controller.setEngine(event.target.value as ComputerEngine)}
                >
                  <option value="maia">Maia-3 · gioco umano</option>
                  <option value="stockfish">Stockfish</option>
                </select>
                <small>Giochi con il {game.playerColor === 'white' ? 'Bianco' : 'Nero'}</small>
              </label>
            )}
            {game.mode === 'computer' && (
              <label className="field">
                Colore giocato
                <select
                  aria-label="Colore giocato"
                  value={game.playerColor}
                  disabled={!!game.busy || !!game.exercise}
                  onChange={(event) =>
                    void controller.newGame('computer', event.target.value as Color | 'random')
                  }
                >
                  <option value="white">Bianco</option>
                  <option value="black">Nero</option>
                  <option value="random">Casuale</option>
                </select>
              </label>
            )}
            <label className="field">
              Tempo
              <select
                aria-label="Controllo del tempo"
                value={game.clock?.base_ms ?? 0}
                disabled={!!game.busy || clockStarted || !!game.gameResult}
                onChange={(event) =>
                  controller.setTimeControl(
                    Number(event.target.value),
                    game.clock?.increment_ms ?? 0,
                  )
                }
              >
                <option value="0">Senza orologio</option>
                <option value="60000">1 minuto</option>
                <option value="180000">3 minuti</option>
                <option value="300000">5 minuti</option>
                <option value="600000">10 minuti</option>
                <option value="900000">15 minuti</option>
              </select>
            </label>
            {game.clock && (
              <label className="field">
                Incremento
                <select
                  aria-label="Incremento orologio"
                  value={game.clock.increment_ms}
                  disabled={clockStarted || !!game.busy || !!game.gameResult}
                  onChange={(event) =>
                    controller.setTimeControl(game.clock!.base_ms, Number(event.target.value))
                  }
                >
                  <option value="0">Nessuno</option>
                  <option value="2000">2 secondi</option>
                  <option value="5000">5 secondi</option>
                </select>
              </label>
            )}
            <label className="training-setting">
              <input
                type="checkbox"
                aria-label="Allenamento senza aiuti"
                checked={game.training}
                onChange={(event) => controller.setTraining(event.target.checked)}
              />{' '}
              Allenamento senza aiuti
            </label>
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
              {game.mode === 'computer'
                ? game.playerColor === 'white'
                  ? 'Il tuo rating · Bianco'
                  : 'Avversario · Bianco'
                : 'Rating Bianco'}
              <select
                aria-label="Rating Bianco"
                value={game.maiaProfile.white_elo}
                disabled={!!game.busy || !!game.gameResult}
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
              {game.mode === 'computer'
                ? game.playerColor === 'black'
                  ? 'Il tuo rating · Nero'
                  : 'Avversario · Nero'
                : 'Rating Nero'}
              <select
                aria-label="Rating Nero"
                value={game.maiaProfile.black_elo}
                disabled={!!game.busy || !!game.gameResult}
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
                disabled={!!game.busy || !!game.gameResult}
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
            {!hidden && game.moves.at(-1)?.classification && (
              <div
                className={`last-judgement judgement-text-${game.moves.at(-1)!.classification!.code}`}
              >
                {game.moves.at(-1)!.classification!.label}
              </div>
            )}
            {game.mode === 'computer' &&
              game.position?.turn !== game.playerColor &&
              game.historyPly === null &&
              !game.position?.is_game_over &&
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
        Registro mosse <span>{records.length}</span>
      </div>
      <div className="move-list" ref={list} aria-label="Registro mosse" aria-live="polite">
        {!records.length && (
          <div className="empty-state">
            <Icon name="history" size={24} />
            <span>Nessuna mossa</span>
            <small>Seleziona un pezzo per iniziare.</small>
          </div>
        )}
        {records.map((move, index) => (
          <button
            type="button"
            onClick={() => controller.navigate(index + 1)}
            disabled={!!game.busy || !!game.exercise}
            aria-label={`Esplora mossa ${move.san}`}
            aria-current={index + 1 === ply ? 'step' : undefined}
            className={`move-row ${index + 1 === ply ? 'current' : ''}`}
            key={move.id}
            data-testid="move-row"
          >
            <span className="move-number">
              {move.before.fen.split(' ')[5]}
              {move.color === 'white' ? '.' : '…'}
            </span>
            <span className={`move-side ${move.color}`}>{move.color === 'white' ? '♙' : '♟'}</span>
            <strong>{move.san}</strong>
            {!hidden && move.classification ? (
              <span
                className={`move-label judgement-text-${move.classification.code}`}
                title={
                  !hidden && move.classification.best_move_san
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
            {!hidden && move.computer && move.classification && (
              <small className="move-engine">
                {move.engine === 'maia' ? 'Maia-3' : 'Stockfish'}
              </small>
            )}
          </button>
        ))}
      </div>
      {game.historyPly !== null && (
        <div className="history-footer">
          <span>
            Posizione {ply}/{records.length}
          </span>
          <button
            disabled={!!game.busy || !!game.exercise}
            onClick={() => controller.navigate(0, null)}
          >
            Inizio
          </button>
          {!game.gameResult && (
            <button disabled={!!game.busy} onClick={() => void controller.resumeGame()}>
              Riprendi partita
            </button>
          )}
        </div>
      )}
    </div>
  );
}
