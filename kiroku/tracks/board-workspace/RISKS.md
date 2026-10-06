# Rischi

## Rischi aperti

- Nessun rischio tecnico aperto per questa consegna; restano i limiti globali del progetto.

## Rischi chiusi

### Rischio: Geometria e mouse

Condition: Rotazione, zoom o cattura del puntatore possono alterare annotazioni e drag.
Impact: Frecce su caselle errate o mosse involontarie.
Mitigation: Coordinate sul rettangolo reale; test nei due versi e mosse speciali nel desktop.
Esito: Smoke sorgenti/pacchetto passati; annotazioni anche a partita conclusa verificate nello smoke desktop.

### Rischio: Pannello troppo alto

Condition: Tre candidate, risposte e spiegazioni occupano spazio in finestre compatte.
Impact: Scacchiera troppo piccola.
Mitigation: Due colonne, note richiudibili, altezza limitata e collasso; QA a 1440x960 e 900x700.
Esito: Schede affiancate, dock 176 px nella finestra normale e 132 px nella compatta; toolbar resta a 36 px col coach aperto.

### Rischio: Movimento durante il ricalcolo — YS-06

Condition: Risultati e indicatore di caricamento modificano l'altezza del dock.
Impact: Scacchiera che salta o si ridimensiona dopo le mosse; l'utente segnala nausea.
Mitigation: Altezza stabile per viewport, flex senza shrink e scroll confinato all'interno.
Esito: Nove sequenze sorgenti/pacchetto con caricamento osservato, variazione massima 0 px.

## Rischi accettati

- Annotazioni non salvate tra partite; solo la preferenza frecce suggerite persiste localmente.
