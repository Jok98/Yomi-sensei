# Roadmap

## Milestones

### M-01: Storico completo e ripetizioni

Status: completed
Objective: Ricostruire il Board con storico UCI e chiudere YS-01.
Scope: Contratti Python/TypeScript, mosse, analisi, chat, annullamento e validazione.
Expected artifacts: app/models.py, app/chess_service.py, controller e test.
Dependencies: Backend e desktop esistenti.
Validation: Test triplice/quintupla ripetizione, storico illecito/incoerente, trasmissione e undo.
Completion criteria: Lo stack raggiunge servizi e motori; le ripetizioni sono rilevate.
Risks: FEN senza storico resta compatibile ma non può ricostruire ripetizioni.

### M-02: Maia locale e workspace umano

Status: completed
Objective: Giocare contro Maia e confrontare scelte umane e qualità Stockfish.
Scope: Worker separato, modelli 5M/79M, rating, probabilità, interfaccia e contesto coach.
Expected artifacts: maia_service.py, maia_worker.py, setup-maia, UI e test.
Dependencies: M-01 e pesi ufficiali locali.
Validation: Test routing/errori, benchmark CPU reale, typecheck e smoke Electron.
Completion criteria: Maia è predefinito, mosse legali campionate, metriche distinte e nessuna risposta obsoleta.
Risks: Caricamento modello, semantica W/D/L, dipendenze PyTorch e cambio rating sulla stessa FEN.

### M-03: Distribuzione Windows verificata

Status: completed
Objective: Consegnare l'app con Maia, Stockfish e Python senza Docker.
Scope: Worker standalone, risorse/pesi/sorgenti/licenze, launcher, README e Kiroku.
Expected artifacts: release/maia/win-unpacked, build-maia, screenshot e rapporti.
Dependencies: M-01 e M-02.
Validation: Suite Python/TypeScript, formattazione, smoke sul pacchetto con motori reali, Kiroku strict.
Completion criteria: Start.cmd apre il pacchetto e il worker posseduto si chiude con l'app.
Risks: Dimensioni PyTorch, build non firmata e piattaforme diverse da Windows non verificate.
