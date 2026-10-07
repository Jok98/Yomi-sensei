# Rischi

## Rischi aperti

- Coach con account reale e qualità delle spiegazioni restano da verificare manualmente.
- Nessun blocco di consegna; pacchetto e CI verificati.

## Rischi accettati

- Se il processo si chiude dopo il claim coach, il tentativo non viene ripetuto per evitare doppie chiamate account.
- Revisione e chat richiedono login Codex locale; report motore/archivio/esercizi funzionano senza account.
- La revisione approfondita richiede tempo proporzionale alle mosse; progressi e posizioni sono salvati.
- Uno studio non consuma tempo di gioco; annullare una mossa non restituisce il tempo già trascorso.

## Rischi chiusi

- Snapshot tardivi: salvataggi serializzati con revisioni monotone; errori preservano le modifiche.
- Doppia revisione: claim SQLite e tentativo coach persistente; concorrenza/riavvio coperti.
- Studio confuso con gioco: cursore/varianti separati e linea conclusa immutabile.
- Risposta dopo timeout: generazione invalida il risultato tardivo; test passato.
- Aiuti automatici negli esercizi: barra/candidate/giudizi nascosti e suggerimenti espliciti.
- Chiusura durante il calcolo: snapshot dei soli turni committati; risposte tardive scartate. Doppia chiusura/fallimento/retry verificati nel desktop sorgenti e pacchetto.
