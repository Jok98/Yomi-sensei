# Stato

## Scopo del progetto

Yomi Sensei permette di giocare su una scacchiera locale, vedere tre proposte
Stockfish e discutere la posizione con un LLM che riceve automaticamente il contesto.

## Stato corrente

- MVP implementato con FastAPI, `python-chess`, Stockfish, Codex CLI e frontend senza build.
- Distribuzione prevista tramite una sola immagine Docker e PWA installabile.
- Il modello non è fissato: Codex CLI usa quello disponibile per l'account, salvo `CODEX_MODEL`.
- Lo storico è mantenuto nel browser e il backend resta stateless.

## Verificato di recente

- 2026-08-30: repository inizialmente vuoto e senza commit.
- 2026-08-30: verificato `codex-cli 0.151.0-alpha.7.2`, autenticato tramite ChatGPT.
- 2026-08-30: Sebas conferma il pattern `codex exec` effimero e read-only.
- 2026-08-30: la documentazione OpenAI conferma login ChatGPT, device code e cache in `CODEX_HOME`.
- 2026-08-30: 11 test Python, sintassi JavaScript/Python e checker Kiroku superati.
- 2026-08-30: browser desktop/mobile verificato; mossa `e2-e4` e annullamento funzionano.
- 2026-08-30: rimossa integralmente l'integrazione API key/Responses API.
- 2026-08-30: chiamata reale attraverso `CodexCliService` riuscita con risposta `CODICEX_OK`.
- 2026-08-30: `/api/health` locale rileva Codex disponibile e autenticato via ChatGPT.

## Domande aperte

- Le percentuali W/D/L sono il formato finale desiderato o si preferisce un indice
  normalizzato tra le sole tre mosse?
- L'utente vuole una PWA installabile o anche un wrapper Tauri con installer nativo?
- La chat dovrà conservare partite e conversazioni tra riavvii?

## Punti da sorvegliare

- Disponibilità e latenza del modello scelto dall'account ChatGPT reale.
- Prima build effettiva dell'immagine, pur con pacchetto e percorso Stockfish verificati su Debian.
- Primo login device-code e persistenza del volume `codex-auth` da verificare con Docker Desktop.
- Coerenza tra storico SAN client-side e FEN dopo annullamenti o import futuri.
