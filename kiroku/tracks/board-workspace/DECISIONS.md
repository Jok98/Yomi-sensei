# Decisioni

## Decisioni attive

### Decisione: Scacchiera classica e analisi compatta

Status: active
Area: interfaccia
Decision: Beige/marrone, SVG CBurnett locali e analisi sotto il gioco con altezza compatta stabile per viewport.
Rationale: Preferenza dell'utente e correzione YS-06 del 2026-10-06: il ricalcolo non deve far muovere la scacchiera.
Consequences: Coach laterale indipendente; conservare attribuzione GPLv2+ di Colin M. L. Burnett.

### Decisione: Annotazioni separate dalle mosse

Status: active
Area: scacchiera
Decision: Trascinamento destro per frecce, click destro per cerchi, click sinistro/Escape per pulire.
Rationale: Interazione richiesta come chess.com, senza confondere previsioni e mosse reali.
Consequences: Annotazioni locali alla posizione; suggerimenti opzionali numerati per rango, disegni manuali arancio.

### Decisione: Barra Stockfish indipendente dai suggerimenti

Status: active
Area: valutazione
Decision: Prima candidata Stockfish, segno normalizzato al Bianco; colori seguono la rotazione. La proporzione è una scala visiva in pedoni, non una probabilità di vittoria.
Rationale: Barra come chess.com richiesta dall'utente il 2026-10-06, anche giocando contro Maia.
Consequences: Matto/patta usano il risultato della posizione; dati mancanti/obsoleti non indicano parità. Durante il calcolo l'ultimo valore è marcato; barra nel frame con spazio laterale fisso per preservare YS-06.

## Decisioni sostituite

- Altezza del dock legata al contenuto: provocava ridimensionamento della scacchiera durante il caricamento; sostituita da spazio stabile e scroll interno.
- Analisi nella sidebar destra e pezzi Unicode: sostituiti in questo track.
