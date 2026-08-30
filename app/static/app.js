import { createMoveHistoryComponent } from "./components/move-history.js";
import { classificationDescription, createJudgementIcon } from "./components/judgement.js";
import { api } from "./core/api.js";
import { PIECES, state } from "./core/state.js";

const elements = {
  board: document.querySelector("#chessboard"),
  status: document.querySelector("#game-status"),
  turn: document.querySelector("#turn-indicator"),
  moveList: document.querySelector("#move-list"),
  moveCount: document.querySelector("#move-count"),
  gameModeEyebrow: document.querySelector("#game-mode-eyebrow"),
  modeButtons: [...document.querySelectorAll("[data-game-mode]")],
  difficultyControl: document.querySelector("#difficulty-control"),
  difficultySelect: document.querySelector("#difficulty-select"),
  playerAnalysis: document.querySelector("#player-analysis"),
  opponentAnalysis: document.querySelector("#opponent-analysis"),
  playerCandidates: document.querySelector("#player-candidate-list"),
  opponentCandidates: document.querySelector("#opponent-candidate-list"),
  playerAnalysisTitle: document.querySelector("#player-analysis-title"),
  opponentAnalysisTitle: document.querySelector("#opponent-analysis-title"),
  playerAnalysisContext: document.querySelector("#player-analysis-context"),
  opponentAnalysisContext: document.querySelector("#opponent-analysis-context"),
  playerSideToken: document.querySelector("#player-side-token"),
  opponentSideToken: document.querySelector("#opponent-side-token"),
  newGame: document.querySelector("#new-game"),
  undo: document.querySelector("#undo-move"),
  flip: document.querySelector("#flip-board"),
  refresh: document.querySelector("#refresh-analysis"),
  engineStatus: document.querySelector("#engine-status"),
  llmStatus: document.querySelector("#llm-status"),
  modelLabel: document.querySelector("#model-label"),
  modelSelect: document.querySelector("#model-select"),
  reasoningSelect: document.querySelector("#reasoning-select"),
  chatMessages: document.querySelector("#chat-messages"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  send: document.querySelector("#send-message"),
  toast: document.querySelector("#toast"),
};

const moveHistoryComponent = createMoveHistoryComponent({ state, elements });

function parseFen(fen) {
  const board = new Map();
  const rows = fen.split(" ")[0].split("/");
  rows.forEach((row, rowIndex) => {
    let fileIndex = 0;
    for (const token of row) {
      if (/\d/.test(token)) {
        fileIndex += Number(token);
      } else {
        const square = `${"abcdefgh"[fileIndex]}${8 - rowIndex}`;
        board.set(square, token);
        fileIndex += 1;
      }
    }
  });
  return board;
}

function displaySquares() {
  const files = state.orientation === "white" ? [..."abcdefgh"] : [..."hgfedcba"];
  const ranks = state.orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

function pieceColor(piece) {
  return piece === piece.toUpperCase() ? "white" : "black";
}

function legalFrom(square) {
  if (
    state.gameMode === "computer"
    && state.position?.turn !== state.playerColor
  ) {
    return [];
  }
  return state.position?.legal_moves.filter((move) => move.from_square === square) ?? [];
}

function renderBoard() {
  if (!state.position) return;
  const pieces = parseFen(state.position.fen);
  const legalTargets = new Set(
    state.selected ? legalFrom(state.selected).map((move) => move.to_square) : [],
  );
  const squares = displaySquares();

  elements.board.replaceChildren(
    ...squares.map((square, index) => {
      const file = square.charCodeAt(0) - 97;
      const rank = Number(square[1]);
      const piece = pieces.get(square);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `square ${(file + rank) % 2 === 1 ? "light" : "dark"}`;
      button.dataset.square = square;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", square);

      const judgement = state.moveBadge?.square === square ? state.moveBadge : null;
      if (judgement) {
        button.setAttribute("aria-label", `${square} · ${judgement.label}`);
      }

      if (legalFrom(square).length > 0) button.classList.add("movable");
      if (square === state.selected) button.classList.add("selected");
      if (state.preview?.includes(square)) button.classList.add("preview");
      if (state.lastMove.includes(square)) button.classList.add("last-move");
      if (legalTargets.has(square)) button.classList.add("legal-target");
      if (piece) button.classList.add("occupied");

      const column = index % 8;
      const row = Math.floor(index / 8);
      if (column === 0) {
        const label = document.createElement("span");
        label.className = "coordinate rank";
        label.textContent = square[1];
        button.append(label);
      }
      if (row === 7) {
        const label = document.createElement("span");
        label.className = "coordinate file";
        label.textContent = square[0];
        button.append(label);
      }

      if (piece) {
        const pieceSpan = document.createElement("span");
        pieceSpan.className = `piece ${pieceColor(piece)}-piece`;
        pieceSpan.textContent = PIECES[piece];
        pieceSpan.draggable = legalFrom(square).length > 0;
        pieceSpan.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", square);
          event.dataTransfer.effectAllowed = "move";
          state.selected = square;
          state.preview = null;
          queueMicrotask(renderBoard);
        });
        button.append(pieceSpan);
      }

      if (judgement) {
        const badge = document.createElement("span");
        badge.className = `move-judgement classification-${judgement.code}`;
        badge.title = classificationDescription(judgement);
        badge.setAttribute("aria-hidden", "true");
        badge.append(createJudgementIcon(judgement));
        button.append(badge);
      }

      button.addEventListener("click", () => handleSquareClick(square));
      button.addEventListener("dragover", (event) => {
        if (state.selected && legalFrom(state.selected).some((move) => move.to_square === square)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      });
      button.addEventListener("drop", async (event) => {
        event.preventDefault();
        const from = event.dataTransfer.getData("text/plain");
        await tryMove(from, square);
      });
      return button;
    }),
  );
}

async function handleSquareClick(square) {
  state.preview = null;
  if (!state.selected) {
    if (legalFrom(square).length > 0) state.selected = square;
    renderBoard();
    return;
  }

  if (state.selected === square) {
    state.selected = null;
    renderBoard();
    return;
  }

  const matchingMoves = legalFrom(state.selected).filter((move) => move.to_square === square);
  if (matchingMoves.length > 0) {
    await tryMove(state.selected, square);
    return;
  }

  state.selected = legalFrom(square).length > 0 ? square : null;
  renderBoard();
}

function choosePromotion(moves) {
  if (moves.length === 1) return moves[0].promotion;
  const available = moves.map((move) => move.promotion).filter(Boolean);
  if (!available.length) return null;
  const choice = window.prompt("Promozione: q = donna, r = torre, b = alfiere, n = cavallo", "q");
  const normalized = choice?.trim().toLowerCase();
  return available.includes(normalized) ? normalized : "q";
}

async function tryMove(from, to) {
  if (state.gameMode === "computer" && state.position?.turn !== state.playerColor) return;
  const moves = legalFrom(from).filter((move) => move.to_square === to);
  if (!moves.length) {
    state.selected = null;
    renderBoard();
    return;
  }

  const previousPosition = structuredClone(state.position);
  const promotion = choosePromotion(moves);
  setBoardBusy(true);
  try {
    const next = await api("/api/game/move", {
      method: "POST",
      body: JSON.stringify({
        fen: state.position.fen,
        from_square: from,
        to_square: to,
        promotion,
      }),
    });
    const moveRecord = {
      san: next.last_move_san,
      uci: next.last_move_uci,
      classification: null,
      isComputer: false,
    };
    state.positionHistory.push(previousPosition);
    state.moveHistory.push(moveRecord);
    state.position = next;
    state.lastMove = [from, to];
    state.selected = null;
    state.preview = null;
    renderAll();
    await classifyPlayedMove(previousPosition.fen, moveRecord);
    if (state.gameMode === "computer" && !next.is_game_over) {
      await makeComputerMove();
    } else {
      await analyzePosition();
    }
  } catch (error) {
    showToast(error.message);
    renderAll();
  } finally {
    setBoardBusy(false);
  }
}

async function makeComputerMove() {
  const previousPosition = structuredClone(state.position);
  elements.status.textContent = "Il computer sta pensando…";
  elements.playerCandidates.innerHTML = `
    <div class="analysis-placeholder">
      <span class="spinner"></span>
      Il computer sta pensando…
    </div>`;
  const next = await api("/api/game/computer-move", {
    method: "POST",
    body: JSON.stringify({
      fen: state.position.fen,
      difficulty: elements.difficultySelect.value,
    }),
  });
  state.positionHistory.push(previousPosition);
  state.moveHistory.push({
    san: next.last_move_san,
    uci: next.last_move_uci,
    classification: null,
    isComputer: true,
  });
  state.position = next;
  state.lastMove = next.last_move_uci
    ? [next.last_move_uci.slice(0, 2), next.last_move_uci.slice(2, 4)]
    : [];
  state.selected = null;
  state.preview = null;
  renderAll();
  await analyzePosition();
}

async function classifyPlayedMove(fen, moveRecord) {
  if (!moveRecord.uci) return;
  try {
    const classification = await api("/api/classify-move", {
      method: "POST",
      body: JSON.stringify({ fen, move_uci: moveRecord.uci }),
    });
    moveRecord.classification = classification;
    state.moveBadge = {
      square: moveRecord.uci.slice(2, 4),
      ...classification,
    };
    renderBoard();
    renderMoveList();
  } catch (error) {
    showToast(`Giudizio mossa: ${error.message}`);
  }
}

function renderAll() {
  renderBoard();
  elements.status.textContent = state.position?.status ?? "Posizione non disponibile";
  elements.turn.classList.toggle("black", state.position?.turn === "black");
  elements.turn.classList.toggle("white", state.position?.turn !== "black");
  elements.undo.disabled = state.boardBusy || state.positionHistory.length === 0;
  renderMoveList();
}

function renderMoveList() {
  moveHistoryComponent.render();
}

function pgnHistory() {
  const chunks = [];
  for (let index = 0; index < state.moveHistory.length; index += 2) {
    const white = state.moveHistory[index]?.san ?? "";
    const black = state.moveHistory[index + 1]?.san ?? "";
    chunks.push(`${index / 2 + 1}. ${white}${black ? ` ${black}` : ""}`);
  }
  return chunks.join(" ");
}

async function analyzePosition() {
  if (!state.position) return;
  const sequence = ++state.analysisSequence;
  state.candidates = [];
  state.replies = [];
  state.activeCandidateUci = null;
  updateAnalysisIdentities();
  elements.playerAnalysisContext.textContent = "Analisi in corso";
  elements.opponentAnalysisContext.textContent = "Calcolo risposte";
  elements.playerCandidates.innerHTML = `
    <div class="analysis-placeholder">
      <span class="spinner"></span>
      Stockfish sta leggendo la posizione…
    </div>`;
  elements.opponentCandidates.innerHTML = `
    <div class="analysis-placeholder">
      <span class="spinner"></span>
      Stockfish sta leggendo la posizione…
    </div>`;
  try {
    const result = await api("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        fen: state.position.fen,
        include_replies: state.gameMode === "free",
      }),
    });
    if (sequence !== state.analysisSequence) return;
    state.candidates = result.candidates;
    state.replies = result.replies ?? [];
    state.activeCandidateUci = state.candidates[0]?.uci ?? null;
    renderCandidates();
  } catch (error) {
    if (sequence !== state.analysisSequence) return;
    state.candidates = [];
    state.replies = [];
    elements.playerCandidates.innerHTML = `<div class="analysis-error"></div>`;
    elements.playerCandidates.firstElementChild.textContent = error.message;
    elements.opponentCandidates.innerHTML = `<div class="analysis-error"></div>`;
    elements.opponentCandidates.firstElementChild.textContent = error.message;
  }
}

function otherColor(color) {
  return color === "white" ? "black" : "white";
}

function colorName(color) {
  return color === "white" ? "Bianco" : "Nero";
}

function applyAnalysisColor(panel, token, color) {
  panel.classList.toggle("white-analysis", color === "white");
  panel.classList.toggle("black-analysis", color === "black");
  token.className = `side-token ${color === "white" ? "white-token" : "black-token"}`;
  token.textContent = color === "white" ? "♙" : "♟";
}

function updateAnalysisIdentities() {
  const currentColor = state.position?.turn ?? "white";
  const opponentColor = otherColor(currentColor);
  elements.playerAnalysisTitle.textContent = colorName(currentColor);
  elements.opponentAnalysisTitle.textContent = colorName(opponentColor);
  applyAnalysisColor(elements.playerAnalysis, elements.playerSideToken, currentColor);
  applyAnalysisColor(elements.opponentAnalysis, elements.opponentSideToken, opponentColor);
}

function createCandidateCard(candidate, { active = false, reply = false, onClick = null } = {}) {
  const card = document.createElement(onClick ? "button" : "div");
  if (onClick) {
    card.type = "button";
    card.setAttribute("aria-pressed", String(active));
  }
  card.className = `candidate-card${active ? " active" : ""}${reply ? " reply-card" : ""}`;
  card.title = `Vittoria ${candidate.win_percent}% · Patta ${candidate.draw_percent}% · Sconfitta ${candidate.loss_percent}%`;
  card.innerHTML = `
    <span class="candidate-rank">${candidate.rank}</span>
    <span class="candidate-copy">
      <strong class="candidate-move">${escapeHtml(candidate.san)}</strong>
      <span class="candidate-line">${escapeHtml(candidate.principal_variation.join(" "))}</span>
    </span>
    <span class="candidate-score">
      <strong>${candidate.expected_score_percent.toFixed(1)}%</strong>
      <small>${candidate.evaluation}</small>
    </span>
    <span class="score-bar" aria-hidden="true">
      <span style="width: ${candidate.expected_score_percent}%"></span>
    </span>`;
  if (onClick) card.addEventListener("click", onClick);
  return card;
}

function activeReplyAnalysis() {
  return state.replies.find((reply) => reply.after_uci === state.activeCandidateUci) ?? null;
}

function renderColorCandidates(panel, list, context, color) {
  const currentColor = state.position?.turn ?? "white";
  const isCurrent = color === currentColor;
  const replyAnalysis = activeReplyAnalysis();
  const candidates = isCurrent ? state.candidates : replyAnalysis?.candidates ?? [];
  panel.classList.toggle("current-turn", isCurrent);
  panel.classList.toggle("reply-turn", !isCurrent);
  context.textContent = isCurrent ? "Al tratto" : replyAnalysis ? `Dopo ${replyAnalysis.after_san}` : "In risposta";

  if (!candidates.length) {
    list.innerHTML = `<div class="analysis-placeholder">${isCurrent ? "La partita è terminata." : "Nessuna risposta disponibile."}</div>`;
    return;
  }
  list.replaceChildren(
    ...candidates.map((candidate) =>
      createCandidateCard(candidate, {
        active: isCurrent && candidate.uci === state.activeCandidateUci,
        reply: !isCurrent,
        onClick: isCurrent
          ? () => {
              state.activeCandidateUci = candidate.uci;
              renderCandidates();
              state.selected = null;
              state.preview = [candidate.uci.slice(0, 2), candidate.uci.slice(2, 4)];
              renderBoard();
            }
          : null,
      }),
    ),
  );
}

function renderCandidates() {
  updateAnalysisIdentities();
  if (state.position?.is_game_over) {
    elements.playerCandidates.innerHTML = '<div class="analysis-placeholder">Partita terminata.</div>';
    elements.opponentCandidates.innerHTML = '<div class="analysis-placeholder">Partita terminata.</div>';
    elements.playerAnalysisContext.textContent = "Partita terminata";
    elements.opponentAnalysisContext.textContent = "Partita terminata";
    return;
  }
  const currentColor = state.position?.turn ?? "white";
  renderColorCandidates(
    elements.playerAnalysis,
    elements.playerCandidates,
    elements.playerAnalysisContext,
    currentColor,
  );
  renderColorCandidates(
    elements.opponentAnalysis,
    elements.opponentCandidates,
    elements.opponentAnalysisContext,
    otherColor(currentColor),
  );
}

function setBoardBusy(busy) {
  state.boardBusy = busy;
  elements.board.style.pointerEvents = busy ? "none" : "auto";
  elements.newGame.disabled = busy;
  elements.undo.disabled = busy || state.positionHistory.length === 0;
  syncGameModeUi();
}

function syncGameModeUi() {
  const againstComputer = state.gameMode === "computer";
  elements.gameModeEyebrow.textContent = againstComputer
    ? "Sfida contro Stockfish"
    : "Partita libera";
  elements.opponentAnalysis.hidden = true;
  elements.difficultyControl.hidden = !againstComputer;
  elements.difficultySelect.disabled = state.boardBusy;
  elements.flip.disabled = state.boardBusy || againstComputer;
  elements.flip.title = againstComputer
    ? "In questa modalità giochi con il Bianco"
    : "Ruota scacchiera";
  elements.modeButtons.forEach((button) => {
    const active = button.dataset.gameMode === state.gameMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = state.boardBusy;
  });
}

async function startNewGame() {
  setBoardBusy(true);
  try {
    state.position = await api("/api/game/new");
    state.selected = null;
    state.preview = null;
    state.lastMove = [];
    state.moveBadge = null;
    state.moveHistory = [];
    state.positionHistory = [];
    state.candidates = [];
    state.replies = [];
    renderAll();
    await analyzePosition();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBoardBusy(false);
  }
}

async function undoMove() {
  if (!state.positionHistory.length) return;
  setBoardBusy(true);
  try {
    const steps = state.gameMode === "computer" ? Math.min(2, state.positionHistory.length) : 1;
    let previous = null;
    for (let index = 0; index < steps; index += 1) {
      previous = state.positionHistory.pop();
      state.moveHistory.pop();
    }
    if (!previous) return;
    state.position = previous;
    state.lastMove = [];
    const lastClassifiedMove = state.moveHistory.findLast((record) => record.classification);
    state.moveBadge = lastClassifiedMove
      ? {
          square: lastClassifiedMove.uci.slice(2, 4),
          ...lastClassifiedMove.classification,
        }
      : null;
    state.selected = null;
    state.preview = null;
    renderAll();
    await analyzePosition();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBoardBusy(false);
  }
}

async function setGameMode(mode) {
  if (!['free', 'computer'].includes(mode) || mode === state.gameMode) return;
  state.gameMode = mode;
  state.orientation = "white";
  state.playerColor = "white";
  syncGameModeUi();
  await startNewGame();
}

function appendMessage(role, content, id = "") {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  if (id) article.id = id;
  const author = document.createElement("div");
  author.className = "message-author";
  author.textContent = role === "user" ? "Tu" : "Yomi";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = content;
  article.append(author, bubble);
  elements.chatMessages.append(article);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  return article;
}

function appendTyping() {
  const article = document.createElement("article");
  article.id = "typing-message";
  article.className = "message assistant-message typing";
  article.innerHTML = `
    <div class="message-author">Yomi</div>
    <div class="message-bubble">
      <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
    </div>`;
  elements.chatMessages.append(article);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function sendChat(message) {
  const cleanMessage = message.trim();
  if (!cleanMessage || state.chatBusy || !state.position) return;

  const previousHistory = state.chatHistory.slice(-12);
  state.chatHistory.push({ role: "user", content: cleanMessage });
  appendMessage("user", cleanMessage);
  appendTyping();
  state.chatBusy = true;
  elements.send.disabled = true;
  elements.modelSelect.disabled = true;
  elements.reasoningSelect.disabled = true;

  const replyAnalysis = activeReplyAnalysis();

  try {
    const response = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        fen: state.position.fen,
        pgn: pgnHistory(),
        message: cleanMessage,
        history: previousHistory,
        candidates: state.candidates,
        opponent_candidates: replyAnalysis?.candidates ?? [],
        opponent_after_san: replyAnalysis?.after_san ?? null,
        model: elements.modelSelect.value || null,
        reasoning_effort: elements.reasoningSelect.value || null,
      }),
    });
    document.querySelector("#typing-message")?.remove();
    state.chatHistory.push({ role: "assistant", content: response.answer });
    appendMessage("assistant", response.answer);
    elements.modelLabel.title = `${response.model} · ${state.authMode}`;
  } catch (error) {
    document.querySelector("#typing-message")?.remove();
    appendMessage("assistant", error.message);
  } finally {
    state.chatBusy = false;
    elements.send.disabled = false;
    elements.modelSelect.disabled = false;
    elements.reasoningSelect.disabled = false;
    elements.chatInput.focus();
  }
}

function setConnectionStatus(element, online) {
  element.classList.toggle("online", online);
  element.classList.toggle("offline", !online);
}

async function loadHealth() {
  try {
    const health = await api("/api/health");
    setConnectionStatus(elements.engineStatus, health.stockfish);
    setConnectionStatus(elements.llmStatus, health.codex && health.codex_authenticated);
    state.authMode = health.auth_mode;
    renderModelSelectionLabel();
  } catch {
    setConnectionStatus(elements.engineStatus, false);
    setConnectionStatus(elements.llmStatus, false);
    elements.modelLabel.textContent = "offline";
  }
}

const REASONING_LABELS = {
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
  ultra: "Ultra",
};

function selectedModelOption() {
  return state.codexModels.find((model) => model.slug === elements.modelSelect.value) ?? null;
}

function renderModelSelectionLabel() {
  const model = selectedModelOption();
  const modelName = model?.display_name ?? "Auto account";
  const reasoning = REASONING_LABELS[elements.reasoningSelect.value] ?? elements.reasoningSelect.value;
  const selection = `${modelName} · ${reasoning}`;
  elements.modelLabel.textContent = state.authMode || "Codex";
  elements.modelLabel.title = state.authMode ? `${state.authMode} · ${selection}` : selection;
}

function renderReasoningOptions(preferred = null) {
  const model = selectedModelOption();
  const levels = model?.supported_reasoning_levels ?? ["low", "medium", "high", "xhigh"];
  const current = preferred || elements.reasoningSelect.value;
  elements.reasoningSelect.replaceChildren(
    ...levels.map((effort) => {
      const option = document.createElement("option");
      option.value = effort;
      option.textContent = REASONING_LABELS[effort] ?? effort;
      return option;
    }),
  );
  const fallback = model?.default_reasoning_level ?? "medium";
  elements.reasoningSelect.value = levels.includes(current) ? current : fallback;
  if (!elements.reasoningSelect.value) elements.reasoningSelect.value = levels[0] ?? "medium";
  renderModelSelectionLabel();
}

async function loadCodexOptions() {
  try {
    const options = await api("/api/codex/options");
    state.codexModels = options.models ?? [];
    const automatic = document.createElement("option");
    automatic.value = "";
    automatic.textContent = "Automatico account";
    elements.modelSelect.replaceChildren(
      automatic,
      ...state.codexModels.map((model) => {
        const option = document.createElement("option");
        option.value = model.slug;
        option.textContent = model.display_name;
        return option;
      }),
    );
    const configured = options.configured_model ?? "";
    elements.modelSelect.value = state.codexModels.some((model) => model.slug === configured)
      ? configured
      : "";
    renderReasoningOptions(options.default_reasoning_level ?? "medium");
  } catch (error) {
    showToast(`Modelli Codex: ${error.message}`);
    renderReasoningOptions("medium");
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 3500);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.newGame.addEventListener("click", startNewGame);
elements.undo.addEventListener("click", undoMove);
elements.flip.addEventListener("click", () => {
  if (state.gameMode === "computer") return;
  state.orientation = state.orientation === "white" ? "black" : "white";
  renderBoard();
  renderCandidates();
});
elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setGameMode(button.dataset.gameMode));
});
elements.refresh.addEventListener("click", analyzePosition);
elements.modelSelect.addEventListener("change", () => renderReasoningOptions());
elements.reasoningSelect.addEventListener("change", renderModelSelectionLabel);
elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elements.chatInput.value;
  elements.chatInput.value = "";
  elements.chatInput.style.height = "auto";
  await sendChat(message);
});
elements.chatInput.addEventListener("input", () => {
  elements.chatInput.style.height = "auto";
  elements.chatInput.style.height = `${Math.min(elements.chatInput.scrollHeight, 120)}px`;
});
elements.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});
document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => sendChat(button.dataset.prompt));
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

syncGameModeUi();
await Promise.all([loadHealth(), loadCodexOptions(), startNewGame()]);
