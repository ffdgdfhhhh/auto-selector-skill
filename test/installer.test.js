'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INSTALLER = path.join(ROOT, 'bin', 'install.js');
const { buildCommands, REPO, KEY } = require('../bin/install');

test('installer delegates to the official Claude Code marketplace', () => {
  const commands = buildCommands();

  assert.deepEqual(commands.install, [
    ['claude', ['plugin', 'marketplace', 'add', REPO]],
    ['claude', ['plugin', 'install', KEY]],
  ]);

  assert.deepEqual(commands.uninstall, [
    ['claude', ['plugin', 'uninstall', KEY]],
    ['claude', ['plugin', 'marketplace', 'remove', 'auto-selector-skill']],
  ]);

  assert.equal(REPO, 'ffdgdfhhhh/auto-selector-skill');
  assert.equal(KEY, 'auto-selector-skill@auto-selector-skill');
});

test('installer --dry-run prints commands without touching the system', () => {
  const result = spawnSync(process.execPath, [INSTALLER, '--dry-run'], {
    encoding: 'utf8',
    cwd: ROOT,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /claude plugin marketplace add ffdgdfhhhh\/auto-selector-skill/);
  assert.match(result.stdout, /claude plugin install auto-selector-skill@auto-selector-skill/);
});

test('installer help documents the official channel', () => {
  const result = spawnSync(process.execPath, [INSTALLER, '--help'], {
    encoding: 'utf8',
    cwd: ROOT,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /claude plugin marketplace add/);
  assert.doesNotMatch(result.stdout, /npx skills add/);
});
