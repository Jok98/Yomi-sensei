# Stato

## Scopo

Scacchiera classica e studio delle mosse senza sottrarre spazio al gioco.

## Stato corrente

- M-01 e M-02 completati; versione 0.5.1 pubblicata in 5abb82b su origin/codex/initial-yomi-sensei.
- Push precedente riuscito: 2bbae38 su origin/codex/initial-yomi-sensei.

## Ambito

- Incluso: SVG classici, colori, dock analisi, evidenziazione e frecce manuali/suggerite.
- Escluso: nuovi motori, persistenza della partita, chat account reale.

## Verificato

- Beige/marrone e dodici SVG CBurnett locali; il coach resta indipendente a destra.
- Dock sotto il gioco con altezza automatica, limite, scorrimento e collasso a 36 px.
- Tasto destro disegna frecce/cerchi; rotazione, cancellazione e rilascio esterno verificati.
- Frecce suggerite seguono Maia/Stockfish e candidata attiva; preferenza locale persistente.
- Passano 18 test TypeScript, typecheck, build, formattazione e smoke sorgenti/pacchetto con motori reali.
- Layout sorgenti: dock 172 px su viewport 895 px; con coach compatto, dock 132 px e scacchiera 308 px.
- Pacchetto verificato in release/0.5.1/win-unpacked; Start.cmd lo preferisce alle build precedenti.
- Evidenze: artifacts/source/desktop-smoke.json, artifacts/packaged/desktop-smoke.json e schermate associate.
- CBurnett è distribuito da Lichess con licenza GPLv2+.

## Attenzioni

- Rotazione e ridimensionamento devono mantenere frecce corrette.
- Annotazioni utilizzabili anche quando non è possibile muovere.
- Click, drag e promozione non devono regredire.
