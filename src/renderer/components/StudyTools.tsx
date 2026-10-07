import { pathRecords, studyKey, type GameController, type GameState } from '../controller';
import { Icon } from '../Icon';

export function StudyTools({ game, controller }: { game: GameState; controller: GameController }) {
  if (game.historyPly === null || game.exercise) return null;
  return (
    <section className="study-tools" aria-label="Strumenti studio">
      <div className="study-heading">
        <strong>
          {game.variationId ? 'Variante' : 'Studio'} · {game.historyPly}/{pathRecords(game).length}
        </strong>
        {!game.variationId && (
          <button
            disabled={!!game.busy || !game.position?.legal_moves.length}
            onClick={() => void controller.startVariation()}
          >
            <Icon name="plus" size={12} /> Prova variante
          </button>
        )}
        {game.variationId && (
          <button onClick={() => controller.navigate(game.historyPly!, null)}>
            Linea originale
          </button>
        )}
        {!game.gameResult && (
          <button disabled={!!game.busy} onClick={() => void controller.resumeGame()}>
            <Icon name="play" size={12} /> Riprendi partita
          </button>
        )}
      </div>
      {!!game.variations.length && (
        <label className="study-variant">
          Linea
          <select
            aria-label="Variante da esplorare"
            value={game.variationId ?? ''}
            onChange={(event) => {
              const branch = game.variations.find((item) => item.id === event.target.value);
              controller.navigate(
                branch ? branch.root_ply + branch.records.length : game.historyPly!,
                branch?.id ?? null,
              );
            }}
          >
            <option value="">Partita originale</option>
            {game.variations.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.title} · {branch.records.length} mosse
              </option>
            ))}
          </select>
        </label>
      )}
      <details className="study-comment">
        <summary>Commento alla posizione</summary>
        <textarea
          aria-label="Commento alla posizione"
          placeholder="Annota un piano o qualcosa da ripassare…"
          value={game.comments[studyKey(game)] ?? ''}
          maxLength={4000}
          onChange={(event) => controller.setComment(event.target.value)}
        />
      </details>
    </section>
  );
}
