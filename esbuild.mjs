import esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * esbuild reports errors in the form the VS Code problem matcher in
 * `.vscode/tasks.json` reads, so a failed watch build lands in the Problems
 * panel rather than only in a terminal nobody is looking at.
 *
 * @type {import('esbuild').Plugin}
 */
const problemMatcherPlugin = {
  name: 'problem-matcher',
  setup(build) {
    build.onStart(() => console.log('[watch] build started'));
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      }
      console.log('[watch] build finished');
    });
  },
};

const context = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  outfile: 'dist/extension.js',
  // `vscode` is provided by the host at runtime and must never be bundled.
  external: ['vscode'],
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: 'silent',
  plugins: [problemMatcherPlugin],
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
