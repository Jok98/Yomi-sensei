import { classificationDescription, createJudgementIcon } from "./judgement.js";

export function createMoveHistoryComponent({ state, elements }) {
  function render() {
    const moveCount = state.moveHistory.length;
    elements.moveCount.textContent = String(moveCount);
    elements.moveCount.setAttribute(
      "aria-label",
      `${moveCount} ${moveCount === 1 ? "mossa" : "mosse"}`,
    );
    if (!moveCount) {
      elements.moveList.innerHTML =
        '<span class="empty-copy">La partita non è ancora iniziata.</span>';
      return;
    }

    elements.moveList.replaceChildren();
    state.moveHistory.forEach((record, index) => {
      const isWhite = index % 2 === 0;
      const entry = document.createElement("div");
      entry.className = `move-entry ${isWhite ? "white-move" : "black-move"}`;

      const ply = document.createElement("span");
      ply.className = "move-ply";
      ply.innerHTML = `<span aria-hidden="true">${isWhite ? "♙" : "♟"}</span><small>${Math.floor(index / 2) + 1}${isWhite ? "." : "…"}</small>`;

      const copy = document.createElement("span");
      copy.className = "move-copy";
      const side = document.createElement("small");
      side.className = "move-side";
      side.textContent = isWhite ? "Bianco" : "Nero";
      const move = document.createElement("strong");
      move.className = "move-san";
      move.textContent = record.san;
      copy.append(side, move);
      entry.append(ply, copy);

      if (record.classification) {
        entry.classList.add("classified-move", `classification-${record.classification.code}`);
        const classification = document.createElement("span");
        classification.className =
          `move-classification classification-${record.classification.code}`;
        classification.title = classificationDescription(record.classification);
        classification.append(createJudgementIcon(record.classification));
        const label = document.createElement("span");
        label.textContent = record.classification.label;
        classification.append(label);
        entry.append(classification);
      } else if (record.isComputer) {
        const source = document.createElement("span");
        source.className = "move-source";
        source.textContent = "Mossa computer";
        entry.append(source);
      }
      elements.moveList.append(entry);
    });

    const horizontal = getComputedStyle(elements.moveList).flexDirection === "row";
    if (horizontal) {
      const entries = [...elements.moveList.querySelectorAll(".move-entry")];
      const focusEntry = state.gameMode === "computer"
        ? [...entries].reverse().find((entry) => entry.classList.contains("classified-move"))
        : entries.at(-1);
      elements.moveList.scrollLeft = focusEntry
        ? Math.max(0, focusEntry.offsetLeft - elements.moveList.offsetLeft - 8)
        : elements.moveList.scrollWidth;
    } else {
      elements.moveList.scrollTop = elements.moveList.scrollHeight;
    }
  }

  return { render };
}
