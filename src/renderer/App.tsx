import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Color, DesktopCommand } from '../shared/types';
import { GameController } from './controller';
import { Icon, type IconName } from './Icon';
import { Board } from './components/Board';
import { GamePanel } from './components/GamePanel';
import { AnalysisPanel, AnalysisSourceSwitcher } from './components/AnalysisPanel';
import { CoachPanel } from './components/CoachPanel';

function ToolButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: IconName;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`tool-button ${active ? 'active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={!!active}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
export function App({ controller }: { controller: GameController }) {
  const game = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [left, setLeft] = useState<'game' | 'history' | null>('game');
  const [right, setRight] = useState<'coach' | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [suggestedArrows, setSuggestedArrows] = useState(() => {
    try {
      return localStorage.getItem('yomi.suggestedArrows') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('yomi.suggestedArrows', String(suggestedArrows));
    } catch {
      /* Keep the current preference when profile storage is unavailable. */
    }
  }, [suggestedArrows]);
  const [orientation, setOrientation] = useState<Color>('white');
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettings(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const flip = () => {
    if (!game.busy && game.mode === 'free')
      setOrientation((value) => (value === 'white' ? 'black' : 'white'));
  };
  useEffect(() => {
    if (game.mode === 'computer') setOrientation('white');
  }, [game.mode]);
  useEffect(
    () =>
      window.yomi.onCommand((command: DesktopCommand) => {
        switch (command) {
          case 'new-game':
            void controller.newGame();
            break;
          case 'undo':
            controller.undo();
            break;
          case 'flip':
            flip();
            break;
          case 'analysis':
            void controller.analyze();
            break;
          case 'toggle-left':
            setLeft((value) => (value ? null : 'game'));
            break;
          case 'toggle-right':
            setRight((value) => (value ? null : 'coach'));
            break;
          case 'settings':
            setSettings(true);
            break;
        }
      }),
    [game.busy, game.mode],
  );
  const serviceLabel = game.health?.codex_authenticated
    ? 'Codex connesso'
    : 'Codex non autenticato';
  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">
          <span aria-hidden="true">♞</span>
          <strong>Yomi Sensei</strong>
        </span>
        <span className="workspace-name">Workspace scacchi</span>
        <div className="top-actions">
          <span className="local-indicator">
            <span className="status-dot" />
            Locale
          </span>
          <button
            className="icon-button"
            title="Impostazioni"
            aria-label="Impostazioni"
            onClick={() => setSettings(true)}
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>
      {game.error && (
        <div className="error-banner" role="alert">
          <span>{game.error.replace(/^Error invoking remote method '[^']+': Error: /, '')}</span>
          <button
            className="icon-button"
            aria-label="Chiudi avviso"
            onClick={controller.dismissError}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      <main className={`workbench ${left ? '' : 'hide-left'} ${right ? '' : 'hide-right'}`}>
        <nav className="tool-rail left-rail" aria-label="Strumenti partita">
          <ToolButton
            label="Partita"
            icon="board"
            active={left === 'game'}
            onClick={() => setLeft(left === 'game' ? null : 'game')}
          />
          <ToolButton
            label="Registro"
            icon="history"
            active={left === 'history'}
            onClick={() => setLeft(left === 'history' ? null : 'history')}
          />
          <div className="rail-spacer" />
          <ToolButton
            label="Impostazioni servizi"
            icon="settings"
            onClick={() => setSettings(true)}
          />
        </nav>
        {left && (
          <aside className="navigator">
            <div className="pane-title">
              <h2>{left === 'game' ? 'Partita' : 'Registro'}</h2>
              <button
                className="icon-button"
                aria-label="Nascondi pannello partita"
                onClick={() => setLeft(null)}
              >
                <Icon name="panel" size={15} />
              </button>
            </div>
            <GamePanel game={game} controller={controller} tab={left} />
          </aside>
        )}
        <section className="board-pane" aria-label="Area di gioco">
          <div className="board-toolbar">
            <div className="board-tab">
              <Icon name="board" size={14} />
              Scacchiera
              <span className="tab-dot" />
            </div>
            <div className="board-actions">
              <button
                className="icon-button"
                title="Nuova partita · Ctrl+N"
                aria-label="Nuova partita"
                disabled={!!game.busy}
                onClick={() => void controller.newGame()}
              >
                <Icon name="plus" />
              </button>
              <button
                className="icon-button"
                title="Annulla · Ctrl+Z"
                aria-label="Annulla mossa"
                disabled={!!game.busy || !game.moves.length}
                onClick={() => controller.undo()}
              >
                <Icon name="undo" />
              </button>
              <button
                className="icon-button"
                title="Ruota scacchiera"
                aria-label="Ruota scacchiera"
                disabled={!!game.busy || game.mode === 'computer'}
                onClick={flip}
              >
                <Icon name="flip" />
              </button>
            </div>
          </div>
          <div className="breadcrumbs">
            <span>{game.mode === 'computer' ? 'Contro computer' : 'Partita libera'}</span>
            <span>/</span>
            <span>
              {game.position?.is_game_over
                ? 'Conclusa'
                : `${Math.floor(game.moves.length / 2) + 1}. ${game.position?.turn === 'black' ? 'Nero' : 'Bianco'} al tratto`}
            </span>
          </div>
          <Board
            game={game}
            controller={controller}
            orientation={orientation}
            suggestedArrows={suggestedArrows}
          />
          <div className="board-footer">
            <span>
              {game.moves.at(-1)
                ? `Ultima mossa · ${game.moves.at(-1)!.san}`
                : 'Posizione iniziale'}
            </span>
            <span
              className="annotation-hint"
              title="Ripeti una freccia per toglierla; click sinistro o Escape per cancellare."
            >
              Tasto destro · disegna frecce
            </span>
          </div>
          <section
            className={`analysis-dock ${analysisOpen ? '' : 'collapsed'}`}
            aria-label="Analisi sotto la scacchiera"
          >
            <div className="analysis-toolbar">
              <div className="panel-tabs" role="tablist" aria-label="Studio della posizione">
                <button
                  id="analysis-tab"
                  role="tab"
                  aria-controls="analysis-page"
                  aria-selected={analysisOpen}
                  aria-expanded={analysisOpen}
                  className={analysisOpen ? 'active' : ''}
                  onClick={() => setAnalysisOpen((value) => !value)}
                >
                  <Icon name="chart" size={14} /> Analisi
                </button>
              </div>
              {analysisOpen && <AnalysisSourceSwitcher game={game} controller={controller} />}
              <div className="pane-actions">
                <label
                  className="arrow-setting"
                  title="Frecce suggerite: mostra le tre mosse della fonte selezionata. I numeri corrispondono alle candidate."
                >
                  <input
                    type="checkbox"
                    aria-label="Frecce suggerite"
                    checked={suggestedArrows}
                    onChange={(event) => setSuggestedArrows(event.target.checked)}
                  />
                  <Icon name="arrow" size={14} />
                  <span className="arrow-setting-label">Frecce suggerite</span>
                </label>
                <button
                  className="icon-button"
                  aria-label="Ricalcola analisi"
                  title="Ricalcola · Ctrl+Shift+R"
                  disabled={!!game.busy || game.analysisPending}
                  onClick={() => void controller.analyze()}
                >
                  <Icon name="refresh" size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={analysisOpen ? 'Riduci analisi' : 'Espandi analisi'}
                  title={analysisOpen ? 'Riduci analisi' : 'Espandi analisi'}
                  onClick={() => setAnalysisOpen((value) => !value)}
                >
                  <Icon name={analysisOpen ? 'chevron-down' : 'chevron-up'} size={15} />
                </button>
              </div>
            </div>
            <div
              id="analysis-page"
              className="analysis-body"
              role="tabpanel"
              aria-labelledby="analysis-tab"
              hidden={!analysisOpen}
            >
              <AnalysisPanel game={game} controller={controller} />
            </div>
          </section>
        </section>
        {right && (
          <aside className="inspector">
            <div className="pane-title">
              <h2>Coach</h2>
              <div className="pane-actions">
                <button
                  className="icon-button"
                  aria-label="Nascondi pannello destro"
                  onClick={() => setRight(null)}
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            </div>
            <div className="panel-page">
              <CoachPanel game={game} controller={controller} />
            </div>
          </aside>
        )}
        <nav className="tool-rail right-rail" aria-label="Strumenti studio">
          <ToolButton
            label="Mostra analisi"
            icon="chart"
            active={analysisOpen}
            onClick={() => setAnalysisOpen((value) => !value)}
          />
          <ToolButton
            label="Mostra coach"
            icon="chat"
            active={right === 'coach'}
            onClick={() => setRight(right === 'coach' ? null : 'coach')}
          />
        </nav>
      </main>
      <footer className="statusbar">
        <span className="status-message">
          {game.busy ||
            (game.analysisPending
              ? 'Analisi Maia e Stockfish in corso'
              : (game.position?.status ?? 'Avvio servizi locali'))}
        </span>
        <span
          title={game.health?.maia ? 'Modelli Maia-3 locali disponibili' : 'Maia-3 non disponibile'}
        >
          <span className={`status-dot ${game.health?.maia ? '' : 'offline'}`} />
          Maia-3
        </span>
        <span
          title={
            game.health?.stockfish
              ? 'Motore locale disponibile'
              : 'Prepara Stockfish con pnpm prepare:runtime oppure configura STOCKFISH_PATH'
          }
        >
          <span className={`status-dot ${game.health?.stockfish ? '' : 'offline'}`} />
          Stockfish
        </span>
        <span title={serviceLabel}>
          <span className={`status-dot ${game.health?.codex_authenticated ? '' : 'offline'}`} />
          Codex
        </span>
      </footer>
      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <section
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pane-title">
              <h2 id="settings-title">Impostazioni</h2>
              <button
                autoFocus
                className="icon-button"
                aria-label="Chiudi impostazioni"
                onClick={() => setSettings(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="settings-body">
              <label className="arrow-setting settings-arrow-setting">
                <input
                  type="checkbox"
                  checked={suggestedArrows}
                  onChange={(event) => setSuggestedArrows(event.target.checked)}
                />
                Mostra frecce dei suggerimenti sulla scacchiera
              </label>
              <div className="service-row">
                <strong>Maia-3</strong>
                <span>{game.health?.maia ? 'Disponibile' : 'Non disponibile'}</span>
              </div>
              <p>
                Il modello simula le scelte umane al rating selezionato. I pesi sono locali; la
                partita funziona senza rete. Il modello Accurato offre maggiore precisione, Rapido
                riduce il tempo di calcolo.
              </p>
              <div className="service-row">
                <strong>Stockfish</strong>
                <span>{game.health?.stockfish ? 'Disponibile' : 'Non disponibile'}</span>
              </div>
              <p>
                Il motore lavora sul computer. Usa la preparazione del progetto o imposta un
                eseguibile con STOCKFISH_PATH.
              </p>
              <div className="service-row">
                <strong>Codex CLI</strong>
                <span>{serviceLabel}</span>
              </div>
              <p>
                La chat usa il login ChatGPT del Codex CLI locale. Per accedere, esegui{' '}
                <code>codex login</code> nel terminale. La scacchiera funziona anche senza chat.
              </p>
              <button onClick={() => void controller.loadServices()}>
                <Icon name="refresh" size={14} />
                Verifica servizi
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
