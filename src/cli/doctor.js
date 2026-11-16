#!/usr/bin/env node
'use strict';
// Health check: index integrity, state, hooks, blacklist, freshness.
// Usage: node src/cli/doctor.js [--json] [--no-scan]

const fs = require('fs');
const path = require('path');
const {
  getHome,
  getClaudeDir,
  getIndexPaths,
  readJson,
  readBlacklistState,
  scanSkills,
} = require('../lib/scan');

const HOME = getHome();
const PATHS = getIndexPaths(getClaudeDir());
const INDEX_PATH = PATHS.indexPath;
const STATE_PATH = PATHS.statePath;
const CONFIG_PATH = PATHS.configPath;

const checks = [];
const ok = (name, detail = '') => checks.push({ status: 'ok', name, detail });
const warn = (name, detail = '') => checks.push({ status: 'warn', name, detail });
const fail = (name, detail = '') => {
  checks.push({ status: 'fail', name, detail });
  return null;
};

function sameProject(a, b) {
  const left = path.resolve(String(a || ''));
  const right = path.resolve(String(b || ''));
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) ok('node', `v${process.versions.node}`);
  else fail('node', `v${process.versions.node} (need >=18)`);
}

function checkPackage() {
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  const pkg = readJson(pkgPath, null);
  if (!pkg) return fail('package.json', 'unreadable');
  ok('package.json', `v${pkg.version}`);
  return pkg.version;
}

function checkPluginManifest() {
  const manifestPath = path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json');
  const manifest = readJson(manifestPath, null);
  if (!manifest) return fail('plugin.json', 'unreadable');
  const hooks = manifest.hooks || {};
  const hasStart = Array.isArray(hooks.SessionStart) && hooks.SessionStart.length > 0;
  const hasPrompt = Array.isArray(hooks.UserPromptSubmit) && hooks.UserPromptSubmit.length > 0;
  if (hasStart && hasPrompt) ok('hooks', 'SessionStart + UserPromptSubmit');
  else fail('hooks', `SessionStart=${hasStart} UserPromptSubmit=${hasPrompt}`);
}

// plugin.json, marketplace.json and package.json must agree on one version.
function checkVersions(pkgVersion) {
  const root = path.join(__dirname, '..', '..');
  const plugin = readJson(path.join(root, '.claude-plugin', 'plugin.json'), null);
  const market = readJson(path.join(root, '.claude-plugin', 'marketplace.json'), null);
  if (!plugin) return fail('plugin.version', 'plugin.json unreadable');
  if (!market) return fail('marketplace.version', 'marketplace.json unreadable');

  const entry = Array.isArray(market.plugins)
    ? market.plugins.find(p => p && p.name === plugin.name)
    : null;
  const pairs = [
    ['plugin.version', plugin.version],
    ['marketplace.version', entry && entry.version],
  ];

  let problems = 0;
  for (const [name, value] of pairs) {
    if (!value) {
      fail(name, 'missing');
      problems++;
    } else if (pkgVersion && value !== pkgVersion) {
      fail(name, `${value} != package ${pkgVersion}`);
      problems++;
    }
  }
  if (problems === 0) ok('versions', `plugin + marketplace = ${pkgVersion}`);
}

function checkIndex(pkgVersion) {
  const index = readJson(INDEX_PATH, null);
  if (!index || !Array.isArray(index.categories)) {
    return fail('index', `missing or invalid (${INDEX_PATH})`);
  }

  if (pkgVersion && index.version !== pkgVersion) {
    warn('index.version', `${index.version} != package ${pkgVersion}`);
  } else {
    ok('index.version', index.version);
  }

  if (index.projectDir && !sameProject(index.projectDir, PATHS.projectDir)) {
    warn('index.project', `${index.projectDir} != current ${PATHS.projectDir}`);
  }

  if (!index.totalSkills) {
    warn('index', 'empty (no skills found)');
  }

  const sum = index.categories.reduce((n, c) => n + c.skillCount, 0);
  const names = Array.isArray(index.skillNames) ? index.skillNames.length : -1;
  if (index.totalSkills === sum && index.totalSkills === names) {
    ok('index.counts', `${index.totalSkills} skills / ${index.categories.length} categories`);
  } else {
    fail('index.counts', `total=${index.totalSkills} sum=${sum} names=${names}`);
  }

  let missing = 0;
  for (const c of index.categories) {
    if (!c.detailFile || !fs.existsSync(c.detailFile)) missing++;
  }
  if (missing === 0) ok('detail files', `${index.categories.length}/${index.categories.length}`);
  else fail('detail files', `${missing} missing`);

  if (index.stats) {
    ok('scan stats',
      `raw=${index.stats.raw} unique=${index.stats.unique} ` +
      `merged=${index.stats.duplicatesMerged} disabledPlugins=${index.stats.pluginsSkipped}`);
  }

  return index;
}

function checkState(index) {
  const state = readJson(STATE_PATH, null);
  if (!state) return warn('state', 'missing (manual run will RESTART)');
  const projectMatch = !state.projectDir ||
    !index.projectDir ||
    sameProject(state.projectDir, index.projectDir);
  if (state.totalSkills === index.totalSkills &&
      state.version === index.version &&
      projectMatch) {
    ok('state', `activated ${state.activatedAt}`);
  } else {
    warn('state', `stale (${state.totalSkills}/${state.version})`);
  }
}

function checkConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return ok('config', 'defaults (compact rules)');
  const cfg = readJson(CONFIG_PATH, null);
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return fail('config', 'invalid JSON object');
  }

  const problems = [];
  if (cfg.rules !== undefined && cfg.rules !== 'compact' && cfg.rules !== 'full') {
    problems.push('rules');
  }
  if (cfg.maxCandidates !== undefined &&
      (!Number.isInteger(cfg.maxCandidates) || cfg.maxCandidates < 1 || cfg.maxCandidates > 3)) {
    problems.push('maxCandidates');
  }
  const overrides = cfg.categoryOverrides;
  if (overrides !== undefined &&
      (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) ||
       Object.values(overrides).some(v => typeof v !== 'string' || !v.trim()))) {
    problems.push('categoryOverrides');
  }

  if (problems.length) return fail('config', `invalid: ${problems.join(', ')}`);
  ok('config', JSON.stringify(cfg));
}

function checkBlacklist() {
  const state = readBlacklistState(HOME);
  if (state.error) return fail('blacklist', 'invalid JSON');
  ok('blacklist', `${state.list.length} entries`);
}

function checkFreshness(index, enabled) {
  if (!enabled) return;
  try {
    const { skills } = scanSkills();
    const scanNames = new Set(skills.map(s => s.name));
    const indexNames = new Set(Array.isArray(index.skillNames) ? index.skillNames : []);
    const added = [...scanNames].filter(n => !indexNames.has(n));
    const removed = [...indexNames].filter(n => !scanNames.has(n));

    if (skills.length === index.totalSkills && added.length === 0 && removed.length === 0) {
      ok('freshness', `index matches scan (${skills.length})`);
    } else {
      warn('freshness',
        `scan=${skills.length} index=${index.totalSkills} ` +
        `added=${added.length} removed=${removed.length} (run --manual to PARSE)`);
    }
  } catch (e) {
    warn('freshness', e.message);
  }
}

function main() {
  const json = process.argv.includes('--json');
  const noScan = process.argv.includes('--no-scan');

  checkNode();
  const version = checkPackage();
  checkPluginManifest();
  if (version) checkVersions(version);
  const index = checkIndex(version);
  if (index) {
    checkState(index);
    checkConfig();
    checkBlacklist();
    checkFreshness(index, !noScan);
  }

  if (json) {
    console.log(JSON.stringify({ ok: !checks.some(c => c.status === 'fail'), checks }, null, 2));
  } else {
    for (const c of checks) {
      const icon = c.status === 'ok' ? '✔' : c.status === 'warn' ? '⚠' : '✘';
      console.log(`${icon} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    }
    const failed = checks.filter(c => c.status === 'fail').length;
    const warned = checks.filter(c => c.status === 'warn').length;
    console.log(`\n${failed === 0 ? 'OK' : 'FAILED'} — ${failed} fail, ${warned} warn`);
  }

  process.exit(checks.some(c => c.status === 'fail') ? 1 : 0);
}

main();
