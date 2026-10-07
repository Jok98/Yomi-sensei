import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const profile = await mkdtemp(path.join(tmpdir(), 'yomi-library-'));
const artifacts = process.env.YOMI_SMOKE_ARTIFACT_DIR || 'artifacts/training-library';
await mkdir(artifacts, { recursive: true });
const env = {
  ...process.env,
  YOMI_SMOKE: '1',
  YOMI_USER_DATA: profile,
  CODEX_EXECUTABLE: 'missing-yomi-library-smoke-codex',
  STOCKFISH_DEPTH: '8',
  YOMI_REVIEW_DEPTH: '8',
};
delete env.ELECTRON_RUN_AS_NODE;
const options = {
  ...(process.env.YOMI_TEST_EXECUTABLE
    ? { executablePath: process.env.YOMI_TEST_EXECUTABLE, args: [] }
    : { args: ['.'] }),
  env,
  timeout: 30000,
};
let desktop;
let page;
const errors = [];
const results = [];
const api = (route, body = {}) =>
  page.evaluate(([route, body]) => window.yomi.request(route, body), [route, body]);
const gameId = () => page.locator('[role="grid"]').getAttribute('data-game-id');
const saved = async () => {
  await page.evaluate(() => window.yomiFlush());
  return api('/api/library/open', { game_id: await gameId() });
};
const ready = async () => {
  await page.waitForFunction(() => {
    const board = document.querySelector('[role="grid"]');
    return board?.dataset.gameId && board.getAttribute('aria-busy') === 'false';
  });
  await page.waitForFunction(() => !document.querySelector('.analysis-progress'), undefined, {
    timeout: 60000,
  });
};
async function capture(name) {
  const png = await desktop.evaluate(async ({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    const options = { stayHidden: true, stayAwake: true };
    await contents.capturePage(undefined, options);
    return (await contents.capturePage(undefined, options)).toPNG().toString('base64');
  });
  await writeFile(path.join(artifacts, name), Buffer.from(png, 'base64'));
}
async function launch() {
  desktop = await electron.launch(options);
  page = await desktop.firstWindow();
  page.setDefaultTimeout(25000);
  page.on('pageerror', (error) => errors.push(error.message));
  await ready();
  // Wake the hidden compositor before Playwright's actionability checks.
  await capture('startup.png');
}
async function move(uci) {
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
}
async function showArchive() {
  if (!(await page.locator('.archive-panel').count()))
    await page.getByRole('button', { name: 'Archivio', exact: true }).click();
}
async function showGame() {
  if (!(await page.getByRole('button', { name: 'Libera', exact: true }).count()))
    await page.getByRole('button', { name: 'Partita', exact: true }).click();
}
async function draw(from, to) {
  const start = await page.locator(`[data-square="${from}"]`).boundingBox();
  const end = await page.locator(`[data-square="${to}"]`).boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 6 });
  await page.mouse.up({ button: 'right' });
}
try {
  await launch();
  const initial = await saved();
  const boardRect = await page.locator('.chessboard').boundingBox();
  const controlsRect = await page.locator('.board-controls').boundingBox();
  const barRect = await page.locator('.evaluation-bar').boundingBox();
  assert.ok(controlsRect.x > boardRect.x + boardRect.width);
  assert.ok(barRect.x + barRect.width < boardRect.x);
  await showArchive();
  await page.getByRole('button', { name: 'Importa', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Testo PGN', exact: true })
    .fill('[Event "Catture"]\n[Result "*"]\n\n1. e4 a6 2. e5 d5 3. exd6 *');
  await page.getByRole('button', { name: 'Importa e apri', exact: true }).click();
  await page.locator('.import-dialog').waitFor({ state: 'hidden' });
  await ready();
  const capturedId = await gameId();
  assert.notEqual(capturedId, initial.id);
  assert.equal(
    await page.locator('[data-testid="captures-white"]').getAttribute('data-count'),
    '1',
  );
  assert.equal(
    await page.locator('[data-testid="captures-black"]').getAttribute('data-count'),
    '0',
  );
  await capture('captures.png');
  await page.getByRole('button', { name: 'Mossa precedente', exact: true }).click();
  await ready();
  assert.equal(
    await page.locator('[data-testid="captures-white"]').getAttribute('data-count'),
    '0',
  );
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Mossa precedente', exact: true }).click();
  await ready();
  await page.getByRole('button', { name: 'Prova variante', exact: true }).click();
  await ready();
  await move('d2d4');
  await page.locator('.study-comment summary').click();
  await page
    .getByRole('textbox', { name: 'Commento alla posizione', exact: true })
    .fill('Alternativa con controllo del centro');
  await draw('d4', 'd5');
  const branch = await saved();
  assert.equal(branch.records.length, 5);
  assert.deepEqual(branch.snapshot.variations[0].moves_uci, ['d2d4']);
  const branchId = branch.snapshot.variations[0].id;
  assert.equal(branch.snapshot.comments[`${branchId}:1`], 'Alternativa con controllo del centro');
  assert.deepEqual(branch.snapshot.marks[`${branchId}:1`], [{ from: 'd4', to: 'd5' }]);
  const exported = await api('/api/library/export', { game_id: capturedId });
  assert.match(exported.pgn, /Alternativa con controllo del centro/);
  assert.match(exported.pgn, /\[%cal Rd4d5\]/);
  await capture('study-variation.png');
  await desktop.close();
  desktop = null;
  await launch();
  assert.equal(await gameId(), capturedId);
  const reopened = await saved();
  assert.equal(reopened.records.length, 5);
  assert.equal(reopened.snapshot.variations[0].id, branchId);
  await page
    .getByRole('combobox', { name: 'Variante da esplorare', exact: true })
    .selectOption(branchId);
  await ready();
  assert.equal(await page.locator('.manual-arrow[data-from="d4"]').count(), 1);
  await page.locator('.study-comment summary').click();
  assert.equal(
    await page.getByRole('textbox', { name: 'Commento alla posizione', exact: true }).inputValue(),
    'Alternativa con controllo del centro',
  );
  results.push(
    'PGN import/export, en passant captures, non-destructive history, saved variation/comments/arrows survive an actual app restart',
  );
  console.log(results.at(-1));

  await page.getByRole('button', { name: 'Nuova partita', exact: true }).click();
  await ready();
  await showGame();
  for (const uci of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) await move(uci);
  assert.equal(await page.locator('[data-testid="checkmate-popup"]').count(), 1);
  assert.match(
    await page.locator('[data-testid="checkmate-popup"]').innerText(),
    /Vince il Nero · 0-1/,
  );
  await capture('checkmate-popup.png');
  const mateId = await gameId();
  await page.getByRole('button', { name: 'Rivedi partita', exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="game-review"]')
        ?.textContent.includes('Analisi salvata'),
    undefined,
    { timeout: 60000 },
  );
  const firstReview = await api('/api/library/review', { game_id: mateId });
  assert.equal(firstReview.state, 'complete');
  assert.equal(firstReview.agent_state, 'unavailable');
  assert.equal(firstReview.agent_attempted, false);
  assert.equal(firstReview.report.points.length, 5);
  const reportTime = firstReview.report.created_at;
  assert.ok(firstReview.report.exercise_count > 0);
  await capture('saved-review.png');
  await showArchive();
  await page
    .getByRole('textbox', { name: 'Titolo partita', exact: true })
    .fill('Matto da ripassare');
  await saved();
  await page
    .getByRole('textbox', { name: 'Cerca partite', exact: true })
    .fill('Matto da ripassare');
  await page.getByRole('button', { name: 'Concluse', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="saved-game"]').length === 1,
  );
  await page.locator('[data-testid="saved-game"]').click();
  await ready();
  assert.equal(await page.locator('[data-testid="checkmate-popup"]').count(), 0);
  assert.equal(
    (await api('/api/library/review', { game_id: mateId })).report.created_at,
    reportTime,
  );
  await page.getByRole('button', { name: 'Chiedi al coach', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Messaggio per Yomi', exact: true })
    .fill('Come evito questo matto?');
  await page.getByRole('button', { name: 'Invia messaggio', exact: true }).click();
  await page.waitForSelector('.chat-message.error');
  await saved();
  assert.equal(
    (await api('/api/library/review', { game_id: mateId })).report.created_at,
    reportTime,
  );
  await page.getByRole('button', { name: 'Mostra coach', exact: true }).click();
  await page.getByRole('tab', { name: 'Allenamento', exact: true }).click();
  await page.waitForSelector('[data-testid="exercise-card"]');
  const exercises = (await api('/api/exercises/list')).exercises;
  const exercise = exercises[0];
  await page.locator('[data-testid="exercise-card"]').first().click();
  await ready();
  assert.equal(await page.locator('.evaluation-bar').getAttribute('data-state'), 'hidden');
  assert.equal(await page.locator('.suggested-arrow').count(), 0);
  await page.getByRole('button', { name: 'Suggerimento 1/3', exact: true }).click();
  assert.equal(await page.locator('.suggested-arrow').count(), 0);
  await page.getByRole('button', { name: 'Suggerimento 2/3', exact: true }).click();
  assert.equal(await page.locator('.suggested-circle').count(), 1);
  await move(exercise.best_move);
  assert.match(await page.locator('[data-testid="active-exercise"]').innerText(), /Corretto/);
  const progress = (await api('/api/exercises/list')).exercises.find(
    (item) => item.id === exercise.id,
  );
  assert.equal(progress.attempts, 1);
  assert.equal(progress.successes, 1);
  await capture('exercise.png');
  await page.getByRole('button', { name: 'Chiudi esercizio', exact: true }).click();
  await saved();
  await desktop.close();
  desktop = null;
  await launch();
  assert.equal(await gameId(), mateId);
  assert.equal(await page.locator('[data-testid="checkmate-popup"]').count(), 0);
  const persisted = await saved();
  assert.equal(persisted.review.report.created_at, reportTime);
  assert.equal(persisted.snapshot.chat.length, 2);
  assert.equal(
    (await api('/api/exercises/list')).exercises.find((item) => item.id === exercise.id).successes,
    1,
  );
  results.push(
    'Live mate popup, archive search/filter, persisted final review reused after navigation/chat/restart, and exercise hints/attempts/progress without agent account calls',
  );
  console.log(results.at(-1));

  await page.getByRole('button', { name: 'Nuova partita', exact: true }).click();
  await ready();
  await showGame();
  await page
    .getByRole('combobox', { name: 'Controllo del tempo', exact: true })
    .selectOption('60000');
  await page
    .getByRole('combobox', { name: 'Incremento orologio', exact: true })
    .selectOption('2000');
  await page.getByRole('checkbox', { name: 'Allenamento senza aiuti', exact: true }).check();
  assert.equal(await page.locator('.evaluation-bar').getAttribute('data-state'), 'hidden');
  assert.equal(await page.locator('.candidate-row').count(), 0);
  await move('e2e4');
  assert.equal(await page.locator('.player-clock').count(), 2);
  await page.getByRole('button', { name: 'Mossa precedente', exact: true }).click();
  await ready();
  const paused = await saved();
  assert.equal(paused.options.clock.paused, true);
  assert.equal(paused.options.training, true);
  await page.getByRole('button', { name: 'Torna alla partita', exact: true }).click();
  await ready();
  await page.getByRole('button', { name: 'Concludi partita', exact: true }).click();
  await page.getByRole('button', { name: 'Concludi in patta', exact: true }).click();
  await ready();
  assert.equal((await saved()).result, '1/2-1/2');
  await page.getByRole('button', { name: 'Computer', exact: true }).click();
  await ready();
  await page.getByRole('combobox', { name: 'Modello Maia', exact: true }).selectOption('5m');
  await ready();
  await page.getByRole('combobox', { name: 'Colore giocato', exact: true }).selectOption('black');
  await ready();
  assert.equal(await page.locator('[data-testid="move-row"]').count(), 1);
  assert.match(await page.locator('[data-testid="move-row"]').innerText(), /Maia-3/);
  const blackGame = await saved();
  assert.equal(blackGame.options.player_color, 'black');
  const blackMove = blackGame.frames.at(-1).legal_moves.find((item) => !item.promotion).uci;
  await page.getByRole('button', { name: 'Torna alla partita', exact: true }).click();
  await ready();
  await move(blackMove);
  assert.equal(await page.locator('[data-testid="move-row"]').count(), 3);
  await page.getByRole('button', { name: 'Annulla mossa', exact: true }).click();
  await ready();
  assert.equal(await page.locator('[data-testid="move-row"]').count(), 1);
  await capture('black-with-clock.png');
  results.push(
    'Training hides evaluation/candidates, clocks with increment pause in study, agreed draw, real Maia opening as White when the user plays Black, complete-turn undo',
  );
  await showArchive();
  await page.getByRole('button', { name: 'Importa', exact: true }).click();
  await page.getByRole('button', { name: 'Posizione FEN', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Testo FEN', exact: true })
    .fill('8/8/8/8/8/8/8/8 w - - 0 1');
  await page.getByRole('button', { name: 'Importa e apri', exact: true }).click();
  await page.waitForSelector('.import-dialog [role="alert"]');
  await page
    .getByRole('textbox', { name: 'Testo FEN', exact: true })
    .fill('1r5k/Pr6/8/8/8/8/8/7K w - - 0 1');
  await page.getByRole('button', { name: 'Importa e apri', exact: true }).click();
  await page.locator('.import-dialog').waitFor({ state: 'hidden' });
  await ready();
  await page.getByRole('button', { name: 'Torna alla partita', exact: true }).click();
  await ready();
  await move('a7b8q');
  await move('b7b8');
  assert.equal(
    await page.locator('[data-testid="captures-white"]').getAttribute('data-count'),
    '1',
  );
  assert.equal(
    await page.locator('[data-testid="captures-black"]').getAttribute('data-count'),
    '1',
  );
  assert.match(
    await page.locator('[data-testid="captures-black"] .piece-image').getAttribute('src'),
    /wQ.svg/,
  );
  const promoted = await saved();
  assert.deepEqual(
    promoted.records.map((move) => move.captured_piece),
    ['r', 'Q'],
  );
  await capture('promoted-captures.png');
  results.push(
    'FEN validation/import and actual promotion followed by capture of the promoted queen, with captured pieces shown for each side',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(artifacts, 'library-smoke.json'),
    JSON.stringify(
      {
        executable: process.env.YOMI_TEST_EXECUTABLE || 'source',
        profile,
        results,
        errors,
        codex: 'disabled; at-most-once behavior verified separately with fake agent',
        engines: 'real local Maia and Stockfish',
        reportTime,
      },
      null,
      2,
    ),
  );
  console.log(results.join('\n'));
} catch (error) {
  if (page && !page.isClosed()) {
    console.error((await page.locator('body').innerText()).slice(0, 5000));
    await capture('failure.png').catch(() => {});
  }
  throw error;
} finally {
  await desktop?.close();
}
