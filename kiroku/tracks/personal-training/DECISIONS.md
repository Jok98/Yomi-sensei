# Decisioni

## Decisioni attive

### Decisione: Archivio persistente locale

Status: active
Area: dati
Decision: SQLite nel profilo conserva partite, studio, chat, report e progressi.
Rationale: L'utente richiede salvataggio e storico esplorabile; il nucleo resta locale e senza Docker.
Consequences: Storico UCI validato dal backend; navigazione e varianti non distruggono la linea originale.

### Decisione: Analisi agent unica

Status: active
Area: revisione
Decision: Job idempotente che persiste analisi motore e spiegazione Codex; riapertura e chat riusano il report.
Rationale: Vincolo esplicito dell'utente del 2026-10-07 per evitare elaborazioni ripetute.
Consequences: Claim persistente prima della chiamata; nessun retry agent automatico dopo un tentativo. Le domande successive sono chat contestuale.

### Decisione: Controlli e catture accanto al tavoliere

Status: active
Area: interfaccia
Decision: Indietro e rotazione/cambio colore a destra, opposti alla barra; catture per lato nelle righe giocatore.
Rationale: Preferenza UX esplicita; mantenere tavoliere stabile e classico.
Consequences: Catture dalle mosse effettive, incluse en passant/promozioni; orientamento e colore giocato distinti.

## Decisioni sostituite

- Partite e chat soltanto volatili: sostituite dall'archivio richiesto.
