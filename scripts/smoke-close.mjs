import { _electron as electron } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const profile = await mkdtemp(path.join(tmpdir(), 'yomi-close-'));
const env = {
  ...process.env,
  YOMI_SMOKE: '1',
  YOMI_USER_DATA: profile,
  CODEX_EXECUTABLE: 'missing-yomi-close-codex',
  STOCKFISH_DEPTH: '8',
};
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await electron.launch({
  ...(process.env.YOMI_TEST_EXECUTABLE
    ? { executablePath: process.env.YOMI_TEST_EXECUTABLE, args: [] }
    : { args: ['.'] }),
  env,
});
try {
  const page = await desktop.firstWindow();
  await page.waitForFunction(() => document.querySelector('[role="grid"]')?.dataset.gameId);
  await page.evaluate(() => {
    const original = window.yomiFlush;
    window.yomiFlush = () =>
      new Promise((resolve, reject) => {
        window.finishCloseProbe = () => original().then(resolve, reject);
        window.failCloseProbe = () => reject(new Error('Errore di salvataggio simulato'));
      });
  });
  let failureTimer;
  const failed = new Promise((resolve, reject) => {
    failureTimer = setTimeout(
      () => reject(new Error('Main non ha ricevuto il fallimento del salvataggio')),
      5000,
    );
    const listener = (chunk) => {
      if (chunk.toString().includes('Errore di salvataggio simulato')) {
        desktop.process().stderr.off('data', listener);
        clearTimeout(failureTimer);
        resolve();
      }
    };
    desktop.process().stderr.on('data', listener);
  });
  const stayedOpen = await desktop.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.close();
    window.close();
    return !window.isDestroyed();
  });
  assert.equal(stayedOpen, true);
  await page.waitForFunction(() => window.failCloseProbe);
  await page.evaluate(() => window.failCloseProbe());
  await failed;
  assert.equal(
    await desktop.evaluate(({ BrowserWindow }) => !BrowserWindow.getAllWindows()[0].isDestroyed()),
    true,
  );
  await page.evaluate(() => {
    delete window.finishCloseProbe;
    delete window.failCloseProbe;
  });
  // Retry a genuine save after the simulated failure, keeping the probe deferred.
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await page.waitForFunction(() => window.finishCloseProbe);
  await page.evaluate(() => window.finishCloseProbe());
  console.log(
    'Repeated close keeps the renderer alive while saving; failed flush remains retryable; successful flush permits exit.',
  );
} finally {
  await desktop.close();
}
