# Vincoli

## Vincoli attivi

### Vincolo: Credenziali Codex fuori dall'app

Stato: active

Regola:
Non inserire token Codex in JavaScript, immagini, repository o risposte HTTP. Non usare
API key per questa integrazione.

Perché:
Il browser è ispezionabile; le credenziali appartengono al CLI e al suo volume privato.

### Vincolo: Analisi deterministica separata dal linguaggio

Stato: active

Regola:
Solo `python-chess` e Stockfish decidono legalità e valutazione.

Perché:
L'LLM può allucinare mosse o stime e non deve corrompere lo stato della partita.

### Vincolo: Funzionamento degradato

Stato: active

Regola:
Scacchiera e motore devono restare utilizzabili senza Codex autenticato.

Perché:
La funzionalità locale non deve dipendere da rete, credito o disponibilità del modello.

## Fuori ambito

- Account utenti, matchmaking, cloud sync e pagamenti.
- Packaging nativo Tauri/Electron nella prima versione.
- Motore di gioco remoto o database persistente.

## Modifiche vietate

- Non presentare le percentuali W/D/L come garanzia o probabilità calibrata di correttezza.
- Non esporre il servizio su tutte le interfacce di rete per impostazione predefinita.
