'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EVAL = path.join(ROOT, 'src', 'cli', 'eval.js');

function run(args, home) {
  return spawnSync(process.execPath, [EVAL, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    env: {
      ...process.env,
      AUTO_SELECTOR_HOME: home,
      AUTO_SELECTOR_CLAUDE_DIR: path.join(home, '.claude'),
      HOME: home,
      USERPROFILE: home,
      CLAUDE_PROJECT_DIR: home,
    },
  });
}

test('eval --check fails when the index is missing, unless --allow-missing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-eval-'));

  const strict = run(['--check'], home);
  assert.equal(strict.status, 1);
  assert.match(strict.stdout, /no index found/);

  const lenient = run(['--check', '--allow-missing'], home);
  assert.equal(lenient.status, 0);
  assert.match(lenient.stdout, /was not checked/);

  fs.rmSync(home, { recursive: true, force: true });
});

test('eval baseline meets the CI fixture thresholds', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-eval-'));

  const result = run([
    '--baseline',
    '--fixture', path.join(ROOT, 'eval', 'fixtures', 'skills.json'),
    '--min-top1', '0.60',
    '--min-top3', '0.85',
  ], home);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /top-1:/);
  assert.match(result.stdout, /top-3:/);

  fs.rmSync(home, { recursive: true, force: true });
});
