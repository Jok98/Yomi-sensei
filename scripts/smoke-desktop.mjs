import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const profile = await mkdtemp(path.join(tmpdir(), 'yomi-smoke-'));
await mkdir('artifacts', { recursive: true });
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
async function capture(file) {
  const data = await desktop.evaluate(async ({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    const options = { stayHidden: true, stayAwake: true };
    await contents.capturePage(undefined, options);
    return (await contents.capturePage(undefined, options)).toPNG().toString('base64');
  });
  await writeFile(file, Buffer.from(data, 'base64'));
}
try {
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('[data-square="e2"]', { timeout: 30_000 });
  const ready = async () => {
    await page.waitForFunction(
      () => document.querySelector('[role="grid"]')?.getAttribute('aria-busy') === 'false',
    );
    await page.waitForFunction(() => !document.querySelector('.analysis-progress'), undefined, {
      timeout: 45_000,
    });
  };
  await ready();
  console.log('Desktop ready');
  assert.equal(await page.locator('[role="gridcell"]').count(), 64);
  assert.equal(await page.locator('.candidate-row.active').count(), 1);
  assert.equal(await page.locator('[data-testid="opponent-analysis"] .candidate-row').count(), 3);
  assert.equal(await page.locator('[data-testid="human-analysis"] .human-candidate').count(), 3);
  assert.match(await page.locator('[data-testid="human-analysis"]').innerText(), /scelta umana/);
  assert.match(await page.locator('[data-testid="human-analysis"]').innerText(), /Stockfish/);
  results.push('Startup, real Maia-3 79M policy and Stockfish evaluations, visible human replies');
  await capture('artifacts/desktop-maia.png');
  await page.getByRole('button', { name: 'Stockfish · tattica', exact: true }).click();
  assert.equal(await page.locator('.candidate-row.active').count(), 1);
  assert.equal(await page.locator('[data-testid="opponent-analysis"] .candidate-row').count(), 3);
  await capture('artifacts/desktop-stockfish.png');
  await page.getByRole('button', { name: 'Maia · umana', exact: true }).click();
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
  await move('e2e4');
  assert.equal(await page.locator('[data-testid="move-row"]').count(), 1);
  await page.getByRole('button', { name: 'Annulla mossa', exact: true }).click();
  await ready();
  assert.equal(await page.locator('[data-testid="move-row"]').count(), 0);
  await page.locator('[data-square="e2"] .piece').dragTo(page.locator('[data-square="e4"]'));
  await ready();
  assert.match(await page.locator('.move-list').innerText(), /e4/);
  results.push('Click move, undo and drag-and-drop');
  console.log(results.at(-1));
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
  assert.equal(await page.locator('[data-square="f6"]').isEnabled(), false);
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
  await page.getByRole('tab', { name: 'Coach', exact: true }).click();
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
  await page.getByRole('tab', { name: 'Analisi', exact: true }).click();
  await page.getByRole('button', { name: 'Libera', exact: true }).click();
  await ready();
  await page.getByRole('combobox', { name: 'Modello Maia', exact: true }).selectOption('79m');
  await ready();
  await move('e2e4');
  await capture('artifacts/desktop.png');
  await page.getByRole('button', { name: 'Partita', exact: true }).click();
  assert.equal(await page.locator('.navigator').count(), 0);
  await page.getByRole('button', { name: 'Mostra analisi', exact: true }).click();
  assert.equal(await page.locator('.inspector').count(), 0);
  await page.getByRole('button', { name: 'Registro', exact: true }).click();
  await page.getByRole('button', { name: 'Mostra analisi', exact: true }).click();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700));
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await capture('artifacts/desktop-compact.png');
  results.push('Panel rails and compact layout');
  assert.deepEqual(errors, []);
  await writeFile(
    'artifacts/desktop-smoke.json',
    JSON.stringify(
      {
        platform: process.platform,
        executable: process.env.YOMI_TEST_EXECUTABLE || 'source',
        results,
        errors,
        codex: 'disabled',
        stockfish: 'real local engine',
        maia: 'real local 5M and 79M models, CPU inference',
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
