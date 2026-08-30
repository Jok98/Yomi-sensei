# Decisioni

## Decisioni attive

### Decisione: PWA locale in un solo container

Stato: active
Area: distribuzione

Decisione:
Servire interfaccia e API da FastAPI; l'app è installabile come PWA.

Motivazione:
È il percorso più portabile e verificabile senza creare un pacchetto diverso per ogni OS.

Conseguenze:
- Serve Docker Desktop o un runtime compatibile.
- Un wrapper Tauri resta opzionale e separato.

### Decisione: Stockfish separato dal coach LLM

Stato: active
Area: analisi

Decisione:
Stockfish calcola mosse e valutazioni; l'LLM interpreta il risultato.

Motivazione:
Un LLM non è un motore scacchistico affidabile e può inventare mosse.

Conseguenze:
- La chat riceve le linee del motore come contesto vincolante.
- Le regole sono sempre validate da `python-chess`.

### Decisione: Codex CLI con login ChatGPT e invocazioni effimere

Stato: active
Area: LLM

Decisione:
Usare `codex exec` autenticato tramite abbonamento ChatGPT, senza API key. Non fissare
il modello predefinito e isolare ogni richiesta come processo effimero read-only.

Motivazione:
Rispecchia il pattern già adottato in Sebas e usa i crediti dell'abbonamento Codex.

Conseguenze:
- Il container include Codex CLI e richiede un login device-code una tantum.
- Le credenziali risiedono nel volume privato `codex-auth`.
- Ogni messaggio crea un processo CLI; latenza e concorrenza vanno misurate.

## Decisioni sostituite o obsolete

- 2026-08-30: integrazione diretta Responses API con `OPENAI_API_KEY` e modello
  `gpt-5.3-codex`; sostituita perché il requisito è Codex CLI con abbonamento ChatGPT.
