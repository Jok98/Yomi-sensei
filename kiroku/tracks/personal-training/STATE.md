# Stato

## Stato corrente

- M-01/M-05 implementate e verificate nei sorgenti; M-06 in corso per push/CI; pacchetto Windows verificato.
- SQLite nel profilo conserva partite, chat, note, frecce, varianti, report e progressi.
- Archivio cercabile/filtrabile, PGN/FEN, studio non distruttivo e controlli a destra.
- Catture per colore dalla linea visualizzata; inclusi en passant e pezzi promossi.
- Revisione finale persistita: Stockfish, grafico, classificazioni, momenti critici e confronto Maia.
- Claim SQLite prima della sola chiamata coach autenticata; riapertura/chat non la ripetono.
- Esercizi derivati dal report, tre aiuti progressivi e ripasso con tentativi persistenti.
- Bianco/Nero/casuale, orologio/incremento, abbandono/patta/timeout, allenamento e popup matto.

## Ambito

- Tutti i sei punti approvati, YS-05 e aggiunte dell'utente inclusi.
- Nessun Docker, matchmaking, cloud o addestramento di un nuovo motore.

## Verificato

- 55 test Python e 34 TypeScript; typecheck/build/formattazione passati.
- Ambiente Python pulito con dipendenze vincolate: installazione e test passati; Maia dry-run coerente.
- Smoke sorgenti: riavvio reale con varianti/commenti/frecce, PGN, catture en passant, archivio/filtri,
  matto senza popup al riavvio, report riusato, chat senza account, esercizi/progressi, Nero, clock e aiuti.
- Smoke scacchiera sorgenti: nove sequenze, spostamento 0 px di tavoliere/barra; viewport compatta.
- Chiamata coach unica, errore/interruzione/login mancante e ripresa motore coperti con agent finto.

- Smoke pacchetto 0.6.0: archivio/studio/report/esercizi/clock/matto/FEN/promozione/catture passati; nove sequenze di geometria con variazione 0 px. Rapporti in artifacts/training-library-packaged/ e artifacts/training-board-packaged/.

## Attenzioni

- Pacchetto 0.6.0 verificato; CI remota ancora in corso; nessuna chiamata account nei test.
- Una chiamata coach fallita/interrotta resta consumata; il report motore e la chat restano disponibili.
