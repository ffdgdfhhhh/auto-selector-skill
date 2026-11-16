'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'src', 'hooks', 'blacklist.js');

function run(home, args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, AUTO_SELECTOR_HOME: home, HOME: home, USERPROFILE: home },
  });
}

test('blacklist CLI: add, dedupe (case-insensitive), list, remove', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-blacklist-'));
  const file = path.join(home, '.auto-selector-skill-blacklist.json');

  assert.equal(run(home, ['add', 'Skill-A']).status, 0);
  assert.equal(run(home, ['add', 'skill-a']).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), ['Skill-A']);

  assert.equal(run(home, ['add', 'other']).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), ['Skill-A', 'other']);

  const listed = run(home, ['list']);
  assert.match(listed.stdout, /Skill-A/);
  assert.match(listed.stdout, /other/);

  assert.equal(run(home, ['remove', 'SKILL-A']).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), ['other']);

  fs.rmSync(home, { recursive: true, force: true });
});

test('blacklist CLI: remove reports a broader entry instead of a false success', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-blacklist-'));
  const file = path.join(home, '.auto-selector-skill-blacklist.json');

  assert.equal(run(home, ['add', 'hyperframes']).status, 0);

  const result = run(home, ['remove', 'hyperframes-audio']);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /hidden by blacklist entry "hyperframes"/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), ['hyperframes']);

  fs.rmSync(home, { recursive: true, force: true });
});

test('blacklist CLI: corrupted file is backed up and reset', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-blacklist-'));
  const file = path.join(home, '.auto-selector-skill-blacklist.json');
  fs.writeFileSync(file, '{not json');

  const result = run(home, ['add', 'alpha']);
  assert.equal(result.status, 0);
  assert.ok(fs.existsSync(file + '.bak'));
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), ['alpha']);

  fs.rmSync(home, { recursive: true, force: true });
});
