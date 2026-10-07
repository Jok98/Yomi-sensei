import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const profile = await mkdtemp(path.join(tmpdir(), 'yomi-smoke-'));
const artifactDirectory = process.env.YOMI_SMOKE_ARTIFACT_DIR || 'artifacts';
await mkdir(artifactDirectory, { recursive: true });
const env = {
  ...process.env,
  YOMI_SMOKE: '1',
  YOMI_USER_DATA: profile,
  CODEX_EXECUTABLE: 'missing-yomi-smoke-codex',
  STOCKFISH_DEPTH: '8',
};
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await electron.launch({
  ...(process.env.YOMI_TEST_EXECUTABLE
    ? { executablePath: process.env.YOMI_TEST_EXECUTABLE, args: [] }
    : { args: ['.'] }),
  env,
  timeout: 30_000,
});
const errors = [];
const results = [];
const layoutStability = [];
const evaluationChecks = [];
const boardOnly = process.argv.includes('--board-only');
async function capture(file) {
  const data = await desktop.evaluate(async ({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    const options = { stayHidden: true, stayAwake: true };
    await contents.capturePage(undefined, options);
    return (await contents.capturePage(undefined, options)).toPNG().toString('base64');
  });
  await writeFile(path.join(artifactDirectory, path.basename(file)), Buffer.from(data, 'base64'));
}
try {
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('[data-square="e2"]', { timeout: 30_000 });
  const ready = async () => {
    await page.waitForFunction(() => {
      const board = document.querySelector('[role="grid"]');
      return board?.dataset.gameId && board.getAttribute('aria-busy') === 'false';
    });
    await page.waitForFunction(() => !document.querySelector('.analysis-progress'), undefined, {
      timeout: 45_000,
    });
  };
  await ready();
  console.log('Desktop ready');
  const evaluationSnapshot = () =>
    page.evaluate(() => {
      const bar = document.querySelector('.evaluation-bar');
      const board = document.querySelector('.chessboard').getBoundingClientRect();
      const rect = bar.getBoundingClientRect();
      const white = bar.querySelector('.evaluation-white').getBoundingClientRect();
      return {
        state: bar.dataset.state,
        orientation: bar.dataset.orientation,
        score: Number(bar.dataset.whiteScore),
        share: Number(bar.dataset.whiteShare),
        label: bar.querySelector('.evaluation-value').textContent,
        boardTop: board.top,
        boardHeight: board.height,
        boardLeft: board.left,
        barTop: rect.top,
        barHeight: rect.height,
        barRight: rect.right,
        whiteTop: white.top,
        whiteBottom: white.bottom,
        barBottom: rect.bottom,
      };
    });
  const checkEvaluationLayout = async (label) => {
    const value = await evaluationSnapshot();
    assert.equal(value.state, 'ready');
    assert.ok(Math.abs(value.barTop - value.boardTop) <= 0.5);
    assert.ok(Math.abs(value.barHeight - value.boardHeight) <= 0.5);
    assert.ok(value.barRight < value.boardLeft);
    assert.ok(
      Math.abs(
        value.orientation === 'white'
          ? value.whiteBottom - value.barBottom
          : value.whiteTop - value.barTop,
      ) <= 1.5,
    );
    evaluationChecks.push({ case: label, ...value });
    return value;
  };
  const checkStockfishPerspective = async (label) => {
    const value = await checkEvaluationLayout(label);
    const score = await page
      .locator('.recommendations .candidate-score strong')
      .first()
      .innerText();
    const blackTurn = /Nero/.test(await page.locator('.analysis-summary strong').innerText());
    const expected = score.startsWith('#')
      ? (score.slice(1).startsWith('-') ? -1 : 1) * (blackTurn ? -1 : 1) * 10
      : Number(score) * (blackTurn ? -1 : 1);
    assert.ok(Math.abs(value.score - expected) < 1e-10, `${label}: White perspective of ${score}`);
  };
  const initialEvaluation = await checkEvaluationLayout('initial-white-orientation');
  const withStableBoard = async (label, action, expectLoading = true) => {
    await page.evaluate(() => {
      const samples = [];
      const measure = () => {
        const board = document.querySelector('.chessboard').getBoundingClientRect();
        const dock = document.querySelector('.analysis-dock').getBoundingClientRect();
        const evaluation = document.querySelector('.evaluation-bar');
        const bar = evaluation.getBoundingClientRect();
        samples.push({
          x: board.x,
          y: board.y,
          width: board.width,
          height: board.height,
          dockHeight: dock.height,
          barX: bar.x,
          barY: bar.y,
          barWidth: bar.width,
          barHeight: bar.height,
          evaluationUpdating:
            evaluation.dataset.state === 'updating' &&
            evaluation.getAttribute('aria-busy') === 'true',
          loading: !!document.querySelector('.analysis-progress'),
        });
      };
      const observer = new MutationObserver(measure);
      observer.observe(document.querySelector('.board-pane'), {
        subtree: true,
        childList: true,
        attributes: true,
      });
      const timer = setInterval(measure, 16);
      measure();
      window.stopYomiLayoutProbe = () => {
        clearInterval(timer);
        observer.disconnect();
        measure();
        delete window.stopYomiLayoutProbe;
        return samples;
      };
    });
    let samples;
    try {
      await action();
      await ready();
    } finally {
      samples = await page.evaluate(() => window.stopYomiLayoutProbe());
    }
    const range = (field) =>
      Math.max(...samples.map((sample) => sample[field])) -
      Math.min(...samples.map((sample) => sample[field]));
    const result = {
      label,
      samples: samples.length,
      loadingSamples: samples.filter((sample) => sample.loading).length,
      evaluationUpdatingSamples: samples.filter((sample) => sample.evaluationUpdating).length,
      boardXRange: range('x'),
      boardYRange: range('y'),
      boardWidthRange: range('width'),
      boardHeightRange: range('height'),
      dockHeightRange: range('dockHeight'),
      barXRange: range('barX'),
      barYRange: range('barY'),
      barWidthRange: range('barWidth'),
      barHeightRange: range('barHeight'),
    };
    layoutStability.push(result);
    console.log(`Layout ${label}: ${JSON.stringify(result)}`);
    if (expectLoading) assert.ok(result.loadingSamples > 0, `${label}: loading state was sampled`);
    if (expectLoading)
      assert.ok(result.evaluationUpdatingSamples > 0, `${label}: evaluation updating was sampled`);
    for (const field of [
      'boardXRange',
      'boardYRange',
      'boardWidthRange',
      'boardHeightRange',
      'dockHeightRange',
      'barXRange',
      'barYRange',
      'barWidthRange',
      'barHeightRange',
    ])
      assert.ok(
        result[field] <= 0.5,
        `${label}: ${field} shifted ${result[field]}px during analysis`,
      );
  };
  const rightDraw = async (from, to) => {
    const start = await page.locator(`[data-square="${from}"]`).boundingBox();
    const end = await page.locator(`[data-square="${to}"]`).boundingBox();
    assert.ok(start && end);
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
    await page.mouse.up({ button: 'right' });
  };
  assert.equal(await page.locator('[role="gridcell"]').count(), 64);
  assert.equal(await page.locator('.chessboard .piece-image').count(), 32);
  assert.equal(await page.locator('.inspector').count(), 0);
  assert.equal(await page.locator('.suggested-arrow').count(), 0);
  assert.equal(
    await page.evaluate(() =>
      [...document.querySelectorAll('.piece-image')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    ),
    true,
  );
  const layout = await page.evaluate(() => {
    const board = document.querySelector('.chessboard').getBoundingClientRect();
    const dock = document.querySelector('.analysis-dock').getBoundingClientRect();
    return {
      boardBottom: board.bottom,
      boardWidth: board.width,
      dockTop: dock.top,
      dockHeight: dock.height,
      height: innerHeight,
    };
  });
  assert.ok(layout.dockTop > layout.boardBottom);
  assert.ok(layout.dockHeight < layout.height * 0.4);
  assert.ok(layout.boardWidth > 450);
  await rightDraw('e2', 'e4');
  await rightDraw('g1', 'f3');
  assert.equal(await page.locator('.manual-arrow').count(), 2);
  assert.equal(await page.locator('[data-testid="move-row"]').count(), 0);
  assert.equal(
    await page.locator('.manual-arrow[data-from="g1"] path').getAttribute('d'),
    'M 650 750 L 650 550 L 581 550',
  );
  await page.getByRole('button', { name: 'Ruota scacchiera', exact: true }).click();
  const flippedEvaluation = await checkEvaluationLayout('black-orientation');
  assert.equal(flippedEvaluation.score, initialEvaluation.score);
  assert.equal(flippedEvaluation.share, initialEvaluation.share);
  assert.equal(
    await page.locator('.manual-arrow[data-from="e2"] path').getAttribute('d'),
    'M 350 150 L 350 319',
  );
  await rightDraw('e2', 'e4');
  assert.equal(await page.locator('.manual-arrow').count(), 1);
  await rightDraw('e4', 'e4');
  assert.equal(await page.locator('.manual-circle').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.manual-mark').count(), 0);
  await page.getByRole('button', { name: 'Ruota scacchiera', exact: true }).click();
  const arrows = page.getByRole('checkbox', { name: 'Frecce suggerite', exact: true });
  await arrows.check();
  assert.equal(await page.locator('.suggested-arrow').count(), 3);
  const candidate = page.locator('[data-testid="human-analysis"] .candidate-row').nth(1);
  const candidateUci = await candidate.getAttribute('data-candidate-uci');
  await candidate.click();
  assert.equal((await evaluationSnapshot()).score, initialEvaluation.score);
  assert.equal(
    await page.locator('.suggested-arrow.active').getAttribute('data-from'),
    candidateUci.slice(0, 2),
  );
  assert.equal(
    await page.locator('.suggested-arrow.active').getAttribute('data-to'),
    candidateUci.slice(2, 4),
  );
  await rightDraw('d2', 'd4');
  await capture('artifacts/desktop-arrows.png');
  await page.evaluate(() => window.yomiFlush());
  await page.reload();
  await ready();
  assert.equal(await arrows.isChecked(), true);
  assert.equal(await page.locator('.suggested-arrow').count(), 3);
  assert.equal(await page.locator('.manual-mark').count(), 1);
  await page.getByRole('button', { name: 'Torna alla partita', exact: true }).click();
  await ready();
  await page.keyboard.press('Escape');
  await arrows.uncheck();
  assert.equal(await page.locator('.suggested-arrow').count(), 0);
  results.push(
    'Classic local SVG pieces, compact analysis below board, right-drag arrows/circles, rotation, candidate arrows and persisted preference',
  );
  assert.equal(await page.locator('.candidate-row.active').count(), 1);
  assert.equal(await page.locator('[data-testid="opponent-analysis"] .candidate-row').count(), 3);
  assert.equal(await page.locator('[data-testid="human-analysis"] .human-candidate').count(), 3);
  assert.match(await page.locator('[data-testid="human-analysis"]').innerText(), /scelta umana/);
  assert.match(await page.locator('[data-testid="human-analysis"]').innerText(), /Stockfish/);
  results.push('Startup, real Maia-3 79M policy and Stockfish evaluations, visible human replies');
  await capture('artifacts/desktop-maia.png');
  const humanEvaluation = await evaluationSnapshot();
  await page.getByRole('button', { name: 'Stockfish · tattica', exact: true }).click();
  assert.equal((await evaluationSnapshot()).score, humanEvaluation.score);
  await checkStockfishPerspective('stockfish-best-white-turn');
  await arrows.check();
  assert.equal(await page.locator('.suggested-arrow').count(), 3);
  const tacticalMoves = await page
    .locator('.recommendations [data-candidate-uci]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-candidate-uci')),
    );
  const tacticalArrows = await page
    .locator('.suggested-arrow')
    .evaluateAll((elements) =>
      elements.map(
        (element) => element.getAttribute('data-from') + element.getAttribute('data-to'),
      ),
    );
  assert.deepEqual(
    tacticalArrows,
    tacticalMoves.map((uci) => uci.slice(0, 4)),
  );
  assert.equal(await page.locator('.candidate-row.active').count(), 1);
  assert.equal(await page.locator('[data-testid="opponent-analysis"] .candidate-row').count(), 3);
  await capture('artifacts/desktop-stockfish.png');
  await page.getByRole('button', { name: 'Maia · umana', exact: true }).click();
  const humanMoves = await page
    .locator('[data-testid="human-analysis"] [data-candidate-uci]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-candidate-uci')),
    );
  const humanArrows = await page
    .locator('.suggested-arrow')
    .evaluateAll((elements) =>
      elements.map(
        (element) => element.getAttribute('data-from') + element.getAttribute('data-to'),
      ),
    );
  assert.deepEqual(
    humanArrows,
    humanMoves.map((uci) => uci.slice(0, 4)),
  );
  await arrows.uncheck();
  results.push('Suggested arrows follow the selected Maia or Stockfish source');
  const move = async (uci) => {
    await page.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
    await page.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
    if (uci.length === 5)
      await page
        .getByRole('button', {
          name: `Promuovi a ${{ q: 'donna', r: 'torre', b: 'alfiere', n: 'cavallo' }[uci[4]]}`,
          exact: true,
        })
        .click();
    await ready();
  };
  const reset = async () => {
    await page.getByRole('button', { name: 'Nuova partita', exact: true }).click();
    await ready();
  };
  await withStableBoard('refresh-maia', () =>
    page.getByRole('button', { name: 'Ricalcola analisi', exact: true }).click(),
  );
  await withStableBoard('move-e2e4', () => move('e2e4'));
  assert.equal(await page.locator('[data-testid="move-row"]').count(), 1);
  await withStableBoard('undo-e2e4', () =>
    page.getByRole('button', { name: 'Annulla mossa', exact: true }).click(),
  );
  assert.equal(await page.locator('[data-testid="move-row"]').count(), 0);
  await page.locator('[data-square="e2"] .piece').dragTo(page.locator('[data-square="e4"]'));
  await ready();
  assert.match(await page.locator('.move-list').innerText(), /e4/);
  await page.getByRole('button', { name: 'Stockfish · tattica', exact: true }).click();
  await checkStockfishPerspective('stockfish-best-black-turn');
  await page.locator('.recommendations .candidate-row').nth(1).click();
  const selectedEvaluation = await evaluationSnapshot();
  await page.getByRole('button', { name: 'Maia · umana', exact: true }).click();
  assert.equal((await evaluationSnapshot()).score, selectedEvaluation.score);
  results.push('Click move, undo and drag-and-drop');
  console.log(results.at(-1));
  if (!boardOnly) {
    await reset();
    for (const uci of ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1']) await move(uci);
    assert.match(await page.locator('.move-list').innerText(), /O-O/);
    results.push('Castling through the desktop');
    console.log(results.at(-1));
    await reset();
    for (const uci of ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']) await move(uci);
    assert.equal(await page.locator('[data-square="d5"] .piece').count(), 0);
    results.push('En passant through the desktop');
    console.log(results.at(-1));
    await reset();
    for (const uci of ['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2', 'b7a8n'])
      await move(uci);
    assert.match(
      await page.locator('[data-square="a8"]').getAttribute('aria-label'),
      /cavallo bianco/,
    );
    results.push('Underpromotion selection');
    console.log(results.at(-1));
    await reset();
    for (const uci of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1']) await move(uci);
    assert.match(await page.locator('.position-status').innerText(), /triplice ripetizione/);
    const drawnEvaluation = await checkEvaluationLayout('threefold-draw');
    assert.equal(drawnEvaluation.share, 50);
    assert.equal(drawnEvaluation.label, '½');
    assert.equal(await page.locator('[data-square="f6"]').isEnabled(), false);
    const terminalDockHeight = (await page.locator('.analysis-dock').boundingBox()).height;
    assert.ok(Math.abs(terminalDockHeight - layout.dockHeight) <= 0.5);
    await rightDraw('f6', 'g8');
    assert.equal(await page.locator('.manual-arrow').count(), 1);
    await page.keyboard.press('Escape');
    results.push('Threefold repetition from complete move history');
    await page.getByRole('button', { name: 'Computer', exact: true }).click();
    await ready();
    assert.equal(
      await page.getByRole('combobox', { name: 'Avversario', exact: true }).inputValue(),
      'maia',
    );
    await move('e2e4');
    assert.equal(await page.locator('[data-testid="move-row"]').count(), 2);
    assert.match(await page.locator('[data-testid="move-row"]').last().innerText(), /Maia-3/);
    assert.equal(await page.locator('[data-testid="opponent-analysis"]').count(), 0);
    await page.getByRole('button', { name: 'Annulla mossa', exact: true }).click();
    await ready();
    assert.equal(await page.locator('[data-testid="move-row"]').count(), 0);
    results.push('Maia sampled computer response and complete-turn undo');
    await page.getByRole('combobox', { name: 'Avversario', exact: true }).selectOption('stockfish');
    await move('e2e4');
    assert.match(await page.locator('[data-testid="move-row"]').last().innerText(), /Stockfish/);
    await page.getByRole('button', { name: 'Annulla mossa', exact: true }).click();
    await ready();
    await page.getByRole('combobox', { name: 'Avversario', exact: true }).selectOption('maia');
    await page.getByRole('combobox', { name: 'Modello Maia', exact: true }).selectOption('5m');
    await ready();
    await page.getByRole('combobox', { name: 'Rating Bianco', exact: true }).selectOption('1100');
    await ready();
    await page.getByRole('combobox', { name: 'Rating Nero', exact: true }).selectOption('1900');
    await ready();
    assert.match(await page.locator('.analysis-summary').innerText(), /Rating 1100/);
    await move('e2e4');
    assert.match(await page.locator('[data-testid="move-row"]').last().innerText(), /Maia-3/);
    await page.getByRole('button', { name: 'Annulla mossa', exact: true }).click();
    await ready();
    results.push('Stockfish alternate opponent, Maia 5M and separate white/black ratings');
  }
  if (boardOnly) {
    await withStableBoard('computer-mode', () =>
      page.getByRole('button', { name: 'Computer', exact: true }).click(),
    );
    await withStableBoard('computer-move-e2e4', () => move('e2e4'));
    assert.equal(await page.locator('[data-testid="move-row"]').count(), 2);
    await withStableBoard('computer-undo', () =>
      page.getByRole('button', { name: 'Annulla mossa', exact: true }).click(),
    );
    await page.getByRole('button', { name: 'Libera', exact: true }).click();
    await ready();
  }
  await page.getByRole('button', { name: 'Libera', exact: true }).click();
  await reset();
  for (const uci of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) await move(uci);
  assert.match(await page.locator('.position-status').innerText(), /Scacco matto/);
  const matedEvaluation = await checkEvaluationLayout('black-checkmate');
  assert.equal(matedEvaluation.share, 0);
  assert.equal(matedEvaluation.label, 'M0');
  await capture('artifacts/desktop-evaluation-mate.png');
  assert.equal(await page.locator('[data-testid="checkmate-popup"]').count(), 1);
  await page.getByRole('button', { name: 'Chiudi risultato', exact: true }).click();
  results.push(
    'Stockfish advantage bar: White perspective, rotation, source/candidate independence, updating indicator and checkmate result',
  );
  await reset();
  await page.getByRole('button', { name: 'Mostra coach', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Messaggio per Yomi' })
    .fill('Domanda di test senza account');
  await page.getByRole('button', { name: 'Invia messaggio', exact: true }).click();
  await page.waitForSelector('.chat-message.error', { timeout: 10_000 });
  assert.match(
    await page.locator('.chat-message.error').innerText(),
    /Codex CLI non è disponibile/,
  );
  await capture('artifacts/desktop-coach.png');
  results.push('Coach form and unavailable CLI fallback (no account calls)');
  await page.getByRole('button', { name: 'Mostra coach', exact: true }).click();
  await page.getByRole('button', { name: 'Libera', exact: true }).click();
  await ready();
  await page.getByRole('combobox', { name: 'Modello Maia', exact: true }).selectOption('79m');
  await ready();
  await move('e2e4');
  await capture('artifacts/desktop.png');
  await page.getByRole('button', { name: 'Partita', exact: true }).click();
  assert.equal(await page.locator('.navigator').count(), 0);
  await page.getByRole('button', { name: 'Mostra analisi', exact: true }).click();
  assert.equal(await page.locator('.analysis-body').isVisible(), false);
  assert.ok((await page.locator('.analysis-dock').boundingBox()).height <= 38);
  await page.getByRole('button', { name: 'Registro', exact: true }).click();
  await page.getByRole('button', { name: 'Mostra analisi', exact: true }).click();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700));
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok((await page.locator('.chessboard').boundingBox()).width >= 300);
  await rightDraw('e7', 'e5');
  assert.equal(await page.locator('.manual-arrow[data-from="e7"]').count(), 1);
  await capture('artifacts/desktop-compact.png');
  await page.locator('[data-square="a3"]').click();
  assert.equal(await page.locator('.manual-arrow').count(), 0);
  const boardRect = await page.locator('.chessboard').boundingBox();
  await page.mouse.move(boardRect.x + boardRect.width / 2, boardRect.y + boardRect.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(boardRect.x + boardRect.width / 2, boardRect.y - 10);
  await page.mouse.up({ button: 'right' });
  assert.equal(await page.locator('.manual-mark').count(), 0);
  assert.equal(await page.locator('.draft-mark').count(), 0);
  await page.getByRole('button', { name: 'Mostra coach', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await capture('artifacts/desktop-compact-coach.png');
  const compactCoachLayout = await page.evaluate(() => {
    const board = document.querySelector('.chessboard').getBoundingClientRect();
    const dock = document.querySelector('.analysis-dock').getBoundingClientRect();
    const toolbar = document.querySelector('.analysis-toolbar').getBoundingClientRect();
    return {
      boardWidth: board.width,
      dockHeight: dock.height,
      toolbarHeight: toolbar.height,
      height: innerHeight,
    };
  });
  assert.ok(compactCoachLayout.toolbarHeight <= 38);
  assert.ok(compactCoachLayout.boardWidth >= 300);
  await checkEvaluationLayout('compact-with-coach');
  await withStableBoard('compact-move-e7e5', () => move('e7e5'));
  await page.getByRole('button', { name: 'Stockfish · tattica', exact: true }).click();
  await withStableBoard('compact-refresh-stockfish', () =>
    page.getByRole('button', { name: 'Ricalcola analisi', exact: true }).click(),
  );
  await withStableBoard(
    'expand-analysis-notes',
    () => page.locator('.metric-note summary').click(),
    false,
  );
  await capture('artifacts/desktop-stable-analysis.png');
  results.push(
    'Board position and size remain stable throughout analysis, moves, undo, recalculation and expanded notes',
  );
  results.push(
    'Panel rails, compact layout, stable dock sizing, left-click clear and outside-board cancellation',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(artifactDirectory, 'desktop-smoke.json'),
    JSON.stringify(
      {
        platform: process.platform,
        scope: boardOnly ? 'board and workspace' : 'full desktop',
        executable: process.env.YOMI_TEST_EXECUTABLE || 'source',
        results,
        errors,
        codex: 'disabled',
        stockfish: 'real local engine',
        maia: boardOnly
          ? 'real local 79M model, CPU inference'
          : 'real local 5M and 79M models, CPU inference',
        layout,
        compactCoachLayout,
        layoutStability,
        evaluationChecks,
      },
      null,
      2,
    ),
  );
  console.log(results.join('\n'));
} catch (error) {
  const page = (await desktop.windows())[0];
  if (page) {
    console.error((await page.locator('body').innerText()).slice(0, 5000));
    await capture('artifacts/desktop-failure.png').catch(() => {});
  }
  throw error;
} finally {
  await desktop.close();
}
