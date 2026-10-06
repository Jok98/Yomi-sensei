# Roadmap

## Milestones

### M-01: Runtime desktop e contratti tipizzati

Status: completed
Objective: Avviare Yomi come desktop con backend gestito.
Scope: Electron, preload IPC ristretto, backend Python, Vite/TypeScript.
Expected artifacts: package.json, src/desktop, src/shared, scripts, app/desktop.py.
Dependencies: Backend esistente e riferimento ComprehensionIDE.
Validation: Typecheck, test contratti/processi, avvio e arresto backend.
Completion criteria: App e backend comunicano in locale e chiudono i processi posseduti.
Risks: Percorsi runtime Windows, disponibilità Stockfish e Codex.

### M-02: Workspace scacchistico React

Status: completed
Objective: Migrare le funzioni alla shell compatta.
Scope: Scacchiera, mosse speciali, storico, analisi, modalità computer, coach e pannelli.
Expected artifacts: src/renderer, controller tipizzato, test YS-02/03/04.
Dependencies: M-01.
Validation: Test controller, build, smoke UI con Stockfish reale in profilo desktop isolato.
Completion criteria: Funzioni accessibili e tre difetti frontend non più riproducibili.
Risks: Risposte obsolete, annullamento, trascinamento, layout compatto.

### M-03: Avvio e consegna senza Docker

Status: completed
Objective: Fornire avvio desktop concreto e documentato.
Scope: Launcher, distribuzione locale, rimozione Docker/legacy, memoria e controlli.
Expected artifacts: Start.cmd, README, build desktop, evidenze smoke e Kiroku.
Dependencies: M-01, M-02.
Validation: Test Python/frontend, typecheck, build, smoke desktop sorgenti e pacchetto, Kiroku strict.
Completion criteria: Il desktop si avvia senza Docker e i limiti delle verifiche sono espliciti.
Risks: Smoke automatico con Stockfish reale non prova account Codex o piattaforme diverse da Windows.
