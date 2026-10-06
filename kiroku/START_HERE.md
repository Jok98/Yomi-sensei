# Inizia qui

## Missione

- Costruire Yomi Sensei, una scacchiera con avversario Maia-3, analisi Stockfish e coach Codex.
- Mantenere l'esperienza locale, semplice da avviare e utile anche senza la chat.

## Stato attuale

- Il desktop Electron/React/TypeScript è pronto su Windows, senza Docker.
- Le mosse sono validate da python-chess; Maia-3 è l'avversario principale e Stockfish valuta la qualità tattica.
- La chat usa `codex exec` con il login ChatGPT locale del Codex CLI.
- Il frontend invia FEN iniziale, storico UCI e profilo umano; le analisi sono legate al contesto corrente.
- Maia 79M predefinito, 5M selezionabile; rating Bianco/Nero separati e pesi locali.
- 36 test Python e 14 TypeScript superati; smoke sorgenti e pacchetto Windows con Maia/Stockfish reali verificati.
- Issue in WORK.md: YS-01/02/03/04 corretti; consolidamento YS-05 ancora aperto.
- Track conclusi: [Maia](tracks/maia-integration/START_HERE.md), [desktop](tracks/desktop-migration/START_HERE.md).

## Prossima azione

- Avviare Start.cmd per usare il pacchetto in release/maia/win-unpacked.
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
