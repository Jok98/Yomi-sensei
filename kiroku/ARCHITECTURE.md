# Architettura

## Flussi principali

- Mossa: browser → `/api/game/move` → `python-chess` → FEN e mosse legali aggiornate.
- Analisi: FEN → `/api/analyze` → Stockfish MultiPV=3 → SAN, variante e stima W/D/L.
- Chat: domanda + FEN + storico + candidate → `/api/chat` → `codex exec` → account ChatGPT.
- Distribuzione: FastAPI serve sia le API sia i file PWA dalla stessa origine/container.

## Confini

- `app/chess_service.py` possiede regole, stato derivato e processo Stockfish.
- `app/llm_service.py` possiede prompt, isolamento e processo Codex CLI.
- `app/main.py` espone HTTP e traduce gli errori in risposte API.
- `app/static/` possiede esperienza utente e stato volatile della sessione.

## Pattern da preservare

- Backend stateless rispetto alla partita: ogni richiesta contiene una FEN completa.
- Stockfish serializzato con lock perché un singolo processo UCI serve più richieste.
- Contesto LLM ancorato alle linee del motore e mai usato per validare le mosse.
- Dipendenze frontend zero per ridurre build, rete e differenze tra piattaforme.

## Dettagli importanti

- La percentuale è `W + 0,5 × D`, calcolata dal modello W/D/L di Stockfish.
- Il punteggio del motore è sempre dal punto di vista del lato al tratto.
- Codex riceve il prompt via stdin e gira con sessione effimera, sandbox read-only e tool disabilitati.
- `CODEX_HOME` è montato nel volume privato `codex-auth`; non viene copiato nell'immagine.
- La PWA non mette in cache le risposte `/api/`.

## Punti di integrazione

- Codex CLI autenticato con ChatGPT; modello opzionale configurabile con `CODEX_MODEL`.
- Stockfish installato via pacchetto Debian e configurabile con `STOCKFISH_PATH`.
- Docker Compose pubblica solo `127.0.0.1:8787` per limitare l'esposizione locale.
