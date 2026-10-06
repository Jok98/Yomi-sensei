import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const python = path.resolve(
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
function run(args) {
  const result = spawnSync(python, args, { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0)
    throw result.error ?? new Error(`Build backend fallita: ${result.status}`);
}
run(['-m', 'pip', 'install', '-r', 'requirements-build.txt']);
run([
  '-m',
  'PyInstaller',
  '--noconfirm',
  '--clean',
  '--onefile',
  '--name',
  'yomi-backend',
  '--distpath',
  '.runtime/backend',
  '--workpath',
  '.runtime/pyinstaller',
  '--specpath',
  '.runtime',
  '--paths',
  '.',
  '--collect-submodules',
  'uvicorn',
  'app/desktop.py',
]);
mkdirSync('.runtime/stockfish', { recursive: true });
writeFileSync(
  '.runtime/backend/README.txt',
  'Yomi Sensei backend locale. Generato con PyInstaller da app/desktop.py.\n',
);
