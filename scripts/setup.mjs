import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const python = path.join(
  root,
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0)
    throw result.error ?? new Error(`${command}: uscita ${result.status}`);
}
if (!existsSync(python)) {
  const candidates = process.env.YOMI_PYTHON
    ? [[process.env.YOMI_PYTHON, []]]
    : process.platform === 'win32'
      ? [
          ['py', ['-3']],
          ['python', []],
        ]
      : [['python3', []]];
  const found = candidates.find(
    ([command, args]) =>
      spawnSync(command, [...args, '-c', 'import sys; assert sys.version_info >= (3, 11)'], {
        windowsHide: true,
        stdio: 'ignore',
      }).status === 0,
  );
  if (!found) throw new Error('Installa Python 3.11+ oppure imposta YOMI_PYTHON.');
  run(found[0], [...found[1], '-m', 'venv', '.venv']);
}
run(python, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
mkdirSync('.runtime/stockfish', { recursive: true });
if (process.platform === 'win32' && process.arch === 'x64') {
  const marker = '.runtime/stockfish/release.json';
  if (!existsSync(marker)) {
    const url =
      'https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-windows-x86-64-universal.zip';
    const sha256 = '3c8bf1f9ea66a09350a40df4f632288285ac206d99f33ab5842c408fc30b48a7';
    console.log('Download Stockfish 19 dal repository ufficiale…');
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`Download Stockfish: HTTP ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(archive).digest('hex') !== sha256)
      throw new Error('Checksum Stockfish non corrispondente.');
    writeFileSync('.runtime/stockfish.zip', archive);
    run(python, ['-m', 'zipfile', '-e', '.runtime/stockfish.zip', '.runtime/stockfish']);
    writeFileSync(marker, JSON.stringify({ version: '19', url, sha256 }, null, 2) + '\n');
  }
} else console.log('Configura STOCKFISH_PATH con il motore installato sul tuo sistema.');
run(process.execPath, ['node_modules/electron/install.js']);
run(process.execPath, ['scripts/setup-maia.mjs']);
console.log('Runtime pronto. Avvia con pnpm build e pnpm start.');
