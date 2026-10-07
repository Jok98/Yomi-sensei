# Vincoli

## Vincoli attivi

### Vincolo: Nessun Docker

Stato: active
Regola: Avviare l'app dal desktop locale; ComprehensionIDE è solo un riferimento.
Perché: Richiesta esplicita dell'utente; il repository di riferimento contiene lavoro indipendente.

### Vincolo: Credenziali fuori dall'app

Stato: active
Regola: Usare il login locale Codex; non inserire token/API key in renderer, repository o pacchetti.
Perché: L'autenticazione appartiene al CLI e deve restare separata dal frontend.

### Vincolo: Regole e valutazioni deterministiche

Stato: active
Regola: Legalità affidata a python-chess, qualità tattica a Stockfish e mosse umane a Maia; il coach non modifica la partita. Non applicare il convertitore W/D/L Stockfish ai punteggi Maia.
Perché: Le spiegazioni del modello possono contenere errori e non sono regole scacchistiche.

### Vincolo: Funzionamento senza chat

Stato: active
Regola: Scacchiera, Maia e Stockfish restano utilizzabili quando Codex non è autenticato o manca la rete, dopo la preparazione dei pesi locali.
Perché: Il nucleo locale non deve dipendere dall'account o dalla latenza del coach.

### Vincolo: Confine desktop/backend

Stato: active
Regola: Loopback, token effimero nel main Electron, IPC limitato, renderer senza Node e processi posseduti chiusi all'uscita.
Perché: Il frontend non deve ottenere credenziali o l'accesso generale al computer.

### Vincolo: Revisione finale unica e linea preservata

Stato: active
Regola: Conservare report e tentativo agent per partita; riapertura e domande non rigenerano la revisione. La linea originale conclusa resta immutabile; alternative in varianti separate.
Perché: Richiesta esplicita dell'utente del 2026-10-07; evitare costo ripetuto e perdita della partita.

## Fuori ambito

- Account utenti, matchmaking, cloud sync, pagamenti e motore remoto.
- Chiamate modello reali nei test automatici.
- Presentare W/D/L come probabilità che la mossa sia corretta.
