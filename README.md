# Yomi Sensei

App desktop locale per giocare e studiare gli scacchi con **Maia-3**, Stockfish e un coach Codex.
Il frontend usa **Electron, React e TypeScript**, con la shell compatta di ComprehensionIDE
come riferimento: scacchiera centrale, navigazione a sinistra, analisi sotto il gioco e coach a destra.

## Avvio Windows

Apri **Start.cmd**. Avvia il pacchetto corrente in `release/0.6.0/win-unpacked/Yomi Sensei.exe`.
Questa cartella include Electron, backend Python, worker Maia, pesi 5M/79M e Stockfish: l'avvio
non richiede Docker, Python, Node o pnpm installati. Conserva tutta la cartella,
non soltanto il file `.exe`.

La chat richiede separatamente **Codex CLI autenticato con ChatGPT** (`codex login`).
Le credenziali restano nel profilo locale del CLI, fuori dall'app e dai pacchetti.
I motori e la scacchiera funzionano anche senza Codex. Non usa `OPENAI_API_KEY`.

## Workspace

- **Partita / Registro / Archivio**, sulla barra sinistra: modalità, avversario, rating, mosse e partite salvate.
- **Scacchiera** centrale: colori classici beige/marrone e pezzi SVG CBurnett; click o trascinamento,
  arrocco, en passant e selezione della promozione.
- **Barra del vantaggio** a sinistra del tavoliere: valutazione Stockfish in pedoni, positiva per il
  Bianco e negativa per il Nero. Le parti bianca/nera seguono la rotazione; `M` indica matto e `½` patta.
  Usa la prima candidata Stockfish anche con analisi Maia o una candidata diversa selezionata.
  Durante il ricalcolo mostra i puntini e l'ultima valutazione attenuata; `—` indica un dato assente.
  La proporzione è una scala visiva del vantaggio, separata dalle probabilità Maia e W/D/L.
- **Analisi** sotto la scacchiera: candidate e risposte in schede compatte, con fonti
  **Maia · umana** e **Stockfish · tattica**. Il pannello mantiene un'altezza compatta e stabile durante il ricalcolo
  e si riduce con il tab o la freccia a destra. La barra destra apre indipendentemente il **Coach**.
- La scacchiera conserva posizione e dimensioni mentre l'analisi viene aggiornata. Risultati,
  indicatore di caricamento e note scorrono all'interno del pannello, senza ridimensionare il gioco.
- Trascina col **tasto destro** tra due caselle per disegnare una freccia arancione; un click destro
  disegna un cerchio. Ripeti per togliere una singola annotazione. Click sinistro o **Esc** le cancella.
  Le annotazioni si salvano per posizione e tornano visibili esplorando lo storico.
- Attiva **Frecce suggerite** nel pannello o nelle impostazioni per mostrare le tre candidate della
  fonte selezionata. I numeri corrispondono alle schede; la candidata selezionata è più evidente.
  La preferenza resta salvata nel profilo locale dell'app.
- Maia-3 è l'avversario predefinito in modalità Computer; puoi scegliere anche Stockfish.
- Il profilo umano imposta separatamente rating Bianco e Nero, con riferimento Lichess blitz.
- **Accurato · 79M** è il modello Maia predefinito; **Rapido · 5M** riduce il tempo di calcolo.
- Seleziona una candidata per evidenziarla sulla scacchiera e leggerne le risposte.
- I pannelli laterali si possono nascondere. Lo zoom nativo resta disponibile.
- In modalità Computer scegli **Bianco, Nero o Casuale**. Con il Nero, Maia/Stockfish apre la partita.
- I controlli **a destra della scacchiera**, opposti alla barra, esplorano lo storico, annullano il
  turno, ruotano il tavoliere e cambiano il colore giocato avviando una nuova partita.
- Le righe dei giocatori mostrano i **pezzi presi**, seguendo la posizione esplorata, inclusi
  en passant e pezzi promossi. La rotazione conserva il lato corretto.
- **Nuova partita** conserva quella precedente nell'archivio, insieme alla sua conversazione.

## Archivio, revisione e allenamento

Le partite si salvano automaticamente nel database SQLite del profilo desktop:
`%APPDATA%\Yomi Sensei\yomi.sqlite3` su Windows. Sorgenti e pacchetto usano lo stesso profilo.
L'archivio permette di cercare per titolo, filtrare partite in corso/concluse e rinominarle.
**Importa** accetta PGN (fino a 20 partite/250 KB, con varianti, commenti e frecce) o una FEN
validata. Il pulsante **PGN** esporta la partita corrente con annotazioni e varianti.

Seleziona una mossa nel Registro o usa le frecce a destra per entrare in **Studio**.
La navigazione conserva la linea originale; **Prova variante** crea una linea separata,
con mosse, commenti e frecce salvati. **Torna alla partita** riprende una partita in corso.
All'avvio viene riaperta l'ultima partita in studio, con orologio in pausa e senza mosse automatiche.
Una partita conclusa conserva la sua linea originale; puoi sempre esplorarla e aggiungere varianti.

Quando una partita termina, il tab **Revisione** prepara in background valutazioni Stockfish,
grafico, classificazioni e momenti critici; Maia confronta le scelte umane nei momenti selezionati.
Il coach autenticato produce **una sola spiegazione**, conservata insieme al report.
Riapertura, navigazione e chat riutilizzano il report. Le domande successive si fanno nel **Coach**,
che riceve anche la revisione salvata. Senza login, il report motore funziona comunque e puoi
generare la spiegazione più tardi con il pulsante dedicato. Un tentativo coach fallito/interrotto
non viene ripetuto, perché l'esito di una chiamata account può essere incerto. Un'analisi motore
interrotta può riprendere esplicitamente dalle posizioni già salvate.

Il tab **Allenamento** raccoglie esercizi dagli errori della revisione: prova una mossa sulla
scacchiera, chiedi fino a tre suggerimenti progressivi e ripassa le posizioni secondo la scadenza.
Tentativi, soluzioni e progressi restano salvati; risolvere un esercizio non chiama il coach.

Puoi impostare **tempo e incremento** prima della tua prima mossa. L'orologio si ferma nello
studio e alla chiusura; **Torna alla partita** lo riavvia. **Allenamento senza aiuti** nasconde
valutazione, candidate, frecce suggerite e giudizi fino alla richiesta degli aiuti.
**Concludi partita** permette abbandono o patta concordata; la scadenza del tempo salva il risultato.
Il **popup di scacco matto** mostra il vincitore e permette revisione o nuova partita;
esplorare un vecchio matto non riapre il popup.

Il giudizio delle mosse lavora in background mentre Maia risponde. L'analisi mostra prima
una valutazione Stockfish rapida, poi approfondimento e probabilità Maia; cache e protezioni
di posizione impediscono che risposte vecchie sovrascrivano lo stato corrente.

| Scorciatoia | Azione |
| --- | --- |
| Ctrl+N | Nuova partita |
| Ctrl+Z | Annulla mossa |
| Ctrl+B | Mostra/nasconde pannello partita |
| Ctrl+Alt+B | Mostra/nasconde coach |
| Ctrl+F | Ruota scacchiera |
| Ctrl+Shift+R | Ricalcola analisi |
| Ctrl+, | Impostazioni e servizi locali |
| Esc | Cancella annotazioni / chiude dialoghi |

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
`release/0.5.3/win-unpacked/`. Il worker è una cartella onedir distinta dal backend
leggero. La build conserva i sorgenti e le licenze dei motori e dei pezzi SVG.
Le build precedenti possono restare in `release/0.5.2/`, `release/0.5.1/`, `release/maia/` e `release/win-unpacked`;
`Start.cmd` preferisce la versione 0.6.0. Un'app già aperta va chiusa e riavviata per vedere gli aggiornamenti.
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
- `app/library.py`: SQLite, storico ricostruito, PGN, annotazioni, revisioni e progressi.
- `app/reviews.py`: analisi finale persistente e chiamata coach unica per partita.
- `vendor/maia3/`: codice ufficiale fissato, provenienza e licenza.
- `public/pieces/cburnett/`: dodici pezzi SVG di Colin M. L. Burnett, licenza GPLv2+ e provenienza.

Il renderer usa un bridge IPC con elenco chiuso di endpoint. Il backend ascolta su
`127.0.0.1` e porta assegnata dal sistema, con token effimero mantenuto nel processo
principale. La chiusura dell'app chiude backend, Stockfish e worker Maia posseduti.
Prima di chiudere viene completato il salvataggio; un errore conserva la finestra e permette
di ritentare. Una sola istanza usa lo stesso profilo. I report conclusi non vengono rigenerati.
Le richieste contengono FEN iniziale e storico UCI validato; il Board conserva lo
stack per le ripetizioni e il contesto Maia. L'LLM lavora
con `codex exec --ephemeral`, sandbox read-only e prompt contestuale.

## Verifiche

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest -q tests
pnpm check
pnpm format:check
pnpm smoke:desktop
pnpm smoke:library
node scripts/smoke-close.mjs
```

`pnpm smoke:board` esegue le verifiche di scacchiera/workspace con Maia 79M e Stockfish reali,
senza ripetere l'intera suite delle mosse speciali e dei profili. Anche questa suite non usa account.
`YOMI_SMOKE_ARTIFACT_DIR` sceglie la cartella dei rapporti, ad esempio `artifacts/source` o `artifacts/packaged`.
`pnpm smoke:library` verifica archivio/PGN/FEN, note/varianti/frecce dopo riavvio reale, catture,
popup matto, riuso del report, esercizi/progressi, colori, orologi e allenamento. Usa un profilo isolato.
La suite Python prova concorrenza, interruzioni e unicità della chiamata coach con un agent finto.
`constraints-python.txt` e `constraints-maia.txt` fissano le dipendenze dirette e transitive
verificate su Windows/Python 3.12; `scripts/lock-python.py` le rigenera dagli ambienti preparati.
La CI Windows esegue installazione vincolata, formattazione, tipi, test frontend/backend e build.

Lo smoke usa un profilo desktop isolato, Maia 5M/79M e Stockfish reali, con il CLI Codex
esplicitamente non disponibile. Verifica mosse normali/speciali, trascinamento,
annullamento, ripetizioni, avversari, rating, pannelli e chat senza account.
Verifica anche annotazioni col mouse, rotazione, frecce suggerite, preferenza persistente,
dimensionamento del dock e asset SVG locali. La barra è verificata con Stockfish reale:
prospettiva Bianco/Nero, rotazione, indipendenza dalla fonte/candidata, caricamento e matto.
Il rapporto include i rettangoli campionati durante il caricamento: posizione e dimensioni
della scacchiera e della barra devono restare invariati entro 0,5 px, in modalità Libera e Computer.
Non consuma chiamate al coach. Per provare il pacchetto invece dei sorgenti:

```powershell
$env:YOMI_TEST_EXECUTABLE = (Resolve-Path 'release\0.6.0\win-unpacked\Yomi Sensei.exe').Path
pnpm smoke:desktop
```

Screenshot e rapporto sono in `artifacts/` (non tracciato). I test del controller
simulano anche risposte tardive, errori del computer e reset della conversazione.

`python scripts/benchmark_maia.py` (con l'interprete `.venv`) misura inferenza reale
e salva `artifacts/maia-benchmark.json`. Sulle 11 posizioni verificate su questa
macchina, mediana a caldo CPU: circa 34 ms (5M), 193 ms (79M). Sono misure del worker,
non il tempo totale che comprende Stockfish e il rendering.

## Memoria e lavoro residuo

Leggi [Kiroku](kiroku/START_HERE.md), il [track archivio/allenamento](kiroku/tracks/personal-training/START_HERE.md), il [track scacchiera](kiroku/tracks/board-workspace/START_HERE.md)
e il [track Maia](kiroku/tracks/maia-integration/START_HERE.md).
Gli issue dell'analisi restano identificati nel [backlog](kiroku/WORK.md).
YS-01 è corretto tramite lo storico completo: triplice/quintupla ripetizione sono
rilevate. La partita termina automaticamente quando la patta per triplice ripetizione
è reclamabile. Le chiamate legacy con la sola FEN restano compatibili ma non possono
ricostruire le ripetizioni. `tools/` è materiale locale preesistente estraneo all'app.
