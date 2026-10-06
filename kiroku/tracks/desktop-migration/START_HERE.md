# Migrazione desktop

## Missione

- Migrare il frontend seguendo ComprehensionIDE, senza Docker.
- Mantenere scacchiera, Stockfish e coach Codex funzionali.

## Stato attuale

- Riferimento: `C:/Users/jok/Documents/ChatGPT/ComprehensionIDE`, sola lettura.
- Stack scelto: Electron, React 19, TypeScript, Vite, esbuild, pnpm.
- Shell compatta neutra, barre strumenti laterali, scacchiera centrale e pannelli.
- M-01, M-02 e M-03 completate; track concluso il 2026-10-06.
- Avvio con `Start.cmd`; pacchetto Windows in `release/win-unpacked`.
- Test e smoke con Stockfish reale superati; issue residui nel `WORK.md` globale.

## Prossima azione

- Usare il desktop e provare il coach con il proprio login Codex; nessuna chiamata account nei test.
- Proseguire dal backlog globale per ripetizioni, CI e dipendenze Python.

## Vincoli inderogabili

- Non modificare ComprehensionIDE, che contiene lavoro locale dell'utente.
- Nessun Docker; credenziali Codex solo nel profilo locale del CLI.
- Stockfish e python-chess restano responsabili di valutazioni e regole.
- UI italiana; shell neutra con colori funzionali per pezzi e giudizi.
- Nessuna chiamata modello reale nei test automatici.
- YS-01 resta nel backlog; i difetti frontend entrano nel controller nuovo.

## Leggi solo se necessario

- `ROADMAP.md`, `STATE.md`, `WORK.md` per avanzamento e verifica.
- `DECISIONS.md`, `RISKS.md` per scelte e limiti.
- `../../WORK.md` per gli issue conservati dall'analisi.
