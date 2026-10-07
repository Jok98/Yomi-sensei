# Stato

## Stato corrente

- Yomi Sensei 0.6.0: Electron/React/TypeScript, backend Python gestito, senza Docker.
- Maia-3 locale 79M/5M avversario principale; Stockfish 19 valuta qualità e Codex CLI spiega.
- SQLite nel profilo conserva partite, conversazioni, varianti, note/frecce, report e progressi.
- Archivio cercabile/filtrabile con PGN/FEN; studio non distruttivo e linee concluse immutabili.
- Revisione finale in background salvata; una sola chiamata coach autenticata per partita.
- Esercizi dagli errori con aiuti progressivi, tentativi persistenti e ripasso.
- Bianco/Nero/casuale, orologi/incremento, conclusione, allenamento senza aiuti e popup matto.
- Tavoliere classico con catture per colore, controlli a destra opposti alla barra Stockfish.
- Giudizi in background, analisi progressiva/cache e geometria del tavoliere stabile (YS-06).
- CI Windows e dipendenze Python dirette/transitive vincolate; YS-05 in verifica finale.
- Track attivo personal-training: M-01/M-05 verificate, M-06 push/CI in corso; pacchetto Windows verificato.

## Verifiche attuali

- 55 test Python, 34 TypeScript, typecheck/build/formattazione passati.
- Ambiente Python pulito: installazione vincolata e suite passate; Maia dry-run coerente.
- Smoke archivio sorgenti con motori reali: PGN, catture, varianti/commenti/frecce al riavvio,
  popup matto, riuso report, chat senza account, esercizi/progressi, Nero, clock e aiuti.
- Nove sequenze scacchiera sorgenti: variazione 0 px di posizione/dimensioni tavoliere e barra.
- Test coach finto: unicità, concorrenza, errore/interruzione, login assente e ripresa motore.
- Artefatti in artifacts/training-library-source/ e artifacts/training-board-source/.

- Smoke pacchetto 0.6.0: archivio/studio/report/esercizi/clock/matto/FEN/promozione/catture passati; nove sequenze di geometria con variazione 0 px. Rapporti in artifacts/training-library-packaged/ e artifacts/training-board-packaged/.

## Lavoro aperto

- Completare push e CI remota; pacchetto 0.6.0 verificato.
- Coach con account reale, CUDA e piattaforme diverse da Windows non validati.
- Chiamate legacy con sola FEN restano prive dello storico delle ripetizioni (YS-01).
