import { build } from 'esbuild';
import { build as buildUI } from 'vite';
await Promise.all(
  ['main', 'preload'].map((name) =>
    build({
      entryPoints: [`src/desktop/${name}.ts`],
      outfile: `dist/${name}.cjs`,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron'],
    }),
  ),
);
await buildUI();
