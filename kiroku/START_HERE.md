# Inizia qui

## Missione

- Costruire Yomi Sensei, una scacchiera con avversario Maia-3, analisi Stockfish e coach Codex.
- Mantenere l'esperienza locale, semplice da avviare e utile anche senza la chat.

## Stato attuale

- Il desktop Electron/React/TypeScript è pronto su Windows, senza Docker.
- Le mosse sono validate da python-chess; Maia-3 è l'avversario principale e Stockfish valuta la qualità tattica.
- La chat usa `codex exec` con il login ChatGPT locale del Codex CLI.
- Maia 79M predefinito, 5M selezionabile; rating Bianco/Nero separati e pesi locali.
- 36 test Python dell'integrazione e 18 TypeScript superati; smoke scacchiera/workspace sorgenti e pacchetto passati.
- Scacchiera beige/marrone con SVG classici; analisi sotto il gioco, frecce col destro e suggerimenti opzionali.
- Issue in WORK.md: YS-01/02/03/04 corretti; consolidamento YS-05 ancora aperto.
- Track corrente: [scacchiera](tracks/board-workspace/START_HERE.md), 0.5.1 pronta alla pubblicazione; Maia e desktop conclusi.

## Prossima azione

- Pubblicare la versione 0.5.1; Start.cmd apre il pacchetto verificato in release/0.5.1/win-unpacked.
- Il coach con account reale resta da provare nel nuovo desktop; i test non consumano chiamate modello.
- Per il lavoro successivo, partire dal consolidamento residuo in WORK.md.

## Vincoli inderogabili

- Maia stima le scelte umane, Stockfish la qualità tattica; il coach spiega e non modifica la partita.
- Accesso coach con login ChatGPT del Codex CLI, senza API key; credenziali solo nel profilo locale.
- Probabilità della mossa umana, W/D/L Maia ed esito atteso Stockfish sono metriche distinte.
- Non usare Docker; ComprehensionIDE è un riferimento in sola lettura.
- La scacchiera deve restare utilizzabile quando Codex non è autenticato.

## Leggi solo se necessario

- `STATE.md` per fatti verificati e domande aperte.
- `ARCHITECTURE.md` prima di cambiare flussi o confini.
- `DECISIONS.md` e `CONSTRAINTS.md` prima di cambiare direzione.
- `WORK.md` per attività e condizioni di completamento.
- `RISKS.md` per limiti tecnici e di prodotto.
- `IDEAS.md` per estensioni non ancora adottate.
