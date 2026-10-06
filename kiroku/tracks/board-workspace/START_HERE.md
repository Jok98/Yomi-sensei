# Scacchiera e analisi

## Missione

- Raffinare la scacchiera con colori e pezzi classici, annotazioni e analisi compatta sotto il gioco.

## Stato attuale

- Migrazione desktop e Maia pubblicate nel commit 2bbae38 sul branch codex/initial-yomi-sensei.
- Richiesta del 2026-10-06: SVG, beige/marrone, analisi sotto il gioco e frecce manuali/suggerite.
- M-01 completato: scacchiera classica, dock compatto, annotazioni e frecce suggerite opzionali.
- M-02 completato: pacchetto 0.5.1 verificato, codice pubblicato in 5abb82b su origin/codex/initial-yomi-sensei.
- M-03 completato: YS-06 corretto nella build 0.5.2; scacchiera ferma durante il ricalcolo.

## Prossima azione

- Aprire Start.cmd per usare la versione 0.5.2; track concluso.

## Vincoli inderogabili

- Annotare non deve eseguire mosse o modificare il contesto dei motori.
- Frecce suggerite opzionali, legate alla fonte e alla posizione corrente.
- Nessun Docker, nessuna chiamata account nei test; conservare tools/ estraneo al lavoro.

## Leggi solo se necessario

- STATE.md per fatti verificati e limiti.
- ROADMAP.md e WORK.md per completamento e verifiche.
- DECISIONS.md per preferenze e licenza dei pezzi.
- RISKS.md per geometria, ridimensionamento e trascinamento.
