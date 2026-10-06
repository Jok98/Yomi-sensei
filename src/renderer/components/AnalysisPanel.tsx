import type { Candidate, HumanCandidate } from '../../shared/types';
import type { GameController, GameState } from '../controller';
import { Icon } from '../Icon';

function CandidateRow({
  candidate,
  active,
  onSelect,
}: {
  candidate: Candidate;
  active?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <span className={`candidate-rank rank-${candidate.rank}`}>{candidate.rank}</span>
      <span className="candidate-copy">
        <strong>{candidate.san}</strong>
        <span className="variation" title={candidate.principal_variation.join(' ')}>
          {candidate.principal_variation.join(' ')}
        </span>
      </span>
      <span className="candidate-score">
        <strong>{candidate.evaluation}</strong>
        <small>{candidate.expected_score_percent.toFixed(1)}%</small>
      </span>
    </>
  );
  const title = `Esito atteso · Vittoria ${candidate.win_percent}% · Patta ${candidate.draw_percent}% · Sconfitta ${candidate.loss_percent}%`;
  return onSelect ? (
    <button
      className={`candidate-row ${active ? 'active' : ''}`}
      aria-pressed={!!active}
      data-candidate-uci={candidate.uci}
      title={title}
      onClick={onSelect}
    >
      {body}
    </button>
  ) : (
    <div className="candidate-row reply" title={title}>
      {body}
    </div>
  );
}
export function AnalysisSourceSwitcher({
  game,
  controller,
}: {
  game: GameState;
  controller: GameController;
}) {
  return (
    <div className="segmented analysis-switcher" role="group" aria-label="Fonte analisi">
      <button
        aria-label="Maia · umana"
        aria-pressed={game.analysisSource === 'human'}
        className={game.analysisSource === 'human' ? 'active' : ''}
        onClick={() => controller.setAnalysisSource('human')}
      >
        Maia <span className="source-kind">· umana</span>
      </button>
      <button
        aria-label="Stockfish · tattica"
        aria-pressed={game.analysisSource === 'stockfish'}
        className={game.analysisSource === 'stockfish' ? 'active' : ''}
        onClick={() => controller.setAnalysisSource('stockfish')}
      >
        Stockfish <span className="source-kind">· tattica</span>
      </button>
    </div>
  );
}
function HumanRow({
  candidate,
  active,
  onSelect,
}: {
  candidate: HumanCandidate;
  active?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <span className={`candidate-rank rank-${candidate.rank}`}>{candidate.rank}</span>
      <span className="candidate-copy">
        <strong>{candidate.san}</strong>
        <span
          className="variation"
          title={
            candidate.stockfish
              ? `Valutazione Stockfish ${candidate.stockfish.evaluation}`
              : 'Previsione Maia-3'
          }
        >
          {candidate.stockfish
            ? `Stockfish ${candidate.stockfish.evaluation}`
            : 'Previsione Maia-3'}
        </span>
      </span>
      <span className="candidate-score">
        <strong>{candidate.move_probability_percent.toFixed(1)}%</strong>
        <small>scelta umana</small>
      </span>
    </>
  );
  const title = `Probabilità stimata della mossa: ${candidate.move_probability_percent}% · W/D/L Maia: ${candidate.win_percent}/${candidate.draw_percent}/${candidate.loss_percent}% · ${candidate.stockfish ? `Valutazione tattica Stockfish: ${candidate.stockfish.evaluation}` : 'Valutazione Stockfish non disponibile'}`;
  return onSelect ? (
    <button
      className={`candidate-row human-candidate ${active ? 'active' : ''}`}
      aria-pressed={!!active}
      data-candidate-uci={candidate.uci}
      title={title}
      onClick={onSelect}
    >
      {body}
    </button>
  ) : (
    <div className="candidate-row human-candidate reply" title={title}>
      {body}
    </div>
  );
}
function HumanPanel({ game, controller }: { game: GameState; controller: GameController }) {
  const analysis = game.analysis?.fen === game.position?.fen ? game.analysis : null;
  const human = analysis?.human;
  const reply = human?.replies.find((item) => item.after_uci === game.activeCandidate);
  const rating =
    game.position?.turn === 'black' ? game.maiaProfile.black_elo : game.maiaProfile.white_elo;
  return (
    <div className="analysis-content">
      <div className="analysis-summary">
        <span className={`turn-dot ${game.position?.turn}`} />
        <strong>{game.position?.turn === 'black' ? 'Nero' : 'Bianco'} al tratto</strong>
        <span className="muted">Rating {rating}</span>
      </div>
      {(game.analysisPending || game.busy) && (
        <div className="analysis-progress">
          <span className="spinner" />
          {game.busy || 'Analisi Maia e Stockfish'}
        </div>
      )}
      {(game.analysisError || analysis?.human_error) && (
        <div className="inline-error" role="status">
          <p>{game.analysisError || analysis?.human_error}</p>
          <button onClick={() => void controller.analyze()}>
            <Icon name="refresh" size={14} />
            Riprova
          </button>
        </div>
      )}
      {analysis?.stockfish_error && (
        <p className="muted small">
          Valutazione tattica non disponibile: {analysis.stockfish_error}
        </p>
      )}
      {game.position?.is_game_over ? (
        <div className="empty-state">
          <Icon name="check" size={28} />
          <strong>{game.position.status}</strong>
        </div>
      ) : (
        <>
          <div className="analysis-columns">
            <section className="recommendations">
              <div className="section-label">
                Scelte umane probabili <span>Maia-3</span>
              </div>
              <div className="candidate-list" data-testid="human-analysis">
                {human?.candidates.map((candidate) => (
                  <HumanRow
                    key={candidate.uci}
                    candidate={candidate}
                    active={candidate.uci === game.activeCandidate}
                    onSelect={() => controller.selectCandidate(candidate.uci)}
                  />
                ))}
              </div>
              {!human &&
                !game.analysisPending &&
                !game.busy &&
                !analysis?.human_error &&
                !game.analysisError && (
                  <div className="empty-state">Analisi umana non disponibile</div>
                )}
            </section>
            {game.mode === 'free' && (
              <section className="opponent-section" data-testid="opponent-analysis">
                <div className="section-label">
                  Risposte umane probabili {reply && <span>dopo {reply.after_san}</span>}
                </div>
                <div className="candidate-list">
                  {reply?.candidates.map((candidate) => (
                    <HumanRow key={candidate.uci} candidate={candidate} />
                  ))}
                </div>
                {reply && !reply.candidates.length && (
                  <p className="muted small">La variante termina la partita.</p>
                )}
                {!reply && <p className="muted small">Seleziona una candidata dopo l’analisi.</p>}
              </section>
            )}
          </div>
          <details className="metric-note">
            <summary>Come leggere l’analisi</summary>
            <p>
              Maia stima la probabilità che un umano al rating scelto giochi la mossa. Stockfish ne
              valuta la qualità tattica. I W/D/L Maia nel tooltip sono previsioni di esito separate.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
export function AnalysisPanel({
  game,
  controller,
}: {
  game: GameState;
  controller: GameController;
}) {
  if (game.analysisSource === 'human') return <HumanPanel game={game} controller={controller} />;
  const analysis = game.analysis?.fen === game.position?.fen ? game.analysis : null;
  const reply = analysis?.replies.find((item) => item.after_uci === game.activeCandidate);
  return (
    <div className="analysis-content">
      <div className="analysis-summary">
        <span className={`turn-dot ${game.position?.turn}`} />
        <strong>{game.position?.turn === 'black' ? 'Nero' : 'Bianco'} al tratto</strong>
        <span className="muted">{analysis ? `Profondità ${analysis.depth}` : 'Stockfish'}</span>
      </div>
      {game.analysisPending || game.busy ? (
        <div className="analysis-progress">
          <span className="spinner" />
          {game.busy || 'Analisi della posizione'}
        </div>
      ) : null}
      {game.analysisError && (
        <div className="inline-error" role="status">
          <p>{game.analysisError}</p>
          <button onClick={() => void controller.analyze()}>
            <Icon name="refresh" size={14} />
            Riprova
          </button>
        </div>
      )}
      {analysis?.stockfish_error && (
        <div className="inline-error" role="status">
          <p>{analysis.stockfish_error}</p>
          <button onClick={() => void controller.analyze()}>Riprova</button>
        </div>
      )}
      {game.position?.is_game_over ? (
        <div className="empty-state">
          <Icon name="check" size={28} />
          <strong>{game.position.status}</strong>
        </div>
      ) : (
        <>
          <div className="analysis-columns">
            <section className="recommendations">
              <div className="section-label">
                Mosse consigliate <span>Stockfish</span>
              </div>
              <div className="candidate-list">
                {analysis?.candidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.uci}
                    candidate={candidate}
                    active={candidate.uci === game.activeCandidate}
                    onSelect={() => controller.selectCandidate(candidate.uci)}
                  />
                ))}
              </div>
              {!analysis && !game.analysisPending && !game.busy && !game.analysisError && (
                <div className="empty-state">Analisi non disponibile</div>
              )}
            </section>
            {game.mode === 'free' && (
              <section className="opponent-section" data-testid="opponent-analysis">
                <div className="section-label">
                  Risposte avversarie {reply && <span>dopo {reply.after_san}</span>}
                </div>
                <div className="candidate-list">
                  {reply?.candidates.map((candidate) => (
                    <CandidateRow key={candidate.uci} candidate={candidate} />
                  ))}
                </div>
                {reply && !reply.candidates.length && (
                  <p className="muted small">La variante termina la partita.</p>
                )}
                {!reply && (
                  <p className="muted small">Disponibili dopo l’analisi delle candidate.</p>
                )}
              </section>
            )}
          </div>
          <details className="metric-note">
            <summary>Come leggere l’analisi</summary>
            <p>
              Le percentuali indicano l’esito atteso: vittoria + metà delle patte. La valutazione è
              dal lato al tratto.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
