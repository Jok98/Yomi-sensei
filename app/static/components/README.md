# Frontend component boundaries

Yomi Sensei usa un solo runtime e un solo stato condiviso, ma divide il frontend
in componenti autonomi. È una struttura component-oriented, più semplice e adatta
all'app rispetto a microfrontend distribuiti e compilati separatamente.

- `chess-board`: rendering e interazione della scacchiera;
- `move-history`: registro, classificazioni e scroll;
- `player-analysis` / `opponent-analysis`: linee Stockfish;
- `game-controls`: nuova partita, annullamento e rotazione;
- `codex-coach`: modello, reasoning e chat contestuale;
- `core/state.js`: unica fonte di verità della sessione;
- `core/api.js`: trasporto HTTP condiviso.

I componenti non devono duplicare stato, chiamate API o regole scacchistiche. Le
prossime estrazioni da `app.js` manterranno questa stessa separazione.
