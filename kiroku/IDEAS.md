# Idee

## Idee aperte

- Import/export PGN e modifica FEN con validazione.
- Revisione post-partita con classificazione di errori e occasioni mancate.
- Database SQLite locale per partite e conversazioni.
- Confronto A/B tra Codex e un modello generalista.

## Idee adottate

- Maia-3 come avversario principale e modello delle scelte umane, affiancato a Stockfish
  per qualità tattica e Codex per spiegazioni. L'utente approva l'implementazione il
  2026-10-06; stato e verifiche nel [track Maia](tracks/maia-integration/START_HERE.md),
  scelte correnti in DECISIONS.md e provenienza in vendor/maia3/UPSTREAM.md.
- Riferimenti: [Maia-3 ufficiale](https://github.com/CSSLab/maia3),
  [paper Chessformer](https://arxiv.org/html/2605.19091v1).

## Idee rinviate

- Wrapper Tauri: superato dalla migrazione Electron richiesta il 2026-10-06.
- Voce in tempo reale: valutarla dopo aver stabilizzato costo e qualità della chat testuale.

## Idee rifiutate

### Rifiutata: Usare l'LLM conversazionale come motore di scacchi

Motivo:
Non offre legalità o forza riproducibile e può inventare varianti.

Da ricordare:
Il coach spiega output verificato; python-chess, Stockfish e Maia hanno compiti distinti.

## Idee vietate

- Chiavi OpenAI nel client o credenziali nei pacchetti distribuiti.
- Percentuali senza etichetta e definizione visibile.
