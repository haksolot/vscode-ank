import { defineConfig } from '@vscode/test-cli';

/**
 * Where the tests run.
 *
 * By default the runner downloads a stable VS Code, which is what CI does.
 * Behind a proxy that blocks `update.code.visualstudio.com` there is nothing
 * to download and nothing worth working around, so `ANK_TEST_VSCODE` points at
 * an installation already on the machine. It is read from the environment
 * rather than written here because a checked-in path would be one developer's.
 */
const installed = process.env.ANK_TEST_VSCODE;

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  // This repository carries a corpus of its own, so the integration tests run
  // against a real one rather than against a fixture that would drift.
  workspaceFolder: '.',
  ...(installed ? { useInstallation: { fromPath: installed } } : { version: 'stable' }),
  mocha: { ui: 'tdd', timeout: 60_000 },
});
