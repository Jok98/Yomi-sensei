# Rischi

## Rischi aperti

### Rischio: Codex non ottimale per coaching scacchistico

Condizione:
I modelli disponibili in Codex sono orientati anche al lavoro agentico, non specificamente
al coaching scacchistico.

Impatto:
Le risposte possono costare di più o risultare meno chiare di un modello generalista.

Mitigazione:
Mantenere `CODEX_MODEL` opzionale e confrontare le risposte su posizioni reali.

### Rischio: Credenziali ChatGPT nel volume Docker

Condizione:
Il login Codex viene memorizzato in `codex-auth` per sopravvivere ai riavvii.

Impatto:
Chi esporta o legge il volume potrebbe recuperare token di accesso.

Mitigazione:
Non montare il volume altrove, non copiarlo nel repository e non pubblicarlo; usare
`codex logout` prima di cedere la macchina o il volume.

### Rischio: Processo CLI per ogni messaggio

Condizione:
La chat stateless avvia `codex exec --ephemeral` a ogni richiesta.

Impatto:
Avvio e risposta possono essere più lenti di un daemon persistente.

Mitigazione:
Misurare l'MVP; valutare `codex app-server` soltanto se latenza o streaming lo richiedono.

### Rischio: Prima build Docker non verificata

Condizione:
Docker non era installato o nel `PATH` durante l'implementazione.

Impatto:
Versioni di pacchetti o percorso di Stockfish potrebbero richiedere un piccolo aggiustamento.

Mitigazione:
La base è fissata a Debian Bookworm e `/usr/games/stockfish` è verificato nel pacchetto
ufficiale; eseguire comunque build e health check appena Docker Desktop è disponibile.

### Rischio: Percezione fuorviante delle percentuali

Condizione:
L'utente può leggerle come probabilità assoluta che una mossa sia la migliore.

Impatto:
Il prodotto comunica una certezza che Stockfish MultiPV non fornisce.

Mitigazione:
Etichettare come esito atteso, mostrare W/D/L nel tooltip e mantenere la nota esplicativa.

## Rischi accettati

- Stato partita volatile nel browser per mantenere l'MVP semplice e privo di database.
- Dipendenza da internet soltanto per la chat Codex.

## Rischi chiusi

- Nessuno.
