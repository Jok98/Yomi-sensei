# Lavoro

## In corso

- Nessuna attività in corso dopo la consegna dell'MVP.

## TODO

### Attività: Verifica end-to-end Docker

Stato: todo
Completamento:
L'immagine si costruisce, `/api/health` è verde, Stockfish restituisce tre mosse e la
chat risponde dopo login ChatGPT del Codex CLI nel volume Docker.

### Attività: Test delle mosse speciali nell'interfaccia

Stato: todo
Completamento:
Arrocco, en passant, promozione e annullamento sono verificati manualmente nel browser.

### Attività: Confermare la metrica percentuale

Stato: todo
Completamento:
L'utente approva esito atteso W/D/L oppure sceglie una metrica alternativa esplicitata.

## Bloccato

- Nessuna attività bloccata.

## Fatto

- Creato backend stateless con regole, Stockfish MultiPV e chat Codex CLI.
- Rimossa l'integrazione Responses API/API key e aggiunto login ChatGPT persistente in Docker.
- Creata interfaccia responsive con scacchiera, suggerimenti, storico e chat.
- Aggiunti Dockerfile, Compose, PWA, configurazione, test e documentazione.
- Superati 11 test e verificati nel browser layout desktop/mobile, mossa e annullamento.
- Verificata una chiamata reale stateless al Codex CLI autenticato con ChatGPT.

## Annullato

- Nessuna attività annullata.
