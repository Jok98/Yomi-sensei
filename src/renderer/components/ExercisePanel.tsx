import { parseFen } from '../../shared/game';
import type { GameController, GameState } from '../controller';
import { Icon } from '../Icon';

export function ExercisePanel({
  game,
  controller,
}: {
  game: GameState;
  controller: GameController;
}) {
  const session = game.exercise;
  const due = game.exercises.filter((item) => new Date(item.due_at).getTime() <= Date.now()).length;
  const successes = game.exercises.reduce((total, item) => total + item.successes, 0);
  const pieceNames: Record<string, string> = {
    p: 'pedone',
    n: 'cavallo',
    b: 'alfiere',
    r: 'torre',
    q: 'donna',
    k: 're',
  };
  if (session) {
    const exercise = session.exercise;
    const piece = parseFen(exercise.fen)[exercise.best_move.slice(0, 2)];
    return (
      <div className="exercise-content" data-testid="active-exercise">
        <div className="exercise-heading">
          <strong>
            {exercise.position.turn === 'white' ? 'Bianco' : 'Nero'} muove · trova una mossa
            migliore
          </strong>
          <button aria-label="Chiudi esercizio" onClick={() => controller.stopExercise()}>
            <Icon name="close" size={13} />
          </button>
        </div>
        <p className="muted small">
          Dalla tua partita “{exercise.game_title}”, dopo {Math.floor(exercise.ply / 2)} mosse.
          Giocata: {exercise.played}.
        </p>
        {session.feedback && (
          <p className={session.solved ? 'exercise-correct' : 'exercise-feedback'} role="status">
            {session.feedback}
          </p>
        )}
        {session.hint >= 1 && (
          <p className="exercise-hint">
            Cerca una mossa del {pieceNames[piece?.toLowerCase()] ?? 'pezzo'}.
          </p>
        )}
        {session.hint >= 2 && (
          <p className="exercise-hint">Il pezzo parte da {exercise.best_move.slice(0, 2)}.</p>
        )}
        {(session.hint >= 3 || session.solved) && (
          <p className="exercise-hint">
            Linea verificata: {exercise.variation.join(' ') || exercise.best_san}
          </p>
        )}
        <div className="exercise-actions">
          {!session.solved && (
            <button disabled={session.hint >= 3} onClick={() => controller.exerciseHint()}>
              Suggerimento {session.hint + 1}/3
            </button>
          )}
          {session.solved && (
            <button
              onClick={() => {
                const next = game.exercises.find((item) => item.id !== exercise.id);
                if (next) void controller.startExercise(next);
                else controller.stopExercise();
              }}
            >
              Prossimo esercizio
            </button>
          )}
          <small>Soluzione Stockfish · profondità {exercise.depth}</small>
        </div>
      </div>
    );
  }
  return (
    <div className="exercise-content" data-testid="exercise-library">
      <div className="exercise-heading">
        <strong>Allenamento personale</strong>
        <span>
          {due} da ripassare · {successes} risolti
        </span>
      </div>
      {!game.exercises.length && (
        <div className="empty-state">
          <Icon name="target" size={25} />
          <span>Gli esercizi nascono dalle tue partite concluse.</span>
          <small>
            La revisione seleziona errori e occasioni mancate con una soluzione verificata.
          </small>
        </div>
      )}
      <div className="exercise-list">
        {game.exercises.map((exercise) => (
          <button
            key={exercise.id}
            data-testid="exercise-card"
            className="exercise-card"
            disabled={!!game.busy}
            onClick={() => void controller.startExercise(exercise)}
          >
            <strong>{exercise.game_title}</strong>
            <span>
              {Math.floor(exercise.ply / 2) + 1}. {exercise.played} ·{' '}
              {exercise.classification.label}
            </span>
            <small>
              {exercise.successes}/{exercise.attempts} risolti ·{' '}
              {new Date(exercise.due_at).getTime() <= Date.now()
                ? 'Da ripassare'
                : `Ripasso ${new Date(exercise.due_at).toLocaleDateString('it-IT')}`}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}
