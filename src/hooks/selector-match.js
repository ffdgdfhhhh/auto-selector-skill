#!/usr/bin/env node
'use strict';
// auto-selector-skill — UserPromptSubmit hook
// Injects the routing rules (compact by default) plus the category index.

const fs = require('fs');
const path = require('path');
const {
  getHome,
  getClaudeDir,
  getIndexPaths,
  readJson,
  blacklistPath,
  readBlacklistState,
} = require('../lib/scan');
const { sanitize } = require('../lib/sanitize');
const { buildFullRules, buildCompactRules } = require('../lib/rules');

const HOME = getHome();
const PATHS = getIndexPaths(getClaudeDir());
const INDEX_PATH = PATHS.indexPath;
const CATEGORIES_DIR = PATHS.categoriesDir;
const CONFIG_PATH = PATHS.configPath;
const BLACKLIST_PATH = blacklistPath(HOME);
const BLACKLIST_CLI = path.join(__dirname, 'blacklist.js');
const ACTIVATE_CLI = path.join(__dirname, 'selector-activate.js');
const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'auto-selector-skill', 'SKILL.md');

function readConfig() {
  const raw = readJson(CONFIG_PATH, {});
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    rules: cfg.rules === 'full' ? 'full' : 'compact',
    // 3 candidates + "❌ 都不用" is the 4-option AskUserQuestion limit.
    maxCandidates: Number.isInteger(cfg.maxCandidates) && cfg.maxCandidates >= 1
      ? Math.min(cfg.maxCandidates, 3)
      : 3,
  };
}

function readIndex() {
  const index = readJson(INDEX_PATH, null);
  return index && Array.isArray(index.categories) && index.categories.length > 0
    ? index
    : null;
}

function buildCategoryList(index) {
  return index.categories.map(c => {
    const detailName = c.detailFile
      ? path.basename(c.detailFile)
      : `${String(c.name).replace(/[^a-zA-Z0-9一-鿿]/g, '_')}.md`;
    const desc = c.shortDescription || c.description || '';
    return `• ${sanitize(c.name, 80)} (${c.skillCount}) — ` +
      `${sanitize(desc, 120)} — 详情文件: ${sanitize(detailName, 120)}`;
  }).join('\n');
}

function blacklistLine() {
  const { list, error } = readBlacklistState(HOME);
  if (error) return '（读取失败：请检查 JSON 格式）';
  return list.length > 0 ? list.join(', ') : '（无）';
}

function main() {
  const config = readConfig();
  const index = readIndex();
  const categoryList = index
    ? buildCategoryList(index)
    : `（索引未生成：请重启会话，或运行 node "${ACTIVATE_CLI}"）`;

  const common = {
    categoryList,
    categoriesDir: CATEGORIES_DIR,
    blacklistLine: blacklistLine(),
    blacklistCli: BLACKLIST_CLI,
    blacklistPath: BLACKLIST_PATH,
    activateCli: ACTIVATE_CLI,
    fullRulesPath: SKILL_PATH,
    maxCandidates: config.maxCandidates,
  };

  const context = config.rules === 'full'
    ? buildFullRules(common)
    : buildCompactRules(common);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    },
  }));
}

try {
  main();
} catch (e) {
  console.error(`[auto-selector] Match hook failed: ${e.message}`);
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext:
        `<AUTO_SELECTORRouting>auto-selector-skill failed: ${e.message}\n` +
        'Answer normally; do not block on skill routing.</AUTO_SELECTORRouting>',
    },
  }));
}
