# Archivio e allenamento personale

## Missione

- Salvare le partite e trasformarle in studio, revisione guidata ed esercizi personali.
- Rendere il gioco completo e reattivo, conservando scacchiera classica e geometria stabile.

## Stato attuale

- L'utente approva il 2026-10-07 i sei miglioramenti proposti e YS-05.
- Richiede storico esplorabile, una sola analisi agent della partita conclusa e chat successiva.
- Richiede indietro e rotazione/cambio colore a destra, opposti alla barra.
- Richiede pezzi catturati per lato, coerenti anche tornando nello storico.
- Richiede popup di scacco matto con vincitore e accesso alla revisione/nuova partita.
- M-01/M-05 verificate; M-06 in corso. Versione 0.6.0 con archivio, studio, revisione ed esercizi.

## Prossima azione

- Completare smoke del pacchetto 0.6.0, push e verifica CI; seguire ROADMAP.md.

## Vincoli inderogabili

- Navigazione non distruttiva; varianti e annotazioni salvate separatamente.
- Report e chiamata agent persistenti: riapertura e domande non ripetono la generazione.
- Nessuna chiamata account nei test; preservare tools/ e dati personali.
- Caricamento e nuovi pannelli non devono muovere il tavoliere.

## Leggi solo se necessario

- STATE.md per stato ed evidenze.
- ROADMAP.md e WORK.md per obiettivi e completamento.
- DECISIONS.md e RISKS.md per cache, persistenza e cicli asincroni.
- ARCHITECTURE.md e CONSTRAINTS.md globali per i confini dei motori.
