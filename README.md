# Yomi Sensei

App desktop locale per giocare e studiare gli scacchi con **Maia-3**, Stockfish e un coach Codex.
Il frontend usa **Electron, React e TypeScript**, con la shell compatta di ComprehensionIDE
come riferimento: scacchiera centrale, navigazione a sinistra, analisi e coach a destra.

## Avvio Windows

Apri **Start.cmd**. Avvia il pacchetto corrente in `release/maia/win-unpacked/Yomi Sensei.exe`.
Questa cartella include Electron, backend Python, worker Maia, pesi 5M/79M e Stockfish: l'avvio
non richiede Docker, Python, Node o pnpm installati. Conserva tutta la cartella,
non soltanto il file `.exe`.

La chat richiede separatamente **Codex CLI autenticato con ChatGPT** (`codex login`).
Le credenziali restano nel profilo locale del CLI, fuori dall'app e dai pacchetti.
I motori e la scacchiera funzionano anche senza Codex. Non usa `OPENAI_API_KEY`.

## Workspace

- **Partita / Registro**, sulla barra sinistra: modalità, avversario, rating e mosse classificate.
- **Scacchiera** centrale: click o trascinamento, arrocco, en passant e selezione della promozione.
- **Analisi / Coach**, sulla barra destra: **Maia · umana**, **Stockfish · tattica** e chat.
- Maia-3 è l'avversario predefinito in modalità Computer; puoi scegliere anche Stockfish.
- Il profilo umano imposta separatamente rating Bianco e Nero, con riferimento Lichess blitz.
- **Accurato · 79M** è il modello Maia predefinito; **Rapido · 5M** riduce il tempo di calcolo.
- Seleziona una candidata per evidenziarla sulla scacchiera e leggerne le risposte.
- I pannelli laterali si possono nascondere. Lo zoom nativo resta disponibile.
- In modalità Computer giochi con il Bianco; Indietro torna al tuo turno anche dopo una risposta fallita.
- **Nuova partita** svuota mosse e conversazione; le partite restano in memoria fino alla chiusura.

| Scorciatoia | Azione |
| --- | --- |
| Ctrl+N | Nuova partita |
| Ctrl+Z | Annulla mossa |
| Ctrl+B | Mostra/nasconde pannello partita |
| Ctrl+Alt+B | Mostra/nasconde pannello destro |
| Ctrl+F | Ruota scacchiera in modalità Libera |
| Ctrl+Shift+R | Ricalcola analisi |
| Ctrl+, | Servizi locali |

Nel pannello **Maia** la percentuale è la probabilità stimata che un umano al rating
selezionato giochi quella mossa. Le candidate non esauriscono tutte le mosse e le
percentuali mostrate non devono sommare a 100. La riga Stockfish misura la qualità
tattica della stessa candidata, anche quando è fuori dalle sue prime tre scelte.
Il tooltip mostra separatamente il W/D/L previsto da Maia per la linea.

Nel pannello **Stockfish** le percentuali sono **vittoria + 0,5 × patta** per il lato
al tratto. Nessuna di queste percentuali indica la probabilità che una mossa sia
corretta. Il coach distingue le fonti. Maia campiona dalla propria distribuzione:
gli errori umani non vengono sostituiti automaticamente da mosse Stockfish.
Un messaggio inviato mentre la
posizione cambia mantiene la propria FEN ed è etichettato come posizione precedente.

## Sviluppo

Servono Node.js 22.12+, pnpm 11 e Python 3.12 consigliato per preparare i sorgenti.

```powershell
pnpm install --frozen-lockfile
pnpm prepare:runtime
pnpm build
pnpm start
```

`prepare:runtime` crea `.venv` se necessaria, installa le dipendenze Python e prepara
Electron. Su Windows x64 scarica **Stockfish 19** dal [repository ufficiale](https://github.com/official-stockfish/Stockfish/releases/tag/sf_19),
verifica SHA-256 e conserva binario, sorgenti e licenza in `.runtime/stockfish`.
Gli altri sistemi richiedono un motore locale indicato da `STOCKFISH_PATH`.

La preparazione crea inoltre `.venv-maia` con PyTorch CPU e installa il codice
Maia-3 fissato in `vendor/maia3`. I pesi ufficiali 5M e 79M vengono scaricati in
`.runtime/maia/models`, con revisioni e SHA-256 verificati. Le partite non scaricano
modelli e non richiedono rete. I pesi occupano circa 337 MB; il runtime PyTorch
aggiunge spazio al pacchetto. Codice e pesi Maia-3 sono AGPLv3: upstream, sorgenti
dell'adattatore e licenza sono conservati nel pacchetto.
[Maia-3 ufficiale](https://github.com/CSSLab/maia3).

`pnpm dev` abilita Vite con aggiornamento React. Riavvia dopo modifiche al processo
desktop o Python. `start.sh` avvia dai sorgenti su Linux; questa piattaforma richiede
una verifica separata.

Le variabili vanno impostate nell'ambiente del processo, ad esempio in PowerShell:

```powershell
$env:CODEX_EXECUTABLE = 'C:\percorso\codex.exe'
$env:STOCKFISH_PATH = 'C:\percorso\stockfish.exe'
$env:CODEX_MODEL = ''
$env:CODEX_TIMEOUT_SECONDS = '120'
$env:STOCKFISH_DEPTH = '16'
pnpm start
```

Codex viene cercato nel PATH e, su Windows, nella distribuzione locale dell'app Codex.
`YOMI_PYTHON` consente di scegliere l'interprete per lo sviluppo. La build distribuita
usa invece il backend incorporato. `.env.example` elenca le opzioni; non viene caricato
automaticamente. Nessun dato di autenticazione viene trasferito al renderer.

`MAIA_RUNTIME_DIR` consente di scegliere la cartella dei pesi; `MAIA_PYTHON_PATH`
e `MAIA_DEVICE` permettono un runtime di sviluppo esterno. La distribuzione verificata
usa CPU, senza richiedere una scheda video. Un runtime CUDA esterno richiede verifica
separata. `.env.example` documenta anche worker e numero di thread.

## Build distribuibile Windows

```powershell
pnpm prepare:runtime
pnpm package:dir
```

PyInstaller crea backend e worker Maia standalone; electron-builder assembla
`release/maia/win-unpacked/`. Il worker è una cartella onedir distinta dal backend
leggero. La build conserva i sorgenti e le licenze dei motori. La build precedente
può restare in `release/win-unpacked`; `Start.cmd` preferisce il pacchetto Maia.
Il pacchetto locale non è firmato. Build e runtime di Linux/macOS non sono validati.

## Architettura

- `src/desktop/`: finestra Electron, menu, preload e processo backend posseduto dall'app.
- `src/shared/`: contratti tipizzati e funzioni di stato indipendenti dalla UI.
- `src/renderer/controller.ts`: mosse, annullamento, analisi associate alla FEN e conversazione.
- `src/renderer/components/`: scacchiera, registro, analisi e coach React.
- `app/chess_service.py`: regole, ricostruzione dello storico e Stockfish.
- `app/maia_service.py`: processo Maia posseduto, cache per storico/modello/rating e confronto candidate.
- `app/maia_worker.py`: inferenza e campionamento Maia in runtime PyTorch separato.
- `app/llm_service.py`: coach con contesto tattico e umano distinto.
- `vendor/maia3/`: codice ufficiale fissato, provenienza e licenza.

Il renderer usa un bridge IPC con elenco chiuso di endpoint. Il backend ascolta su
`127.0.0.1` e porta assegnata dal sistema, con token effimero mantenuto nel processo
principale. La chiusura dell'app chiude backend, Stockfish e worker Maia posseduti.
Le richieste contengono FEN iniziale e storico UCI validato; il Board conserva lo
stack per le ripetizioni e il contesto Maia. L'LLM lavora
con `codex exec --ephemeral`, sandbox read-only e prompt contestuale.

## Verifiche

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest -q
pnpm check
pnpm format:check
pnpm smoke:desktop
```

Lo smoke usa un profilo desktop isolato, Maia 5M/79M e Stockfish reali, con il CLI Codex
esplicitamente non disponibile. Verifica mosse normali/speciali, trascinamento,
annullamento, ripetizioni, avversari, rating, pannelli e chat senza account.
Non consuma chiamate al coach. Per provare il pacchetto invece dei sorgenti:

```powershell
$env:YOMI_TEST_EXECUTABLE = (Resolve-Path 'release\maia\win-unpacked\Yomi Sensei.exe').Path
pnpm smoke:desktop
```

Screenshot e rapporto sono in `artifacts/` (non tracciato). I test del controller
simulano anche risposte tardive, errori del computer e reset della conversazione.

`python scripts/benchmark_maia.py` (con l'interprete `.venv`) misura inferenza reale
e salva `artifacts/maia-benchmark.json`. Sulle 11 posizioni verificate su questa
macchina, mediana a caldo CPU: circa 34 ms (5M), 193 ms (79M). Sono misure del worker,
non il tempo totale che comprende Stockfish e il rendering.

## Memoria e lavoro residuo

Leggi [Kiroku](kiroku/START_HERE.md) e il [track Maia](kiroku/tracks/maia-integration/START_HERE.md).
Gli issue dell'analisi restano identificati nel [backlog](kiroku/WORK.md).
YS-01 è corretto tramite lo storico completo: triplice/quintupla ripetizione sono
rilevate. La partita termina automaticamente quando la patta per triplice ripetizione
è reclamabile. Le chiamate legacy con la sola FEN restano compatibili ma non possono
ricostruire le ripetizioni. Persistenza, PGN/FEN e revisione post-partita
restano sviluppi successivi. `tools/` è materiale locale preesistente estraneo all'app.
