# Decisioni

### Decisione: Electron e React con backend locale

Stato: active
Area: desktop
Decisione: Adottare shell e stack frontend del riferimento, preservando le API Python.
Motivazione: L'utente richiede ComprehensionIDE come riferimento e vieta Docker; riusare il backend limita regressioni.
Conseguenze: Python gestito dal desktop, componenti React e contratti IPC tipizzati.

### Decisione: Correzioni frontend integrate

Stato: active
Area: stato partita
Decisione: Risolvere YS-02/03/04 nel nuovo controller, mantenendo YS-01 separato.
Motivazione: I primi tre dipendono dal frontend sostituito; le ripetizioni richiedono un contratto backend nuovo.
