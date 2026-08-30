# Yomi Sensei

Yomi Sensei è una scacchiera locale per giocare e studiare con:

- drag-and-drop e click-to-move;
- regole validate da `python-chess`;
- modalità **Libera** e **Contro computer**, con quattro difficoltà Stockfish;
- tre mosse candidate per chi gioca e tre risposte dell'avversario per ogni scelta,
  calcolate da Stockfish con linee e stima W/D/L;
- giudizio immediato della mossa (da manuale, migliore, eccellente, buona,
  imprecisione, errore o grave errore) con badge sulla casa di arrivo e registro
  laterale;
- chat contestuale tramite **Codex CLI autenticato con l'abbonamento ChatGPT**;
- selezione nell'interfaccia del modello Codex e del relativo reasoning;
- PWA installabile e runtime Docker portabile.

Non usa `OPENAI_API_KEY` e non chiama direttamente la Responses API. Come in
[Sebas](https://github.com/Jok98/Sebas), il backend esegue `codex exec` in modalità
effimera, senza strumenti e con sandbox read-only.

## Avvio Docker con account ChatGPT

Serve Docker Desktop o un runtime Docker compatibile.

1. Costruisci l'immagine, che include Stockfish e Codex CLI:

   ```powershell
   docker compose build
   ```

2. Una sola volta, autentica il Codex CLI del container con il tuo account ChatGPT:

   ```powershell
   docker compose run --rm yomi-sensei codex login --device-auth
   ```

   Apri il link mostrato, inserisci il codice temporaneo e completa il login. Le
   credenziali restano nel volume Docker privato `codex-auth` e non nell'immagine o
   nel repository.

3. Avvia l'app:

   ```powershell
   docker compose up
   ```

4. Apri [http://localhost:8787](http://localhost:8787). Lo stato in alto diventa
   verde quando Stockfish è disponibile e Codex risulta autenticato via ChatGPT.

Per controllare il login senza avviare l'app:

```powershell
docker compose run --rm yomi-sensei codex login status
```

Non copiare o pubblicare il contenuto del volume di autenticazione: contiene token
equivalenti a una credenziale.

## Modello Codex

Per impostazione predefinita non viene fissato uno slug: il CLI usa il modello
disponibile per l'account e per la sua versione corrente. È possibile forzarlo in un
file `.env`, ma soltanto se quel modello è accessibile dall'account:

```dotenv
CODEX_MODEL=
CODEX_TIMEOUT_SECONDS=120
STOCKFISH_DEPTH=16
```

Nella chat il menu dei modelli viene popolato direttamente da `codex debug models`,
quindi segue il catalogo esposto dal CLI autenticato. Il menu del reasoning si adatta
ai livelli supportati dal modello selezionato; la scelta viene passata a `codex exec`
solo quando si invia un messaggio.

## Significato delle percentuali

Le tre mosse arrivano da Stockfish MultiPV. Per ogni linea mostriamo l'**esito
atteso per il lato al tratto**:

```text
percentuale = probabilità di vittoria + 0,5 × probabilità di patta
```

Non è la probabilità che la mossa sia "corretta". Le tre percentuali quindi non
devono sommare a 100; il tooltip mostra vittoria, patta e sconfitta separatamente.

In modalità **Contro computer** giochi con il Bianco e puoi scegliere Facile,
Medio, Difficile o Esperto. La forza è limitata tramite le opzioni UCI di
Stockfish; in questa modalità l'interfaccia mostra soltanto le tre mosse migliori
del giocatore e l'annullamento torna indietro di un turno completo.

## Giudizio delle mosse

Le mosse presenti nel piccolo repertorio locale di aperture sono indicate come
**Da manuale**. Per le altre, Stockfish confronta i punti attesi della mossa giocata
con quelli della sua scelta migliore. Il badge sulla casa di arrivo mostra il
giudizio dell'ultima mossa; il registro conserva invece il giudizio di ogni mossa.
In modalità Contro computer viene giudicata la mossa del giocatore, non quella
generata dal motore.

## Architettura

```text
Browser / PWA
  ├─ mosse → FastAPI → python-chess
  ├─ posizione → FastAPI → Stockfish MultiPV=3
  └─ domanda + FEN + storico + linee
       → Codex CLI `exec --ephemeral` → account ChatGPT
```

Ogni domanda è stateless: il browser invia la posizione e gli ultimi messaggi. Il
processo Codex lavora in una cartella temporanea, in sandbox read-only, senza shell,
ricerca web o lettura immagini. La chat può usare Internet per raggiungere Codex;
scacchiera e Stockfish restano locali e funzionano anche senza login.

## API principali

- `GET /api/health` — disponibilità di Stockfish, Codex CLI e login ChatGPT;
- `GET /api/game/new` — nuova posizione iniziale;
- `POST /api/game/move` — applica una mossa legale;
- `POST /api/game/computer-move` — fa giocare Stockfish al livello selezionato;
- `POST /api/classify-move` — classifica una mossa legale rispetto alla posizione;
- `GET /api/codex/options` — modelli e livelli di reasoning esposti dal Codex CLI;
- `POST /api/analyze` — restituisce tre linee e le tre risposte a ciascuna;
- `POST /api/chat` — discute la posizione tramite Codex CLI;
- `GET /docs` — documentazione OpenAPI interattiva.

## Verifica locale senza Docker

Servono Python, Stockfish e Codex CLI già autenticato con `codex login`:

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt
$env:STOCKFISH_PATH = "C:\percorso\stockfish.exe"
.venv\Scripts\pytest
.venv\Scripts\uvicorn app.main:app --reload
```

Il backend riusa automaticamente l'autenticazione salvata dal CLI. Per indicare un
eseguibile non presente nel `PATH`, imposta `CODEX_EXECUTABLE`.

## Prossimi passi

- import/export PGN e caricamento FEN;
- livelli di analisi configurabili;
- memoria locale delle partite;
- modalità sparring e revisione post-partita;
- eventuale wrapper Tauri per un installer nativo.
