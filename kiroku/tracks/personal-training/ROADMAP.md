# Roadmap

## Milestone

### M-01: Archivio locale e scambio partite

Status: completed
Objective: Conservare e riaprire le partite dopo la chiusura.
Scope: SQLite nel profilo, autosalvataggio, elenco/ricerca, ripresa, PGN e FEN validata.
Expected artifacts: Archivio, API e test di persistenza/PGN.
Dependencies: Desktop 0.5.3.
Validation: Database isolato, roundtrip PGN e riapertura desktop.
Completion criteria: Storico e impostazioni sopravvivono al riavvio; import illecito non corrompe l'archivio.
Risks: Salvataggi tardivi sovrascrivono snapshot più recenti.

### M-02: Studio e controlli vicino al gioco

Status: completed
Objective: Esplorare mosse e varianti mantenendo la partita originale.
Scope: Cursore storico, varianti/commenti/annotazioni, indietro/rotazione a destra e catture per colore.
Expected artifacts: Stato studio, UI archivio/registro/controlli e test catture.
Dependencies: M-01.
Validation: Navigazione non distruttiva, en passant/promozioni, rotazione e viewport compatta.
Completion criteria: Linea originale intatta, varianti salvate e catture coerenti con la posizione mostrata.
Risks: Confondere posizione visualizzata e giocabile; regressione YS-06.

### M-03: Revisione finale unica e chat

Status: completed
Objective: Processare una partita conclusa una sola volta e conservare la spiegazione agent.
Scope: Stockfish persistito, grafico/momenti critici, chiamata Codex unica, lettura cached e chat successiva.
Expected artifacts: Job idempotente, report salvato, revisione UI e contesto chat.
Dependencies: M-01/M-02.
Validation: Concorrenza, riapertura, interruzione e conteggio chiamate con agent finto.
Completion criteria: Aprire la partita o fare domande non rigenera il report; nessun retry account automatico.
Risks: Doppie chiamate agent, timeout ambiguo e varianti inventate.

### M-04: Esercizi personali

Status: completed
Objective: Riprovare gli errori delle proprie partite con progressi persistenti.
Scope: Posizioni critiche, soluzione verificata, suggerimenti progressivi, tentativi e ripasso.
Expected artifacts: Esercizi SQLite, UI allenamento e test progressi.
Dependencies: M-03.
Validation: Mosse illegali, soluzione, aiuti, ripasso e riapertura.
Completion criteria: Esercizi derivati dal report e verificati dal motore; progressi persistenti senza nuove chiamate agent.
Risks: Soluzioni rivelate automaticamente o alternative valide penalizzate.

### M-05: Partite complete

Status: completed
Objective: Giocare con entrambi i colori, controllo del tempo e aiuti su richiesta.
Scope: Bianco/Nero/casuale, clock/incremento, popup matto/conclusione, allenamento e cambio colore vicino al tavoliere.
Expected artifacts: Configurazione/clock persistenti, UI e test turni/timeout.
Dependencies: M-01/M-02.
Validation: Prima mossa computer con Nero, undo, pausa/ripresa, timeout e aiuti nascosti.
Completion criteria: Colore, tempo e risultato coerenti; lo storico non avvia mosse automatiche.
Risks: Clock e risposta concorrenti; confondere rotazione e colore giocato.

### M-06: Reattività, consolidamento e consegna

Status: completed
Objective: Rendere rapidi i turni e consegnare tutti i flussi approvati verificati.
Scope: Giudizio in background, analisi progressiva/cache, CI e lock Python (YS-05), build Windows e push.
Expected artifacts: CI, lock, test/smoke e pacchetto aggiornato.
Dependencies: M-01/M-02/M-03/M-04/M-05.
Validation: Giudizio pendente non blocca Maia; dati obsoleti ignorati; smoke sorgenti/pacchetto e Kiroku strict.
Completion criteria: Flussi locali verificati, dati persistenti e tavoliere stabile; commit remoto e Start.cmd aggiornati.
Risks: Concorrenza motori e runtime PyTorch voluminoso.
