import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { API_ROUTES, type ApiRoute } from '../shared/types';

export function findStockfish(directory: string): string | undefined {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isFile() && /^stockfish.*\.exe$/i.test(entry.name)) return file;
    if (entry.isDirectory()) {
      const found = findStockfish(file);
      if (found) return found;
    }
  }
}
export function validateRequest(route: unknown, body: unknown): asserts route is ApiRoute {
  if (typeof route !== 'string' || !API_ROUTES.includes(route as ApiRoute))
    throw new Error('Operazione non consentita.');
  const limit =
    route === '/api/library/save' ? 1_500_000 : route === '/api/library/import' ? 260_000 : 160_000;
  if (JSON.stringify(body ?? null).length > limit) throw new Error('Richiesta troppo grande.');
}
export class Backend {
  private process: ChildProcessWithoutNullStreams | null = null;
  private token = randomBytes(32).toString('hex');
  private port = 0;
  private error = '';
  private closing = false;
  constructor(
    private root: string,
    private resources?: string,
    private dataDirectory?: string,
  ) {}

  async start() {
    const packaged =
      this.resources &&
      path.join(
        this.resources,
        'backend',
        process.platform === 'win32' ? 'yomi-backend.exe' : 'yomi-backend',
      );
    const python =
      process.env.YOMI_PYTHON ||
      path.join(
        this.root,
        '.venv',
        process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
      );
    const executable = packaged || python;
    if (!existsSync(executable))
      throw new Error(
        'Runtime Python non disponibile. Esegui la preparazione indicata nel README e riapri Yomi.',
      );
    const stockfish =
      process.env.STOCKFISH_PATH ||
      findStockfish(path.join(this.resources ?? path.join(this.root, '.runtime'), 'stockfish'));
    const maiaRuntime = path.join(this.resources ?? path.join(this.root, '.runtime'), 'maia');
    const maiaWorker = path.join(
      maiaRuntime,
      'worker',
      'yomi-maia',
      process.platform === 'win32' ? 'yomi-maia.exe' : 'yomi-maia',
    );
    const child = spawn(executable, packaged ? [] : ['-u', '-m', 'app.desktop'], {
      cwd: this.root,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONUNBUFFERED: '1',
        YOMI_DESKTOP_TOKEN: this.token,
        ...(this.dataDirectory ? { YOMI_DATA_DIR: this.dataDirectory } : {}),
        MAIA_RUNTIME_DIR: process.env.MAIA_RUNTIME_DIR || maiaRuntime,
        ...(this.resources ? { MAIA_WORKER_PATH: maiaWorker } : {}),
        ...(stockfish ? { STOCKFISH_PATH: stockfish } : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.process = child;
    child.stderr.on('data', (chunk) => {
      this.error = (this.error + String(chunk)).slice(-4000);
    });
    const announced = new Promise<number>((resolve, reject) => {
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += String(chunk);
        const line = output.split(/\r?\n/).find((line) => line.startsWith('YOMI_BACKEND '));
        if (line) {
          try {
            resolve(JSON.parse(line.slice(13)).port);
          } catch {
            /* Wait for the complete line. */
          }
        }
      });
      child.once('error', reject);
      child.once('exit', () =>
        reject(new Error(this.error || 'Il servizio locale si è arrestato.')),
      );
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      this.port = await Promise.race([
        announced,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Avvio del servizio locale scaduto.')), 20_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null)
        throw new Error(this.error || 'Il servizio locale si è arrestato.');
      try {
        await this.request('/api/game/new');
        return;
      } catch {
        await delay(100);
      }
    }
    throw new Error('Il servizio locale non è pronto. ' + this.error.slice(-600));
  }

  async request(route: ApiRoute, body?: unknown): Promise<unknown> {
    validateRequest(route, body);
    if (this.closing || !this.port || this.process?.exitCode !== null)
      throw new Error('Servizio locale non disponibile. Riapri Yomi Sensei.');
    const response = await fetch(`http://127.0.0.1:${this.port}${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Yomi-Token': this.token },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    const data = (await response.json()) as { detail?: unknown };
    if (!response.ok) {
      const detail = Array.isArray(data.detail)
        ? data.detail.map((item) => item.msg).join(' · ')
        : data.detail;
      throw new Error(
        typeof detail === 'string' ? detail : `Servizio locale: errore ${response.status}`,
      );
    }
    return data;
  }

  async close() {
    this.closing = true;
    const child = this.process;
    if (!child || child.exitCode !== null || !child.pid) return;
    child.stdin.end();
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      delay(3000),
    ]);
    if (child.exitCode === null) {
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        await new Promise<void>((resolve) => {
          killer.once('exit', () => resolve());
          killer.once('error', () => resolve());
        });
      } else child.kill('SIGTERM');
    }
  }
}
