import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Runs the Angular unit tests.
 *
 * Vite (used by the Angular unit-test builder) treats `#` as a URL fragment, so a checkout under a
 * path such as `.../Dev/C#/...` cannot be served by its module runner. When the path contains URL
 * special characters this script mirrors the workspace into a temporary directory first; on a
 * normal path it runs in place. CI checkouts have no `#`, so CI always runs in place.
 */
const projectRoot = process.cwd();
const MIRRORED_ENTRIES = [
  'angular.json',
  'package.json',
  'tsconfig.json',
  'projects',
  'scripts',
  'samples',
  'vendor',
  'node_modules',
];

function runTests(cwd, args) {
  const cli = join(cwd, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  const result = spawnSync(process.execPath, [cli, 'test', 'authkit', ...args], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

if (!/[#?%]/.test(projectRoot)) {
  process.exit(runTests(projectRoot, process.argv.slice(2)));
}

const mirror = mkdtempSync(join(tmpdir(), 'authkit-angular-test-'));

try {
  for (const entry of MIRRORED_ENTRIES) {
    cpSync(join(projectRoot, entry), join(mirror, entry), { recursive: true });
  }
  process.exitCode = runTests(mirror, process.argv.slice(2));
} finally {
  rmSync(mirror, { recursive: true, force: true });
}
