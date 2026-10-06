# Architettura

## Flussi principali

- Electron ospita React/TypeScript; `preload.ts` espone solo richieste API consentite e comandi menu.
- `Backend` avvia Python in sviluppo o `yomi-backend.exe` nel pacchetto.
- Python apre un socket su loopback con porta effimera e annuncia la porta su stdout.
- Il main Electron conserva il token effimero e lo allega alle richieste; il renderer non riceve URL o credenziali.
- Le richieste includono FEN iniziale e storico UCI; python-chess ricostruisce il Board con stack e verifica la FEN corrente.
- Maia-3 campiona le risposte del computer e produce probabilità umane in un worker JSON separato.
- Stockfish valuta candidate tattiche e candidate Maia anche fuori dalle sue prime tre scelte.
- Il coach invoca Codex CLI locale con FEN, SAN e sole analisi tattiche/umane corrispondenti al contesto.

## Confini

- `src/desktop/`: ciclo di vita, IPC ristretto e menu nativo.
- `src/shared/`: contratti e operazioni pure su storico/orientamento.
- `src/renderer/controller.ts`: store unico, mosse atomiche, generazioni di partita e analisi.
- `src/renderer/components/`: scacchiera, controlli/storico, analisi, coach.
- `src/shared/board-geometry.ts`: coordinate e geometria SVG indipendenti da dimensioni e orientamento.
- `public/pieces/cburnett/`: SVG classici, provenienza e licenza, copiati da Vite nel renderer.
- `app/chess_service.py`: legalità, stato derivato, processo UCI.
- `app/maia_service.py`: worker posseduto, cache per storico/modello/rating, analisi e mosse Maia.
- `app/maia_worker.py`: inferenza PyTorch e policy legale del codice upstream fissato in `vendor/maia3`.
- `app/llm_service.py`: prompt e processo Codex; credenziali solo nel profilo CLI.
- `app/desktop.py`: avvio locale e arresto alla chiusura dello stdin del processo padre.

## Pattern da preservare

- FEN, storico, generazione, modello e rating invalidano le analisi prima di una modifica del contesto.
- L'annullamento considera chi ha giocato l'ultima semimossa.
- Le risposte Codex appartengono alla posizione inviata; una nuova partita azzera la conversazione.
- Shell neutra compatta ispirata a ComprehensionIDE; zoom nativo preservato.
- Analisi in dock compatto sotto la scacchiera; coach laterale indipendente. Annotazioni non entrano nel controller o nel backend.
- Solo la preferenza frecce suggerite persiste in localStorage; le annotazioni appartengono alla posizione corrente.
- Backend stateless rispetto alla partita: lo storico UCI completo permette di rilevare ripetizioni (YS-01 corretto).
- Probabilità di scelta umana, W/D/L Maia e qualità tattica Stockfish restano campi distinti.

## Distribuzione

- Vite compila il renderer; esbuild compila main/preload Electron.
- PyInstaller incorpora backend e worker Maia onedir; electron-builder include Stockfish, Maia e pesi locali in `release/0.5.1/win-unpacked`.
- `.runtime/`, `dist/`, `release/` e `artifacts/` sono output ignorati.
- Docker e il precedente frontend PWA sono rimossi per richiesta dell'utente.
