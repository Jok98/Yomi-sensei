# Lavoro

## In corso

- Archivio/studio/revisione unica/allenamento in corso nel [track personal-training](tracks/personal-training/START_HERE.md), inclusi UI, catture e YS-05.

## TODO

### Attività: Consolidamento e manutenzione — YS-05

Stato: todo
Completamento:
CI e dipendenze Python bloccate completano la riproducibilità delle build.
Già completati: test frontend, lockfile pnpm, README desktop e smoke automatico.
`tools/` (circa 2 GB di Magpie non tracciato) è preservato ed escluso dal pacchetto.

## Bloccato

- Nessuna attività bloccata.

## Fatto

### Attività: Barra del vantaggio Stockfish

Stato: done
Completamento:
Barra verticale dal Bianco, colori ruotabili e valutazione indipendente dalla candidata/fonte.
Matto/patta verificati nei test; aggiornamento e matto verificati nel desktop sorgenti/pacchetto.
Passano 40 test Python e 24 TypeScript; nove sequenze per smoke con spostamento 0 px di scacchiera/barra.
Versione Windows 0.5.3 avviabile da Start.cmd.

### Attività: Scacchiera instabile durante l'analisi — YS-06

Stato: done
Completamento:
Altezza del dock stabile e scroll interno. In nove sequenze sorgenti/pacchetto, posizione e
dimensioni della scacchiera restano invariati (0 px), incluso il caricamento realmente osservato.
Coperti Libera/Computer, risposta Maia, annullamento, refresh Stockfish/Maia e viewport compatta.
Versione Windows 0.5.2 avviabile da Start.cmd; nessuna chiamata account nei test.

- Scacchiera classica con SVG, dock sotto il gioco e frecce manuali/suggerite; UI 0.5.1 pubblicata in 5abb82b.
- Smoke scacchiera/workspace sorgenti e pacchetto passati con Maia 79M/Stockfish reali, senza chiamate account; 18 test TypeScript passati.

### Attività: Ripetizioni non riconosciute — YS-01

Stato: done
Completamento:
FEN iniziale e storico UCI validato ricostruiscono il Board con stack. Test triplice/quintupla,
storico illecito/incoerente e smoke desktop della triplice ripetizione superati.
Le chiamate legacy con sola FEN non possono ricostruire le ripetizioni.

### Attività: Metriche esplicite

Stato: done
Completamento:
Il flusso approvato con «procedi» mantiene tre misure distinte: probabilità della mossa
umana, W/D/L Maia e esito atteso Stockfish. Etichette e tooltip sono verificati nel desktop.

- Desktop Electron/React/TypeScript con shell ispirata a ComprehensionIDE e backend locale gestito.
- Pacchetto Windows con Python e Stockfish, avviabile da `Start.cmd` senza Docker.
- Arrocco, en passant, sottopromozione, trascinamento e annullamento verificati automaticamente nel desktop con Stockfish reale. La valutazione manuale dell'utente resta distinta.
- Maia-3 principale, analisi umana e coach con metriche distinte; modelli 5M/79M, rating separati e pacchetto Windows verificati.
- Passano 36 test Python, 14 TypeScript e smoke sorgenti/pacchetto con Maia/Stockfish reali, senza chiamate account Codex.

### Attività: Annullamento contro computer — YS-02

Stato: done
Completamento:
Il controller annulla una o due semimosse in base all'ultimo attore, tornando al
Bianco anche dopo una risposta fallita. Test di regressione in `tests/frontend/controller.test.ts`.
Difetto precedente: rimuoveva sempre due semimosse dopo `1.e4 e5 2.Bc4` senza risposta.

### Attività: Coerenza FEN e analisi nella chat — YS-03

Stato: done
Completamento:
Analisi legata a FEN, generazione partita e richiesta; risposte obsolete ignorate.
La chat invia solo candidate della propria FEN. Test con classificazione pendente,
analisi tardiva sulla stessa FEN e nuova partita durante la chat.
Difetto precedente: dopo `e4`, FEN con Nero al tratto e candidata `e2e4` potevano mescolarsi.

### Attività: Risposte avversarie nascoste — YS-04

Stato: done
Completamento:
Risposte visibili per la candidata selezionata in modalità Libera; non richieste
contro il computer. Test controller e smoke con tre risposte Stockfish visibili.
Difetto precedente: `syncGameModeUi` impostava sempre `opponentAnalysis.hidden = true`.

## Annullato

- Distribuzione Docker: sostituita dal desktop locale su richiesta del 2026-10-06.
