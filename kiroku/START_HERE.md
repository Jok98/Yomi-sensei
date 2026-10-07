# Inizia qui

## Missione

- Costruire Yomi Sensei, una scacchiera con avversario Maia-3, analisi Stockfish e coach Codex.
- Mantenere l'esperienza locale, semplice da avviare e utile anche senza la chat.

## Stato attuale

- Il desktop Electron/React/TypeScript è pronto su Windows, senza Docker.
- Le mosse sono validate da python-chess; Maia-3 è l'avversario principale e Stockfish valuta la qualità tattica.
- La chat usa `codex exec` con il login ChatGPT locale del Codex CLI.
- Maia 79M predefinito, 5M selezionabile; rating Bianco/Nero separati e pesi locali.
- 55 test Python e 34 TypeScript passati; nuovi flussi e geometria verificati nei sorgenti.
- Scacchiera classica con barra Stockfish, analisi sotto il gioco e frecce manuali/suggerite opzionali.
- Archivio SQLite, PGN/FEN, studio/varianti, revisione unica, esercizi, colori/clock e popup matto implementati.
- Track attivo: [archivio e allenamento](tracks/personal-training/START_HERE.md), con tutti i miglioramenti approvati; M-06 verifica finale.

## Prossima azione

- Completare smoke del pacchetto 0.6.0, push e CI remota; Start.cmd punta alla nuova versione.
- Il coach con account reale resta da provare nel nuovo desktop; i test non consumano chiamate modello.
- Storico persistente e analisi finale agent unica restano vincoli approvati; domande successive in chat.

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
