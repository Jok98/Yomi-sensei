# Rischi

- Packaging PyTorch aumenta spazio e tempi di build: worker onedir separato dal backend.
- Rating condiziona il modello; non garantisce pari forza o rating su altre piattaforme.
- Pesi derivano da gioco umano Lichess blitz: non rappresentano ogni cadenza o individuo.
- W/D/L Maia non va convertito con il modello Stockfish; probabilità della mossa resta un campo separato.
- Cache deve includere storico, modello e rating, anche con FEN uguale.
- Maia-3 è AGPLv3: conservare codice upstream, adattatore e licenze nel pacchetto.
- Verifiche con motori reali, nessuna chiamata account Codex. GPU e Linux/macOS fuori dalla verifica Windows.
