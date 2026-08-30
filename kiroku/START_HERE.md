# Inizia qui

## Missione

- Costruire Yomi Sensei, una scacchiera portabile con analisi Stockfish e coach LLM.
- Mantenere l'esperienza locale, semplice da avviare e utile anche senza la chat.

## Stato attuale

- L'MVP è una PWA desktop-style servita da FastAPI in un singolo container Docker.
- Le mosse sono validate da `python-chess`; Stockfish produce tre linee MultiPV.
- La chat usa `codex exec` con il login ChatGPT del Codex CLI, come Sebas.
- Docker include Codex CLI e conserva il login in un volume privato persistente.
- Il frontend invia al backend FEN, storico SAN e linee del motore.
- Sono presenti test delle regole e del provider CLI; l'avvio Docker resta da provare.

## Prossima azione

- Installare/avviare Docker Desktop, costruire l'immagine, eseguire
  `docker compose run --rm yomi-sensei codex login --device-auth`, poi avviare Compose.
- Verificare una sequenza con arrocco, cattura en passant, promozione e una domanda chat.

## Vincoli inderogabili

- Stockfish è la fonte delle valutazioni; l'LLM spiega ma non sostituisce il motore.
- Non usare `OPENAI_API_KEY`: l'accesso passa dall'abbonamento ChatGPT del Codex CLI.
- Il volume `codex-auth` contiene credenziali e non deve essere esportato o pubblicato.
- Le percentuali indicano esito atteso W/D/L, non probabilità di correttezza della mossa.
- Docker offre portabilità del runtime, non un binario nativo universale.
- La scacchiera deve restare utilizzabile quando Codex non è autenticato.

## Leggi solo se necessario

- `STATE.md` per fatti verificati e domande aperte.
- `ARCHITECTURE.md` prima di cambiare flussi o confini.
- `DECISIONS.md` e `CONSTRAINTS.md` prima di cambiare direzione.
- `WORK.md` per attività e condizioni di completamento.
- `RISKS.md` per limiti tecnici e di prodotto.
- `IDEAS.md` per estensioni non ancora adottate.
