import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const python = path.resolve(
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const maiaPython = path.resolve(
  '.venv-maia',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
function run(executable, args) {
  const result = spawnSync(executable, args, { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0)
    throw result.error ?? new Error(`Preparazione Maia fallita: ${result.status}`);
}
if (!existsSync(maiaPython)) run(python, ['-m', 'venv', '.venv-maia']);
if (!process.argv.includes('--models-only')) {
  run(maiaPython, [
    '-m',
    'pip',
    'install',
    'torch==2.8.0',
    '--index-url',
    'https://download.pytorch.org/whl/cpu',
  ]);
  run(maiaPython, ['-m', 'pip', 'install', '-r', 'requirements-maia.txt']);
  run(maiaPython, ['-m', 'pip', 'install', '--no-deps', './vendor/maia3']);
}
const models = [
  {
    id: '5m',
    repo: 'Maia3-5M',
    revision: 'b6559de2398d7140b985f28fd2c19fb5e47ddabe',
    sha256: 'ba14208b2992d85502f5fb501934abf6aaaeb355e9f3fdf90e326911f562524f',
  },
  {
    id: '79m',
    repo: 'Maia3-79M',
    revision: 'a107d6ceb7b298cb04ae1da4edffe2939858b894',
    sha256: '3fc6181d5db789b45a15305732148757ae74efa3e0028e81ba335b462dac45c2',
  },
];
mkdirSync('.runtime/maia/models', { recursive: true });
for (const model of models) {
  const filename = `maia3-${model.id}.pt`;
  const target = path.join('.runtime/maia/models', filename);
  const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
  if (!existsSync(target) || hash(readFileSync(target)) !== model.sha256) {
    console.log(`Download Maia-3 ${model.id} dal repository ufficiale…`);
    const response = await fetch(
      `https://huggingface.co/UofTCSSLab/${model.repo}/resolve/${model.revision}/${filename}`,
      { signal: AbortSignal.timeout(300_000) },
    );
    if (!response.ok) throw new Error(`Download Maia: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (hash(buffer) !== model.sha256)
      throw new Error(`Checksum Maia ${model.id} non corrispondente.`);
    writeFileSync(target, buffer);
  }
}
writeFileSync(
  '.runtime/maia/runtime.json',
  JSON.stringify({ upstream: '1e13597c42d4858b7cfd7cfdae01e297263364b2', models }, null, 2) + '\n',
);
console.log('Maia-3 pronto: modelli 5M e 79M locali, nessun download durante le partite.');
