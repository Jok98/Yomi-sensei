# Decisioni

## Decisioni attive

### Decisione: Desktop Electron/React senza Docker

Stato: active
Area: distribuzione
Decisione: Usare Electron, React, TypeScript e Vite, ispirandosi a ComprehensionIDE.
Motivazione: Richiesta esplicita dell'utente del 2026-10-06; avvio diretto locale e shell compatta.
Conseguenze:
- Python e Stockfish restano servizi locali posseduti dal desktop.
- La build Windows incorpora il runtime Python; il CLI Codex resta esterno e autenticato dall'utente.
- Il riferimento ComprehensionIDE resta indipendente e in sola lettura.
- Docker e PWA non sono più i percorsi di distribuzione.

### Decisione: Maia-3 avversario principale, Stockfish valutatore

Stato: active
Area: analisi
Decisione: Maia-3 campiona le mosse dell'avversario e stima scelte umane; python-chess determina legalità, Stockfish qualità tattica e Codex spiega il confronto.
Motivazione: L'utente approva il 2026-10-06 un motore umano prioritario, affiancato a Stockfish.
Conseguenze: Probabilità della mossa umana e W/D/L Maia sono separati dall'esito atteso Stockfish W + 0,5 × D. Storico, modello e rating identificano il contesto delle analisi.

### Decisione: Runtime Maia separato e locale

Stato: active
Area: inferenza
Decisione: Worker JSON isolato con PyTorch CPU e modelli ufficiali fissati 5M/79M; 79M predefinito e 5M selezionabile.
Motivazione: Il benchmark locale rende 79M utilizzabile anche su CPU, mantenendo il backend leggero e il pacchetto indipendente dalla GPU.
Conseguenze: Nessun download durante le partite, pesi verificati con checksum e codice/licenza upstream conservati. Dettagli nel track maia-integration.

### Decisione: Codex CLI con login ChatGPT

Stato: active
Area: LLM
Decisione: Invocazioni `codex exec` effimere, sandbox read-only, modello opzionale e login locale.
Motivazione: Conservare l'integrazione richiesta senza API key o un loop modello alternativo.
Conseguenze: Credenziali fuori da renderer e pacchetti; latenza del processo per messaggio ancora da misurare nel desktop.

### Decisione: Scacchiera classica e analisi sotto il gioco

Stato: active
Area: interfaccia
Decisione: Colori beige/marrone e SVG CBurnett, dock analisi con spazio compatto stabile sotto la scacchiera, coach indipendente a destra.
Motivazione: Preferenze e correzione YS-06 richieste dall'utente del 2026-10-06; il ricalcolo non deve muovere o ridimensionare la scacchiera.
Conseguenze: Annotazioni col tasto destro non modificano la partita; frecce dei suggerimenti opzionali con preferenza locale salvata. Attribuzione e GPLv2+ dei pezzi incluse.

### Decisione: Barra del vantaggio dal Bianco

Stato: active
Area: valutazione
Decisione: Barra verticale Stockfish dal lato Bianco, con colori orientati alla scacchiera e scala visiva in pedoni, distinta da probabilità Maia/WDL.
Motivazione: Richiesta dell'utente del 2026-10-06 di una barra come chess.com; il cambio di fonte o candidata non deve alterare il vantaggio della posizione.
Conseguenze: Matto/patta derivano dal risultato python-chess; FEN e turno devono corrispondere all'analisi. Valore precedente attenuato e puntini durante il calcolo, dato assente esplicito; la geometria esterna resta stabile.

### Decisione: Archivio locale e revisione unica

Stato: active
Area: studio e persistenza
Decisione: SQLite nel profilo desktop salva partita/chat/varianti, report finale e progressi degli esercizi; claim persistente prima della sola chiamata coach autenticata.
Motivazione: Sei miglioramenti e vincoli dell'utente approvati il 2026-10-07.
Conseguenze: Navigazione non distruttiva, linea conclusa immutabile, grafico/classificazioni riusati; domande successive in chat. Motore interrotto riprendibile esplicitamente; tentativo coach fallito non ripetuto.

## Decisioni sostituite

- PWA in un container Docker: sostituita dal desktop il 2026-10-06.
- Responses API con OPENAI_API_KEY: sostituita dal CLI autenticato nel primo MVP.
