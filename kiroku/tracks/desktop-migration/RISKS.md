# Rischi

- Runtime Python e Stockfish inclusi nel pacchetto Windows e verificati con smoke.
- EOF stdin e fallback sul solo albero del backend chiudono i processi posseduti; il test Python verifica l'uscita con stdin chiuso.
- I test automatici non validano account Codex o qualità del coach; il CLI resta una dipendenza locale separata.
- Distribuzione non firmata; Linux/macOS non verificati.
- YS-01: la FEN non conserva lo storico delle ripetizioni.
- Il riferimento contiene modifiche locali e resta in sola lettura.
