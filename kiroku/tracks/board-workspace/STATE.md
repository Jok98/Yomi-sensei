# Stato

## Scopo

Scacchiera classica e studio delle mosse senza sottrarre spazio al gioco.

## Stato corrente

- M-01/M-02/M-03 completati; build 0.5.2 verificata e avviabile da Start.cmd.
- YS-06 corretto: il contenuto asincrono non ridimensiona più lo spazio dedicato al dock.

## Ambito

- Incluso: SVG classici, colori, dock analisi, evidenziazione e frecce manuali/suggerite.
- Escluso: nuovi motori, persistenza della partita, chat account reale.

## Verificato

- Beige/marrone e dodici SVG CBurnett locali; il coach resta indipendente a destra.
- Dock sotto il gioco con altezza stabile per viewport, scorrimento interno e collasso a 37 px.
- Tasto destro disegna frecce/cerchi; rotazione, cancellazione e rilascio esterno verificati.
- Frecce suggerite seguono Maia/Stockfish e candidata attiva; preferenza locale persistente.
- Passano 18 test TypeScript, typecheck, build, formattazione e smoke sorgenti/pacchetto con motori reali.
- Layout: dock 176 px nella finestra normale; con coach compatto, dock 132 px e scacchiera 308 px.
- Nove sequenze campionate nei sorgenti e nel pacchetto: variazione 0 px per posizione/dimensione della scacchiera e altezza del dock; caricamento realmente osservato.
- Coperti mossa/undo Libera e Computer, risposta Maia, refresh Maia/Stockfish, note espanse e viewport compatta.
- Pacchetto verificato in release/0.5.2/win-unpacked; Start.cmd lo preferisce alle build precedenti.
- Evidenze attuali: artifacts/layout-source/desktop-smoke.json, artifacts/layout-packaged/desktop-smoke.json e schermate associate.
- CBurnett è distribuito da Lichess con licenza GPLv2+.

## Attenzioni

- Rotazione e ridimensionamento devono mantenere frecce corrette.
- Annotazioni utilizzabili anche quando non è possibile muovere.
- Click, drag e promozione non devono regredire.
