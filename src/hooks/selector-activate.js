#!/usr/bin/env node
'use strict';
// auto-selector-skill — SessionStart hook + manual refresh.
//   node selector-activate.js            → hook JSON (rebuild index)
//   node selector-activate.js --manual   → PARSE / RESTART / NOOP report

const path = require('path');
const {
  getClaudeDir,
  getIndexPaths,
  readJson,
  writeJsonAtomic,
  scanSkills,
  buildIndexData,
} = require('../lib/scan');
const { sanitize } = require('../lib/sanitize');

const PATHS = getIndexPaths(getClaudeDir());
const INDEX_PATH = PATHS.indexPath;
const CATEGORIES_DIR = PATHS.categoriesDir;
const STATE_PATH = PATHS.statePath;

function readVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = readJson(pkgPath, null);
    if (pkg && pkg.version) return pkg.version;
  } catch (e) {}
  return '0.0.0';
}

function readIndex() {
  const index = readJson(INDEX_PATH, null);
  return index && Array.isArray(index.categories) ? index : null;
}

function readState() {
  return readJson(STATE_PATH, null);
}

function writeState(index) {
  writeJsonAtomic(STATE_PATH, {
    version: index.version,
    totalSkills: index.totalSkills,
    totalCategories: index.totalCategories,
    projectDir: index.projectDir,
    activatedAt: new Date().toISOString(),
  });
}

function buildContext(index) {
  const detailList = index.categories.map(c =>
    `• ${sanitize(c.name, 80)} (${c.skillCount} skills) — 详情文件: ${sanitize(path.basename(c.detailFile), 120)}`
  ).join('\n');

  return `<EXTREMELY_IMPORTANT>
You have auto-selector-skill v${sanitize(index.version, 20)} active. Routing rules are injected with each user message.

**可用 skill 大类（共 ${index.totalCategories} 个 / ${index.totalSkills} 个 skill）：**

${detailList}

详细文件目录：${sanitize(CATEGORIES_DIR, 400)}
</EXTREMELY_IMPORTANT>`;
}

function buildIndex(scan) {
  return buildIndexData(scan.skills, {
    version: readVersion(),
    blacklistCount: scan.blacklist.length,
    categoriesDir: CATEGORIES_DIR,
    projectDir: scan.projectDir,
    categoryOverrides: scan.categoryOverrides,
    writeDetails: true,
    stats: scan.stats,
  });
}

// SessionStart: always rescan and rebuild.
function runHook() {
  try {
    const scan = scanSkills();
    const index = buildIndex(scan);
    writeJsonAtomic(INDEX_PATH, index);
    writeState(index);

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: buildContext(index),
      },
    }));
  } catch (e) {
    console.error(`[auto-selector] Activation failed: ${e.message}`);
    // Never break the session: emit a minimal but valid hook payload.
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          `<EXTREMELY_IMPORTANT>auto-selector-skill failed to build its index: ${e.message}\n` +
          'Routing rules are still injected; run "node src/cli/doctor.js" to diagnose.</EXTREMELY_IMPORTANT>',
      },
    }));
  }
}

// Manual invocation:
//   count mismatch → PARSE, equal but not activated → RESTART, else NOOP.
function runManual() {
  const version = readVersion();
  const lines = [`AUTO_SELECTOR v${version}`];

  try {
    const scan = scanSkills();
    const { skills } = scan;
    const scanCount = skills.length;
    const index = readIndex();

    const indexCount = index ? index.totalSkills : 0;
    const indexNames = new Set(index && Array.isArray(index.skillNames) ? index.skillNames : []);
    const scanNames = new Set(skills.map(s => s.name));
    // Count alone misses renames and swaps; compare the name set as well.
    const namesDiffer = index && Array.isArray(index.skillNames) &&
      (indexNames.size !== scanNames.size ||
       [...scanNames].some(n => !indexNames.has(n)));
    const needsParse = !index ||
      scanCount !== indexCount ||
      index.version !== version ||
      namesDiffer;

    if (needsParse) {
      let added = [];
      let removed = [];
      if (index && Array.isArray(index.skillNames)) {
        const oldNames = new Set(index.skillNames);
        const newNames = new Set(skills.map(s => s.name));
        added = [...newNames].filter(n => !oldNames.has(n)).sort();
        removed = [...oldNames].filter(n => !newNames.has(n)).sort();
      }

      const freshIndex = buildIndex(scan);
      writeJsonAtomic(INDEX_PATH, freshIndex);
      writeState(freshIndex);

      lines.push('ACTION: PARSE');
      lines.push(`SCAN: ${scanCount}`);
      lines.push(`INDEX: ${index ? indexCount : 'none'}`);
      if (index) {
        lines.push(`DELTA: +${added.length} -${removed.length}`);
        if (added.length) lines.push(`ADDED: ${added.join(', ')}`);
        if (removed.length) lines.push(`REMOVED: ${removed.join(', ')}`);
      }
      lines.push(`RESULT: 索引已重建（${freshIndex.totalCategories} 个大类 / ${freshIndex.totalSkills} 个 skill）`);
      lines.push(`DETAIL_DIR: ${CATEGORIES_DIR}`);
      console.log(lines.join('\n'));
      return;
    }

    const state = readState();
    const needsRestart = !state ||
      state.totalSkills !== scanCount ||
      state.version !== version;

    if (needsRestart) {
      writeState(index);
      lines.push('ACTION: RESTART');
      lines.push(`SCAN: ${scanCount}`);
      lines.push(`INDEX: ${indexCount}`);
      lines.push('REASON: 本会话尚未激活（state 缺失或与当前索引不一致）');
      lines.push(`RESULT: 已重新激活（${index.totalCategories} 个大类 / ${index.totalSkills} 个 skill）`);
      lines.push('CATEGORIES:');
      for (const c of index.categories) {
        lines.push(`• ${c.name} (${c.skillCount}) — ${path.basename(c.detailFile)}`);
      }
      console.log(lines.join('\n'));
      return;
    }

    lines.push('ACTION: NOOP');
    lines.push(`SCAN: ${scanCount}`);
    lines.push(`INDEX: ${indexCount}`);
    lines.push(`RESULT: 索引已最新，选择器已激活（${index.totalCategories} 个大类 / ${index.totalSkills} 个 skill）`);
    console.log(lines.join('\n'));
  } catch (e) {
    lines.push('ACTION: ERROR');
    lines.push(`ERROR: ${e.message}`);
    lines.push('HINT: 运行 node src/cli/doctor.js 检查配置');
    console.log(lines.join('\n'));
  }
}

if (process.argv.includes('--manual')) {
  runManual();
} else {
  runHook();
}
