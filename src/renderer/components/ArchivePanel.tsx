import { useEffect, useState } from 'react';
import type { GameController, GameState } from '../controller';
import { Icon } from '../Icon';

export function ArchivePanel({
  game,
  controller,
}: {
  game: GameState;
  controller: GameController;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [kind, setKind] = useState<'pgn' | 'fen'>('pgn');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => void controller.loadLibrary(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const games = game.library.filter(
    (item) =>
      item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === 'all' || (filter === 'completed' ? !!item.result : !item.result)),
  );
  const submit = async () => {
    setWorking(true);
    setError('');
    try {
      await controller.importGames(text, kind);
      setImporting(false);
      setText('');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };
  const exportGame = async () => {
    try {
      const pgn = await controller.exportPgn();
      const url = URL.createObjectURL(
        new Blob([pgn], { type: 'application/x-chess-pgn;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `Yomi-${game.gameId}.pgn`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="archive-panel">
      <div className="archive-tools">
        <button onClick={() => setImporting(true)}>
          <Icon name="import" size={14} /> Importa
        </button>
        <button disabled={!game.gameId || !!game.busy} onClick={() => void exportGame()}>
          <Icon name="export" size={14} /> PGN
        </button>
      </div>
      <label className="archive-search">
        <span className="visually-hidden">Cerca partite</span>
        <input
          aria-label="Cerca partite"
          placeholder="Cerca una partita…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="segmented archive-filter" role="group" aria-label="Filtra archivio">
        {(
          [
            ['all', 'Tutte'],
            ['active', 'In corso'],
            ['completed', 'Concluse'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="archive-list" aria-label="Partite salvate">
        {game.libraryPending && <p className="muted small">Aggiornamento archivio…</p>}
        {!games.length && !game.libraryPending && (
          <div className="empty-state">
            <Icon name="folder" size={25} />
            <span>Nessuna partita trovata</span>
            <small>Le nuove partite si salvano automaticamente.</small>
          </div>
        )}
        {games.map((item) => (
          <button
            key={item.id}
            data-testid="saved-game"
            data-game-id={item.id}
            className={`saved-game ${item.id === game.gameId ? 'active' : ''}`}
            disabled={!!game.busy}
            onClick={() => void controller.openGame(item.id)}
          >
            <span className="saved-game-title">{item.title}</span>
            <span className="saved-game-meta">
              <span>{new Date(item.updated_at).toLocaleDateString('it-IT')}</span>
              <span>{Math.ceil(item.plies / 2)} mosse</span>
            </span>
            <span className="saved-game-bottom">
              <span>
                {item.options.mode === 'computer'
                  ? item.options.engine === 'maia'
                    ? 'Maia-3'
                    : 'Stockfish'
                  : 'Libera'}
              </span>
              <strong>{item.result ?? 'In corso'}</strong>
            </span>
          </button>
        ))}
      </div>
      <div className="archive-current">
        <label>
          Titolo partita
          <input
            aria-label="Titolo partita"
            value={game.title}
            maxLength={100}
            onChange={(event) => controller.setTitle(event.target.value)}
          />
        </label>
        <small>
          {game.savePending
            ? 'Salvataggio…'
            : game.savedAt
              ? 'Salvata sul computer'
              : 'In attesa del salvataggio'}
        </small>
      </div>
      {error && !importing && <p className="inline-error">{error}</p>}
      {importing && (
        <div className="modal-backdrop" onClick={() => !working && setImporting(false)}>
          <section
            className="import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pane-title">
              <h2 id="import-title">Importa partita o posizione</h2>
              <button
                className="icon-button"
                aria-label="Chiudi importazione"
                disabled={working}
                onClick={() => setImporting(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="import-body">
              <div className="segmented">
                <button className={kind === 'pgn' ? 'active' : ''} onClick={() => setKind('pgn')}>
                  Partite PGN
                </button>
                <button className={kind === 'fen' ? 'active' : ''} onClick={() => setKind('fen')}>
                  Posizione FEN
                </button>
              </div>
              {kind === 'pgn' && (
                <label className="import-file">
                  Apri file PGN
                  <input
                    type="file"
                    aria-label="Apri file PGN"
                    accept=".pgn,.txt"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        if (file.size > 250000) setError('Il file supera 250 KB.');
                        else {
                          setText(await file.text());
                          setError('');
                        }
                      }
                    }}
                  />
                </label>
              )}
              <textarea
                autoFocus
                aria-label={kind === 'pgn' ? 'Testo PGN' : 'Testo FEN'}
                placeholder={
                  kind === 'pgn'
                    ? 'Incolla il PGN, anche con varianti e commenti…'
                    : 'Incolla una posizione FEN…'
                }
                value={text}
                maxLength={250000}
                onChange={(event) => setText(event.target.value)}
              />
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary"
                disabled={!text.trim() || working}
                onClick={() => void submit()}
              >
                {working ? 'Importazione…' : 'Importa e apri'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
