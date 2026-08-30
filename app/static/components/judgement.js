export function classificationDescription(classification) {
  const loss = Number(classification.expected_points_loss ?? 0);
  const details = [];
  if (loss > 0) details.push(`perdita attesa ${(loss * 100).toFixed(1)}%`);
  if (classification.best_move_san) details.push(`migliore: ${classification.best_move_san}`);
  return details.length ? `${classification.label} · ${details.join(" · ")}` : classification.label;
}

export function createJudgementIcon(classification) {
  const icon = document.createElement("span");
  icon.className = "judgement-glyph";
  if (classification.code === "book") {
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M3.5 5.5c3-.5 5.4.3 8.5 2.2v11c-3.1-1.9-5.5-2.7-8.5-2.2v-11Z"></path>
        <path d="M20.5 5.5c-3-.5-5.4.3-8.5 2.2v11c3.1-1.9 5.5-2.7 8.5-2.2v-11Z"></path>
      </svg>`;
  } else {
    icon.textContent = classification.marker;
  }
  return icon;
}
