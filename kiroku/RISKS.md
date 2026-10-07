# Rischi

## Rischi aperti

### Rischio: Integrazione Codex dipendente dal runtime locale

Condizione: La chat avvia un processo del CLI installato e autenticato dall'utente.
Impatto: Modelli disponibili, latenza e compatibilità possono cambiare con la versione del CLI.
Mitigazione: Modello opzionale, catalogo dinamico e CODEX_EXECUTABLE; validare una chat reale separatamente dai test sintetici.

### Rischio: Piattaforme non verificate

Condizione: Sviluppo e verifiche correnti avvengono su Windows x64.
Impatto: Linux/macOS possono richiedere adattamenti a packaging, motore e gestione dei processi.
Mitigazione: Non presentare gli script multipiattaforma come runtime già validato.

### Rischio: Chiamata coach interrotta

Condizione: Il processo si chiude dopo aver iniziato una chiamata agent della revisione.
Impatto: La risposta può non essere salvata pur avendo consumato il tentativo account.
Mitigazione: Claim SQLite prima della chiamata e nessun retry dopo un tentativo; report motore e chat disponibili.

## Rischi accettati

- PyTorch e pesi aumentano il pacchetto Windows a circa 1,27 GB; inferenza CPU verificata, CUDA non validato.
- Il rating Maia condiziona il modello Lichess blitz e non garantisce forza o comportamento individuale identici.
- SQLite conserva dati locali nel profilo; eseguire backup del database con app chiusa per conservarli anche fuori macchina.
- Connessione Internet necessaria soltanto per il coach dopo la preparazione dei runtime.

## Rischi chiusi

- Ripetizioni: storico UCI validato e Board con stack; regressioni e smoke desktop passano (YS-01).
- Dipendenza da Docker: percorso rimosso su richiesta dell'utente.
- Annullamento, analisi obsolete in chat e pannello risposte nascosto: corretti nel controller/componenti React con test regressione.
