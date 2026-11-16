'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCTOR = path.join(ROOT, 'src', 'cli', 'doctor.js');
const ACTIVATE = path.join(ROOT, 'src', 'hooks', 'selector-activate.js');

function makeFixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-doctor-'));
  const claude = path.join(home, '.claude');
  const skillDir = path.join(claude, 'skills', 'alpha');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: alpha\ndescription: Local alpha\n---\nbody\n'
  );

  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'as-doctor-proj-'));
  return { home, claude, project };
}

function envFor(fx) {
  return {
    ...process.env,
    AUTO_SELECTOR_HOME: fx.home,
    AUTO_SELECTOR_CLAUDE_DIR: fx.claude,
    HOME: fx.home,
    USERPROFILE: fx.home,
    CLAUDE_PROJECT_DIR: fx.project,
  };
}

function run(script, args, fx) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: envFor(fx),
    cwd: ROOT,
  });
}

function cleanup(fx) {
  fs.rmSync(fx.home, { recursive: true, force: true });
  fs.rmSync(fx.project, { recursive: true, force: true });
}

test('doctor fails with a missing index and passes after activation', () => {
  const fx = makeFixture();

  const missing = run(DOCTOR, ['--json', '--no-scan'], fx);
  assert.equal(missing.status, 1);
  const missingReport = JSON.parse(missing.stdout);
  assert.equal(missingReport.ok, false);
  assert.ok(missingReport.checks.some(c => c.name === 'index' && c.status === 'fail'));

  assert.equal(run(ACTIVATE, [], fx).status, 0);

  const healthy = run(DOCTOR, ['--json', '--no-scan'], fx);
  assert.equal(healthy.status, 0, healthy.stdout);
  const report = JSON.parse(healthy.stdout);
  assert.equal(report.ok, true);
  assert.ok(report.checks.some(c => c.name === 'versions' && c.status === 'ok'));

  cleanup(fx);
});

test('doctor rejects invalid config values', () => {
  const fx = makeFixture();
  assert.equal(run(ACTIVATE, [], fx).status, 0);

  fs.mkdirSync(path.join(fx.claude, 'auto-selector'), { recursive: true });
  fs.writeFileSync(
    path.join(fx.claude, 'auto-selector', 'config.json'),
    JSON.stringify({ rules: 'bogus', maxCandidates: 9, categoryOverrides: { a: 3 } })
  );

  const result = run(DOCTOR, ['--json', '--no-scan'], fx);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const config = report.checks.find(c => c.name === 'config');
  assert.equal(config.status, 'fail');
  assert.match(config.detail, /rules/);
  assert.match(config.detail, /maxCandidates/);
  assert.match(config.detail, /categoryOverrides/);

  cleanup(fx);
});

test('doctor detects renames even when the skill count is unchanged', () => {
  const fx = makeFixture();
  assert.equal(run(ACTIVATE, [], fx).status, 0);

  // Rename alpha → omega: same count, different name set.
  const claudeSkills = path.join(fx.claude, 'skills');
  fs.renameSync(path.join(claudeSkills, 'alpha'), path.join(claudeSkills, 'omega'));
  fs.writeFileSync(
    path.join(claudeSkills, 'omega', 'SKILL.md'),
    '---\nname: omega\ndescription: Local omega\n---\nbody\n'
  );

  const result = run(DOCTOR, ['--json'], fx);
  const report = JSON.parse(result.stdout);
  const freshness = report.checks.find(c => c.name === 'freshness');
  assert.equal(freshness.status, 'warn');
  assert.match(freshness.detail, /added=1 removed=1/);

  cleanup(fx);
});
