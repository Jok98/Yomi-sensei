# Roadmap

## Milestone

### M-01: Scacchiera classica e analisi sotto il gioco

Status: completed
Objective: Pezzi nitidi, colori classici, analisi leggibile e compatta, annotazioni intuitive.
Scope: SVG locali con licenza, layout, tasto destro, suggerimenti e preferenza persistente.
Expected artifacts: Board.tsx, AnalysisPanel.tsx, App.tsx, style.css, geometria overlay e SVG.
Dependencies: Desktop e Maia pubblicati in 2bbae38.
Validation: Typecheck, test geometria, smoke Electron, schermate normali e compatte.
Completion criteria: Annotare non muove pezzi; frecce e pannello funzionano ruotati e ridimensionati.
Risks: Eventi mouse e misure del dock possono interferire con il gioco.

### M-02: Pacchetto e pubblicazione

Status: completed
Objective: Rendere disponibile il desktop aggiornato e pubblicare il codice verificato.
Scope: Build Windows, smoke del pacchetto, documentazione e push.
Expected artifacts: Pacchetto locale, report smoke e Kiroku aggiornato.
Dependencies: M-01 completato.
Validation: Smoke con Maia/Stockfish reali; git diff --check; Kiroku strict.
Completion criteria: Start.cmd apre la build aggiornata; commit presente su origin.
Risks: Il pacchetto precedente potrebbe essere aperto; usare un output distinto se necessario.
