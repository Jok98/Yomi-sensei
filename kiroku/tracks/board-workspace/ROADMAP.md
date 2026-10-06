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

### M-03: Scacchiera stabile durante il ricalcolo

Status: completed
Objective: Posizione e dimensione della scacchiera non cambiano quando si aggiorna l'analisi.
Scope: Altezza compatta stabile del dock, regressione geometrica e pacchetto Windows 0.5.2.
Expected artifacts: style.css, smoke-desktop.mjs, Start.cmd e pacchetto aggiornato.
Dependencies: M-01 e M-02 completati; segnalazione dell'utente del 2026-10-06.
Validation: Campionare i rettangoli durante caricamento, mossa, annullamento e ricalcolo in sorgenti/pacchetto.
Completion criteria: Scostamento massimo 0,5 px, caricamento realmente osservato e avvio della build corretta.
Risks: Non lasciare che errori, risultati o note modifichino l'altezza esterna del dock.

### M-04: Barra del vantaggio Stockfish

Status: completed
Objective: Mostrare a fianco della scacchiera il vantaggio Bianco/Nero e la valutazione tattica.
Scope: Barra verticale, punteggio normalizzato al Bianco, rotazione, caricamento e risultati terminali.
Expected artifacts: EvaluationBar.tsx, helper/test di valutazione, risultato posizione e pacchetto Windows.
Dependencies: M-03 completato; mantenere invariata la geometria durante il ricalcolo.
Validation: Test di prospettiva/matto/patta e smoke sorgenti/pacchetto con misure di layout.
Completion criteria: Segno corretto con Nero al tratto, valutazione indipendente dalla candidata/fonte e nessuno spostamento durante il calcolo.
Risks: Confondere probabilità Maia con vantaggio tattico, o mostrare un valore precedente senza indicare l'aggiornamento.
