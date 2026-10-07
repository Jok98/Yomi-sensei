import type { GameController, GameState } from '../controller';
import { Icon } from '../Icon';
import { StudyTools } from './StudyTools';

export function ReviewPanel({
  game,
  controller,
  onChat,
  onTrain,
}: {
  game: GameState;
  controller: GameController;
  onChat: () => void;
  onTrain: () => void;
}) {
  const review = game.review;
  const points = review?.report?.points ?? [];
  const count = Math.max(1, game.moves.length);
  const coords = points.map(
    (point) =>
      `${(point.ply / count) * 800},${50 - Math.max(-8, Math.min(8, point.white_score)) * 5}`,
  );
  return (
    <div className="review-content" data-testid="game-review">
      <StudyTools game={game} controller={controller} />
      {!game.gameResult ? (
        <div className="empty-state">
          <Icon name="chart" size={25} />
          <strong>Revisione della partita</strong>
          <span>La revisione finale viene preparata e salvata quando la partita termina.</span>
          <small>Puoi già esplorare le mosse nel Registro.</small>
        </div>
      ) : (
        <>
          <div className="review-heading">
            <strong>
              {game.gameResult} · {game.title}
            </strong>
            <span>{review?.state === 'complete' ? 'Analisi salvata' : 'Analisi finale'}</span>
          </div>
          {(!review || review.state === 'running') && (
            <div className="review-progress" role="status">
              <span className="spinner" />
              Analisi delle posizioni · {review?.progress ?? 0}%
            </div>
          )}
          {!!points.length && (
            <div className="evaluation-chart">
              <svg
                viewBox="0 0 800 100"
                preserveAspectRatio="none"
                role="img"
                aria-label="Andamento del vantaggio del Bianco"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  controller.navigate(
                    Math.round(((event.clientX - rect.left) / rect.width) * count),
                    null,
                  );
                }}
              >
                <line x1="0" x2="800" y1="50" y2="50" className="chart-zero" />
                <polyline points={coords.join(' ')} className="chart-line" />
                <line
                  x1={((game.historyPly ?? count) / count) * 800}
                  x2={((game.historyPly ?? count) / count) * 800}
                  y1="0"
                  y2="100"
                  className="chart-cursor"
                />
              </svg>
              <label>
                <span>Bianco + / Nero − · profondità {review?.report?.depth}</span>
                <input
                  aria-label="Mossa sul grafico"
                  type="range"
                  min="0"
                  max={game.moves.length}
                  value={game.historyPly ?? game.moves.length}
                  onChange={(event) => controller.navigate(Number(event.target.value), null)}
                />
              </label>
            </div>
          )}
          {!!review?.report?.moments?.length && (
            <div className="review-moments">
              {review.report.moments.slice(0, 3).map((moment) => (
                <button
                  key={moment.ply}
                  className={`review-moment judgement-text-${moment.classification.code}`}
                  onClick={() => controller.navigate(moment.ply, null)}
                >
                  <strong>
                    {Math.floor(moment.ply / 2) + 1}
                    {moment.color === 'white' ? '.' : '…'} {moment.played} ·{' '}
                    {moment.classification.label}
                  </strong>
                  <span>
                    Alternativa: {moment.best.san} · {moment.best.evaluation}
                  </span>
                  <small>{moment.best.principal_variation.join(' ')}</small>
                  {moment.human_probability !== null && (
                    <small>Maia: scelta umana {moment.human_probability.toFixed(1)}%</small>
                  )}
                </button>
              ))}
            </div>
          )}
          {review?.summary && (
            <article className="saved-review-text">
              {review.summary.split(/\n\n+/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </article>
          )}
          {review?.agent_state === 'running' && (
            <p className="review-progress" role="status">
              <span className="spinner" />
              Yomi sta preparando la spiegazione da salvare…
            </p>
          )}
          {review?.agent_error && <p className="review-note">{review.agent_error}</p>}
          {review?.error && <p className="inline-error">{review.error}</p>}
          <div className="review-actions">
            {(review?.state === 'failed' || review?.state === 'interrupted') &&
              !review.agent_attempted && (
                <button onClick={() => void controller.refreshReview(true)}>
                  Riprendi analisi motore
                </button>
              )}
            {review?.state === 'complete' && !review.agent_attempted && (
              <button
                disabled={!game.health?.codex_authenticated}
                onClick={() => void controller.refreshReview(true)}
              >
                Genera spiegazione del coach
              </button>
            )}
            <button onClick={onChat}>
              <Icon name="chat" size={13} /> Chiedi al coach
            </button>
            {!!review?.report?.exercise_count && (
              <button onClick={onTrain}>
                <Icon name="target" size={13} /> {review.report.exercise_count} esercizi dalla
                partita
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
