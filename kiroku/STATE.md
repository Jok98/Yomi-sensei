# Stato

## Stato corrente

- Yomi Sensei usa Electron, React e TypeScript con backend Python locale gestito.
- La shell riprende ComprehensionIDE: navigazione a sinistra, scacchiera centrale, analisi sotto e coach richiudibile a destra.
- Docker e il precedente frontend PWA sono rimossi per richiesta esplicita dell'utente.
- Lo storico partita resta volatile; FEN iniziale e mosse UCI ricostruiscono il Board con stack.
- Maia-3 è l'avversario predefinito: modelli locali 79M/5M, rating Bianco/Nero separati e mosse campionate dalla policy.
- Stockfish 19 valuta qualità tattica e candidate Maia; Codex usa il profilo autenticato del CLI della macchina.
- Build Windows 0.5.1 in release/0.5.1/win-unpacked con Python, worker PyTorch CPU, modelli e Stockfish incorporati; smoke pacchetto passato.
- Pezzi SVG CBurnett e colori classici; frecce/cerchi col tasto destro e suggerimenti opzionali con preferenza locale salvata.

## Verifiche attuali

- 36 test Python dell'integrazione, 18 TypeScript, typecheck, build, formattazione e pip check dei due runtime superati.
- Smoke scacchiera/workspace sorgenti e pacchetto passati: SVG, annotazioni, suggerimenti, layout normale/compatto e collasso.
- Smoke Electron sorgenti/pacchetto con Maia 5M/79M e Stockfish reali: mosse speciali,
  trascinamento, ripetizioni, avversari, annullamento, rating, pannelli e layout compatto.
- La chat nei test usa intenzionalmente un CLI non disponibile: nessuna chiamata account.
- Benchmark worker CPU su 11 posizioni: mediana a caldo 34 ms per 5M, 193 ms per 79M; non è latenza totale dell'app.
- Rapporti/screenshot attuali in artifacts/source/ e artifacts/packaged/; benchmark in artifacts/maia-benchmark.json.

## Lavoro aperto

- YS-01 corretto; chiamate legacy con sola FEN restano prive dello storico delle ripetizioni.
- Persistenza, import/export PGN/FEN e revisione post-partita non implementati.
- Chat reale, runtime CUDA e piattaforme diverse da Windows non validati.
- CI ancora da predisporre; dipendenze Python con intervalli di versione.
