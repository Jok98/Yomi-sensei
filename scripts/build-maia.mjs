import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const python = path.resolve(
  '.venv-maia',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
if (!existsSync(python))
  throw new Error('Prepara Maia con pnpm prepare:runtime prima della build.');
const result = spawnSync(
  python,
  [
    '-m',
    'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onedir',
    '--name',
    'yomi-maia',
    '--distpath',
    '.runtime/maia/worker',
    '--workpath',
    '.runtime/pyinstaller-maia',
    '--specpath',
    '.runtime',
    '--collect-submodules',
    'maia3',
    '--exclude-module',
    'tkinter',
    '--exclude-module',
    'matplotlib',
    '--exclude-module',
    'scipy',
    '--exclude-module',
    'pandas',
    '--exclude-module',
    'pytest',
    'app/maia_worker.py',
  ],
  { stdio: 'inherit', windowsHide: true },
);
if (result.error || result.status !== 0)
  throw result.error ?? new Error(`Build Maia fallita: ${result.status}`);
mkdirSync('.runtime/maia/source/vendor', { recursive: true });
cpSync('vendor/maia3/maia3', '.runtime/maia/source/vendor/maia3', {
  recursive: true,
  filter: (file) => !file.includes('__pycache__'),
});
for (const file of ['LICENSE', 'UPSTREAM.md', 'README.md', 'pyproject.toml'])
  cpSync(`vendor/maia3/${file}`, `.runtime/maia/source/vendor/${file}`);
cpSync('app/maia_worker.py', '.runtime/maia/source/maia_worker.py');
cpSync('requirements-maia.txt', '.runtime/maia/source/requirements-maia.txt');
cpSync('constraints-maia.txt', '.runtime/maia/source/constraints-maia.txt');
