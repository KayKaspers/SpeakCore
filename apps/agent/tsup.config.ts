import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Workspace-Pakete in das Bundle einbinden (self-contained Runtime, keine externen Deps).
  noExternal: [/^@speakcore\//],
});
