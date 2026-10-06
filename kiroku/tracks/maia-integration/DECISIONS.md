# Decisioni

### Decisione: Maia-3 principale, Stockfish valutatore

Stato: active
Decisione: Maia produce le mosse dell'avversario e le scelte umane; Stockfish ne misura la qualità.
Motivazione: L'utente approva l'integrazione con priorità Maia, conservando Stockfish.
Conseguenze: Servizi e metriche distinti; il coach riceve entrambe le fonti.

### Decisione: Worker e runtime Maia separati

Stato: active
Decisione: Worker JSON con PyTorch isolato, modello 79M predefinito e 5M selezionabile.
Motivazione: Preservare un backend leggero e distribuire inferenza CPU senza requisiti GPU.
Conseguenze: Pesi locali con checksum; worker standalone nella build Windows; GPU opzionale non verificata.
