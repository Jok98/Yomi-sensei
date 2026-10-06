import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { createServer } from 'vite';
import electron from 'electron';
await Promise.all(
  ['main', 'preload'].map((name) =>
    build({
      entryPoints: [`src/desktop/${name}.ts`],
      outfile: `dist/${name}.cjs`,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['electron'],
    }),
  ),
);
const server = await createServer();
await server.listen();
const env = { ...process.env, YOMI_DEV_URL: 'http://127.0.0.1:5174' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { env, stdio: 'inherit', windowsHide: true });
child.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
