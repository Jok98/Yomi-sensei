import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Color, DesktopCommand } from '../shared/types';
import { GameController, visibleRecords } from './controller';
import { Icon, type IconName } from './Icon';
import { Board } from './components/Board';
import { GamePanel } from './components/GamePanel';
import { AnalysisPanel, AnalysisSourceSwitcher } from './components/AnalysisPanel';
import { CoachPanel } from './components/CoachPanel';
import { ArchivePanel } from './components/ArchivePanel';
import { ReviewPanel } from './components/ReviewPanel';
import { ExercisePanel } from './components/ExercisePanel';
import { StudyTools } from './components/StudyTools';
import { Piece } from './components/Piece';

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
  const [left, setLeft] = useState<'game' | 'history' | 'library' | null>('game');
  const [right, setRight] = useState<'coach' | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [dockTab, setDockTab] = useState<'analysis' | 'review' | 'training'>('analysis');
  const [finishPrompt, setFinishPrompt] = useState(false);
  const activeTab = game.exercise ? 'training' : dockTab;
  useEffect(() => {
    setDockTab(game.gameResult ? 'review' : 'analysis');
    setFinishPrompt(false);
  }, [game.gameId]);
  useEffect(() => {
    if (game.gameResult) {
      setDockTab('review');
      setAnalysisOpen(true);
    }
  }, [game.gameResult]);
  useEffect(() => {
    const timer = setInterval(() => controller.tick(), 250);
    return () => {
      clearInterval(timer);
      controller.dispose();
    };
  }, [controller]);
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
      if (event.key === 'Escape') {
        setSettings(false);
        setFinishPrompt(false);
        controller.dismissMate();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const flip = () => {
    if (!game.busy) setOrientation((value) => (value === 'white' ? 'black' : 'white'));
  };
  useEffect(() => {
    setOrientation(game.playerColor);
  }, [game.gameId, game.playerColor]);
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
          {game.savePending && game.error.startsWith('Salvataggio') && (
            <button
              disabled={!!game.busy}
              onClick={() => void controller.flushSave().catch(() => {})}
            >
              Riprova salvataggio
            </button>
          )}
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
          <ToolButton
            label="Archivio"
            icon="folder"
            active={left === 'library'}
            onClick={() => {
              setLeft(left === 'library' ? null : 'library');
              void controller.loadLibrary();
            }}
          />
          <ToolButton
            label="Allenamento"
            icon="target"
            active={activeTab === 'training' && analysisOpen}
            onClick={() => {
              setDockTab('training');
              setAnalysisOpen(true);
              void controller.loadExercises();
            }}
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
              <h2>{left === 'game' ? 'Partita' : left === 'library' ? 'Archivio' : 'Registro'}</h2>
              <button
                className="icon-button"
                aria-label="Nascondi pannello partita"
                onClick={() => setLeft(null)}
              >
                <Icon name="panel" size={15} />
              </button>
            </div>
            {left === 'library' ? (
              <ArchivePanel game={game} controller={controller} />
            ) : (
              <GamePanel game={game} controller={controller} tab={left} />
            )}
          </aside>
        )}
        <section className="board-pane" aria-label="Area di gioco">
          <div className="board-toolbar">
            <div className="board-tab">
              <Icon name="board" size={14} />
              Scacchiera
              <span
                className={`tab-dot ${game.savePending ? 'saving' : 'saved'}`}
                title={game.savePending ? 'Salvataggio…' : 'Partita salvata'}
              />
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
            </div>
          </div>
          <div className="breadcrumbs">
            <span>
              {game.exercise
                ? 'Esercizio'
                : game.historyPly !== null
                  ? game.variationId
                    ? 'Variante'
                    : 'Studio'
                  : game.mode === 'computer'
                    ? 'Contro computer'
                    : 'Partita libera'}
            </span>
            <span>/</span>
            <span>
              {game.position?.is_game_over
                ? 'Conclusa'
                : `${Math.floor((game.historyPly ?? game.moves.length) / 2) + 1}. ${game.position?.turn === 'black' ? 'Nero' : 'Bianco'} al tratto`}
            </span>
          </div>
          <Board
            game={game}
            controller={controller}
            orientation={orientation}
            suggestedArrows={suggestedArrows}
            onFlip={flip}
            onFinish={() => setFinishPrompt(true)}
          />
          <div className="board-footer">
            <span>
              {visibleRecords(game).at(-1)
                ? `Mossa · ${visibleRecords(game).at(-1)!.san}`
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
                {(
                  [
                    ['analysis', 'Analisi', 'chart'],
                    ['review', 'Revisione', 'book'],
                    ['training', 'Allenamento', 'target'],
                  ] as const
                ).map(([tab, label, icon]) => (
                  <button
                    key={tab}
                    id={`${tab}-tab`}
                    role="tab"
                    aria-controls="analysis-page"
                    aria-selected={activeTab === tab && analysisOpen}
                    aria-expanded={activeTab === tab && analysisOpen}
                    className={activeTab === tab && analysisOpen ? 'active' : ''}
                    title={label}
                    onClick={() => {
                      setDockTab(tab);
                      setAnalysisOpen(activeTab === tab ? !analysisOpen : true);
                    }}
                  >
                    <Icon name={icon} size={14} />
                    <span className="dock-tab-label">{label}</span>
                  </button>
                ))}
              </div>
              {analysisOpen && activeTab === 'analysis' && (
                <AnalysisSourceSwitcher game={game} controller={controller} />
              )}
              <div className="pane-actions">
                {activeTab === 'analysis' && (
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
                )}
                <button
                  className="icon-button"
                  aria-label="Ricalcola analisi"
                  title="Ricalcola · Ctrl+Shift+R"
                  disabled={
                    !!game.busy ||
                    game.analysisPending ||
                    game.humanPending ||
                    activeTab !== 'analysis'
                  }
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
              aria-labelledby={`${activeTab}-tab`}
              hidden={!analysisOpen}
            >
              {activeTab === 'analysis' ? (
                <>
                  <StudyTools game={game} controller={controller} />
                  <AnalysisPanel game={game} controller={controller} />
                </>
              ) : activeTab === 'review' ? (
                <ReviewPanel
                  game={game}
                  controller={controller}
                  onChat={() => setRight('coach')}
                  onTrain={() => {
                    setDockTab('training');
                    void controller.loadExercises();
                  }}
                />
              ) : (
                <ExercisePanel game={game} controller={controller} />
              )}
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
            onClick={() => {
              setDockTab('analysis');
              setAnalysisOpen((value) => !value);
            }}
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
      {game.mateNotice && (
        <div className="modal-backdrop mate-backdrop">
          <section
            className="mate-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mate-title"
            data-testid="checkmate-popup"
          >
            <button
              className="icon-button mate-close"
              aria-label="Chiudi risultato"
              onClick={controller.dismissMate}
            >
              <Icon name="close" />
            </button>
            <span className="mate-king">
              <Piece piece={game.mateNotice === 'white' ? 'K' : 'k'} />
            </span>
            <h2 id="mate-title">Scacco matto</h2>
            <p>
              Vince il {game.mateNotice === 'white' ? 'Bianco' : 'Nero'} · {game.gameResult}
            </p>
            <small>
              {game.savePending ? 'Salvataggio in corso…' : 'Partita salvata.'} La revisione finale
              viene preparata una sola volta.
            </small>
            <div className="mate-actions">
              <button
                className="primary"
                disabled={!!game.busy}
                onClick={() => {
                  controller.dismissMate();
                  controller.navigate(0, null);
                  setDockTab('review');
                  setAnalysisOpen(true);
                  setLeft('history');
                }}
              >
                Rivedi partita
              </button>
              <button
                disabled={!!game.busy}
                onClick={() => {
                  controller.dismissMate();
                  void controller.newGame();
                }}
              >
                Nuova partita dopo il matto
              </button>
            </div>
          </section>
        </div>
      )}
      {finishPrompt && (
        <div className="modal-backdrop" onClick={() => setFinishPrompt(false)}>
          <section
            className="finish-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pane-title">
              <h2 id="finish-title">Concludi partita</h2>
              <button
                className="icon-button"
                aria-label="Chiudi conclusione"
                onClick={() => setFinishPrompt(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="finish-body">
              <p>La partita resterà nell'archivio con il risultato e la revisione.</p>
              <button
                onClick={() => {
                  setFinishPrompt(false);
                  void controller.finishGame('resignation');
                }}
              >
                Abbandona ·{' '}
                {game.mode === 'computer'
                  ? game.playerColor === 'white'
                    ? 'Bianco'
                    : 'Nero'
                  : game.livePosition?.turn === 'white'
                    ? 'Bianco'
                    : 'Nero'}
              </button>
              <button
                onClick={() => {
                  setFinishPrompt(false);
                  void controller.finishGame('draw');
                }}
              >
                Concludi in patta
              </button>
            </div>
          </section>
        </div>
      )}
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
