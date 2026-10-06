# Stato

## Scopo

Scacchiera classica e studio delle mosse senza sottrarre spazio al gioco.

## Stato corrente

- M-01/M-02/M-03/M-04 completati; build 0.5.3 verificata e avviabile da Start.cmd.
- YS-06 corretto: il contenuto asincrono non ridimensiona più lo spazio dedicato al dock.

## Ambito

- Incluso: SVG classici, colori, dock analisi, frecce manuali/suggerite e barra Stockfish.
- Escluso: nuovi motori, persistenza della partita, chat account reale.

## Verificato

- Beige/marrone e dodici SVG CBurnett locali; il coach resta indipendente a destra.
- Dock sotto il gioco con altezza stabile per viewport, scorrimento interno e collasso a 37 px.
- Tasto destro disegna frecce/cerchi; rotazione, cancellazione e rilascio esterno verificati.
- Frecce suggerite seguono Maia/Stockfish e candidata attiva; preferenza locale persistente.
- Barra allineata a sinistra, punteggio dal Bianco e colori orientati al tavoliere; fonte/candidata non modificano il vantaggio. Aggiornamento esplicito, dato assente `—`, matto `M` e patta `½`.
- Passano 24 test TypeScript e 40 Python, typecheck, build, formattazione e smoke sorgenti/pacchetto con motori reali.
- Test coprono prospettiva, matto/patta, dati mancanti/obsoleti e separazione da Maia/WDL; il desktop verifica segno, rotazione, indipendenza dei suggerimenti e matto finale.
- Layout: dock 176 px nella finestra normale; con coach compatto, dock 132 px e scacchiera 308 px.
- Nove sequenze campionate in ciascuno smoke: variazione 0 px per posizione/dimensione di scacchiera/barra e altezza del dock; caricamento di analisi/barra realmente osservato.
- Coperti mossa/undo Libera e Computer, risposta Maia, refresh Maia/Stockfish, note espanse e viewport compatta.
- Pacchetto verificato in release/0.5.3/win-unpacked; Start.cmd lo preferisce alle build precedenti.
- Evidenze attuali: artifacts/evaluation-source/desktop-smoke.json, artifacts/evaluation-packaged/desktop-smoke.json e schermate associate.
- CBurnett è distribuito da Lichess con licenza GPLv2+.

## Attenzioni

- Rotazione e ridimensionamento devono mantenere frecce corrette.
- Annotazioni utilizzabili anche quando non è possibile muovere.
- Click, drag e promozione non devono regredire.
