# Stato

- Ambito: storico completo con YS-01, Maia locale, avversario, analisi umana, coach e pacchetto Windows.
- Fuori ambito: addestramento personale, account remoti, matchmaking e CI generale.
- Maia upstream fissato al commit 1e13597c42d4858b7cfd7cfdae01e297263364b2.
- Runtime .venv-maia: PyTorch 2.8.0 CPU; pesi 5M e 79M verificati.
- Verifica diretta: entrambi producono e4/d4/c4 con probabilità e W/D/L distinti.
- M-01 completata: storico e ripetizioni verificati; 36 test Python e 14 TypeScript passano.
- M-02 completata: typecheck/build/formattazione e smoke desktop sorgenti passano; inferenza reale CPU mediana 34 ms (5M) e 193 ms (79M), 11 posizioni.
- M-03 completata: worker standalone, pesi e pacchetto completo verificati con smoke nativo e nessun errore renderer.
- La build precedente è in uso; il nuovo pacchetto usa release/maia/win-unpacked e Start.cmd lo preferisce.
- GPU non verificata; il runtime distribuito usa CPU, con selezione 5M/79M.
- Runtime distribuito CPU, circa 1,27 GB per tutto il pacchetto. Tutte le milestone concluse.
