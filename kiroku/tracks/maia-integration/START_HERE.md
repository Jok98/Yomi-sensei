# Integrare Maia-3

## Missione

- Usare Maia-3 come avversario principale e mostrare le scelte umane probabili.
- Affiancare Stockfish per qualità tattica e Codex per spiegazioni, senza Docker.

## Stato attuale

- L'utente ha autorizzato la proposta con «procedi» il 2026-10-06.
- Pesi ufficiali 5M/79M scaricati con checksum; entrambi caricano su CPU.
- Runtime PyTorch isolato e worker JSON; contratti storico/rating implementati.
- M-01 completata: passano 36 test Python e 14 TypeScript, typecheck e build.
- M-02 completata: smoke desktop con Maia/Stockfish reali e cambio rating/modello superato.
- M-03 completata: pacchetto in release/maia/win-unpacked verificato con motori reali.
- Track concluso: worker, pesi, sorgenti e licenze inclusi; nessuna chiamata account.

## Prossima azione

- Avviare Start.cmd; il coach con account reale e CUDA restano verifiche separate.

## Vincoli inderogabili

- Legalità da python-chess, valutazioni tattiche da Stockfish.
- Probabilità della mossa umana, W/D/L Maia ed esito Stockfish restano distinti.
- Campionare le mosse Maia senza filtrare gli errori con Stockfish.
- Pesi già locali durante le partite; nessuna chiamata account nei test.
- Preservare lavoro locale, tools/ e ComprehensionIDE.

## Leggi solo se necessario

- ROADMAP.md, STATE.md e WORK.md per avanzamento e verifica.
- DECISIONS.md e RISKS.md per runtime, metriche e distribuzione.
