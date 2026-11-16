'use strict';
// Shared scanner: plugin cache + local skills + project skills.
// Zero dependencies. Used by hooks, CLI tools, and the MCP server.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { sanitize } = require('./sanitize');

const SOURCE_PRIORITY = { project: 3, local: 2, plugin: 1 };

function getHome() {
  return process.env.AUTO_SELECTOR_HOME ||
    process.env.HOME ||
    process.env.USERPROFILE ||
    '';
}

// Claude config directory: honors CLAUDE_CONFIG_DIR like the installer.
function getClaudeDir() {
  return process.env.AUTO_SELECTOR_CLAUDE_DIR ||
    process.env.CLAUDE_CONFIG_DIR ||
    path.join(getHome(), '.claude');
}

function getProjectDir(explicit) {
  return explicit ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd();
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function writeTextAtomic(file, text) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

// Optional config lives next to the index, always in the shared base dir:
//   ~/.claude/auto-selector/config.json
// categoryOverrides maps a local skill name to a category name, so users can
// bucket their own skills without hardcoding names into the plugin.
function readCategoryOverrides(claudeDir) {
  const cfg = readJson(path.join(claudeDir, 'auto-selector', 'config.json'), null);
  const raw = cfg && typeof cfg === 'object' && !Array.isArray(cfg)
    ? cfg.categoryOverrides
    : null;
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  for (const [name, category] of Object.entries(raw)) {
    if (typeof category !== 'string') continue;
    const key = String(name || '').trim().toLowerCase();
    const value = category.trim();
    if (key && value) out[key] = value;
  }
  return out;
}

// ── Frontmatter ────────────────────────────────────────────────────────

// Parse YAML frontmatter from SKILL.md (quoted, plain, and block scalars).
function parseFrontmatter(content) {
  const match = content.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const result = {};
  const lines = match[1].split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '' || line.trim().startsWith('#') || /^\s/.test(line)) {
      i++;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    i++;

    // YAML block scalar: >, >-, >+, |, |-, |+
    if (/^[>|][+-]?$/.test(value)) {
      const folded = value.startsWith('>');
      const block = [];
      while (i < lines.length && (lines[i].trim() === '' || /^\s/.test(lines[i]))) {
        block.push(lines[i].replace(/^\s+/, ''));
        i++;
      }
      while (block.length && block[block.length - 1] === '') block.pop();

      if (folded) {
        let out = '';
        let pendingBreak = false;
        for (const l of block) {
          if (l === '') {
            out += '\n';
            pendingBreak = true;
            continue;
          }
          if (out && !pendingBreak) out += ' ';
          out += l;
          pendingBreak = false;
        }
        value = out.replace(/[ \t]+/g, ' ').trim();
      } else {
        value = block.join('\n').replace(/[ \t]+$/gm, '').trim();
      }
    } else {
      // Plain scalar: collect indented continuations, preserving paragraph
      // breaks (a blank line followed by more indented text).
      const parts = [value];
      while (i < lines.length) {
        if (/^\s+/.test(lines[i]) && lines[i].trim() !== '') {
          parts.push(lines[i].trim());
          i++;
          continue;
        }
        if (lines[i].trim() === '' && i + 1 < lines.length &&
            /^\s+/.test(lines[i + 1]) && lines[i + 1].trim() !== '') {
          parts.push('\n');
          i++;
          continue;
        }
        break;
      }

      value = parts.reduce((acc, part) => {
        if (part === '\n') return acc.replace(/[ \t]+$/, '') + '\n';
        if (acc === '' || acc.endsWith('\n')) return acc + part;
        return acc + ' ' + part;
      }, '').replace(/[ \t]+/g, ' ').trim();
    }

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

// ── Blacklist ──────────────────────────────────────────────────────────

function blacklistPath(home) {
  return path.join(home || getHome(), '.auto-selector-skill-blacklist.json');
}

function readBlacklistState(home) {
  const file = blacklistPath(home);
  try {
    if (!fs.existsSync(file)) return { list: [], error: false };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed)) return { list: [], error: true };
    return { list: parsed.filter(x => typeof x === 'string'), error: false };
  } catch (e) {
    console.error(`[auto-selector] Error reading blacklist: ${e.message}`);
    return { list: [], error: true };
  }
}

function readBlacklist(home) {
  return readBlacklistState(home).list;
}

function isBlacklisted(skill, blacklist) {
  const name = String(skill.name || '').toLowerCase();
  const plugin = String(skill.plugin || '').toLowerCase();
  const marketplace = String(skill.marketplace || '').toLowerCase();
  return blacklist.some(entry => {
    const b = String(entry || '').toLowerCase();
    return b !== '' && (
      name === b ||
      plugin === b ||
      marketplace === b ||
      name.startsWith(b + '-')
    );
  });
}

// ── Enabled plugins ────────────────────────────────────────────────────

// Merge enabledPlugins from user + project settings.
// Returns { active, enabled:Set, disabled:Set }. When no settings file
// declares enabledPlugins, active is false and all plugins are included.
function readEnabledPlugins(claudeDir, projectDir) {
  // Later scopes override earlier ones: user < project < project local.
  const files = [
    path.join(claudeDir, 'settings.json'),
    path.join(projectDir, '.claude', 'settings.json'),
    path.join(projectDir, '.claude', 'settings.local.json'),
  ];

  let active = false;
  const enabled = new Set();
  const disabled = new Set();

  for (const file of files) {
    const s = readJson(file, null);
    if (!s || !s.enabledPlugins || typeof s.enabledPlugins !== 'object') continue;
    active = true;
    for (const [key, value] of Object.entries(s.enabledPlugins)) {
      const k = key.toLowerCase();
      if (value === true) {
        enabled.add(k);
        disabled.delete(k);
      } else if (value === false) {
        disabled.add(k);
        enabled.delete(k);
      }
    }
  }

  return { active, enabled, disabled };
}

function readInstalledPaths(claudeDir) {
  const file = path.join(claudeDir, 'plugins', 'installed_plugins.json');
  const data = readJson(file, null);
  const map = new Map();
  if (!data || !data.plugins) return map;
  for (const [key, entries] of Object.entries(data.plugins)) {
    if (Array.isArray(entries) && entries[0] && entries[0].installPath) {
      map.set(key.toLowerCase(), entries[0].installPath);
    }
  }
  return map;
}

function pluginKeys(pluginDir, pluginName, marketplace) {
  const keys = [`${pluginDir}@${marketplace}`.toLowerCase()];
  if (pluginName && pluginName !== pluginDir) {
    keys.push(`${pluginName}@${marketplace}`.toLowerCase());
  }
  return keys;
}

function compareVersions(a, b) {
  const pa = String(a).split(/[^\d]+/).filter(Boolean).map(Number);
  const pb = String(b).split(/[^\d]+/).filter(Boolean).map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return String(a).localeCompare(String(b));
}

// Prefer the installed path, then 'latest', then the highest version.
function pickVersionDir(versionDirs, installPath) {
  if (installPath) {
    const base = path.basename(installPath);
    if (versionDirs.includes(base)) return base;
  }
  if (versionDirs.includes('latest')) return 'latest';
  return [...versionDirs].sort(compareVersions).pop();
}

// ── Scanning ───────────────────────────────────────────────────────────

function makeSkill(base) {
  const name = String(base.name || '').trim();
  return {
    name,
    description: String(base.description || '').trim(),
    source: base.source,
    plugin: base.plugin || undefined,
    marketplace: base.marketplace || undefined,
    path: base.path || undefined,
    identifier: base.identifier || name,
  };
}

function scanPluginSkills(claudeDir, cfg, stats) {
  const skills = [];
  const cacheDir = path.join(claudeDir, 'plugins', 'cache');
  if (!fs.existsSync(cacheDir)) return skills;

  const installed = readInstalledPaths(claudeDir);
  let marketplaces = [];
  try { marketplaces = fs.readdirSync(cacheDir); } catch (e) {
    console.error(`[auto-selector] Error scanning plugins: ${e.message}`);
    return skills;
  }

  for (const marketDir of marketplaces) {
    const marketPath = path.join(cacheDir, marketDir);
    let pluginDirs = [];
    try {
      if (!fs.statSync(marketPath).isDirectory()) continue;
      pluginDirs = fs.readdirSync(marketPath);
    } catch (e) { continue; }

    for (const pluginDir of pluginDirs) {
      const pluginPath = path.join(marketPath, pluginDir);
      let versionDirs = [];
      try {
        if (!fs.statSync(pluginPath).isDirectory()) continue;
        versionDirs = fs.readdirSync(pluginPath).filter(v => {
          try { return fs.statSync(path.join(pluginPath, v)).isDirectory(); } catch (e) { return false; }
        });
      } catch (e) { continue; }

      if (versionDirs.length === 0) continue;

      const pluginJson = readJson(
        path.join(pluginPath, versionDirs[0], '.claude-plugin', 'plugin.json'),
        {}
      );
      const pluginName = pluginJson.name || pluginDir;
      const keys = pluginKeys(pluginDir, pluginName, marketDir);
      const installPath = keys.map(k => installed.get(k)).find(Boolean);
      const versionDir = pickVersionDir(versionDirs, installPath);
      const versionPath = path.join(pluginPath, versionDir);

      stats.pluginsScanned++;

      if (cfg.active) {
        const enabled = keys.some(k => cfg.enabled.has(k));
        if (!enabled) {
          stats.pluginsSkipped++;
          continue;
        }
      }

      const skillsDir = path.join(versionPath, 'skills');
      if (!fs.existsSync(skillsDir)) continue; // commands-only plugin: not a skill

      let skillDirs = [];
      try { skillDirs = fs.readdirSync(skillsDir); } catch (e) { continue; }

      for (const skillDir of skillDirs) {
        const skillPath = path.join(skillsDir, skillDir);
        let isDir = false;
        try { isDir = fs.statSync(skillPath).isDirectory(); } catch (e) { continue; }
        if (!isDir) continue;

        const skillMd = path.join(skillPath, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;

        try {
          const parsed = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
          if (!parsed) continue;
          const name = parsed.name || skillDir;
          skills.push(makeSkill({
            name,
            description: parsed.description || '',
            source: 'plugin',
            plugin: pluginDir,
            marketplace: marketDir,
            path: skillPath,
            identifier: `${pluginDir}:${name}`,
          }));
        } catch (e) {
          console.error(`[auto-selector] Error reading ${skillMd}: ${e.message}`);
        }
      }
    }
  }

  return skills;
}

function scanSkillDir(root, source) {
  const skills = [];
  if (!fs.existsSync(root)) return skills;

  let entries = [];
  try { entries = fs.readdirSync(root); } catch (e) {
    console.error(`[auto-selector] Error scanning ${root}: ${e.message}`);
    return skills;
  }

  for (const entry of entries) {
    let realPath = path.join(root, entry);
    try {
      if (!fs.statSync(realPath).isDirectory()) continue;
      try { realPath = fs.realpathSync(realPath); } catch (e) {}
    } catch (e) { continue; }

    const skillMd = path.join(realPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    try {
      const parsed = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
      if (!parsed) continue;
      const name = parsed.name || entry;
      skills.push(makeSkill({
        name,
        description: parsed.description || '',
        source,
        path: realPath,
        identifier: source === 'project' ? `project:${name}` : name,
      }));
    } catch (e) {
      console.error(`[auto-selector] Error reading ${skillMd}: ${e.message}`);
    }
  }

  return skills;
}

function samePath(a, b) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch (e) {
    return path.resolve(a) === path.resolve(b);
  }
}

function projectKey(projectDir) {
  const resolved = path.resolve(projectDir || '');
  const normalized = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12);
}

// True when the project can change the scan result: it contributes skills or
// declares enabledPlugins in project-level settings.
function projectAffectsIndex(project, claudeDir) {
  // When the project is the home directory, .claude is the global config.
  if (samePath(path.join(project, '.claude'), claudeDir)) return false;

  const projectSkills = path.join(project, '.claude', 'skills');
  const localSkills = path.join(claudeDir, 'skills');
  if (fs.existsSync(projectSkills) && !samePath(projectSkills, localSkills)) return true;

  for (const name of ['settings.json', 'settings.local.json']) {
    const settings = readJson(path.join(project, '.claude', name), null);
    if (settings && typeof settings === 'object' && !Array.isArray(settings) &&
        settings.enabledPlugins &&
        typeof settings.enabledPlugins === 'object' &&
        !Array.isArray(settings.enabledPlugins)) {
      return true;
    }
  }
  return false;
}

// Resolve index locations. A project that changes the scan result gets a
// private bucket, so two sessions in different projects do not overwrite each
// other's index mid-session. config.json stays shared in the base directory.
function getIndexPaths(claudeDir, projectDir) {
  const baseDir = path.join(claudeDir, 'auto-selector');
  const project = getProjectDir(projectDir);
  const isolated = projectAffectsIndex(project, claudeDir);
  const dir = isolated ? path.join(baseDir, 'projects', projectKey(project)) : baseDir;

  return {
    baseDir,
    dir,
    indexPath: path.join(dir, 'index.json'),
    statePath: path.join(dir, 'state.json'),
    categoriesDir: path.join(dir, 'categories'),
    configPath: path.join(baseDir, 'config.json'),
    projectDir: project,
    isolated,
  };
}

// Merge skills with the same normalized name. Keeps the highest-priority
// source (project > local > plugin) and records every origin.
function dedupeSkills(skills) {
  const map = new Map();

  for (const skill of skills) {
    if (!skill.name) continue;
    const key = skill.name.toLowerCase().replace(/\s+/g, ' ').trim();
    const origin = skill.source +
      (skill.plugin ? `:${skill.plugin}` : '') +
      (skill.source === 'plugin' ? `@${skill.marketplace}` : '');

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...skill, sources: [origin], identifiers: [skill.identifier] });
      continue;
    }

    if (!existing.sources.includes(origin)) existing.sources.push(origin);
    if (!existing.identifiers.includes(skill.identifier)) existing.identifiers.push(skill.identifier);

    if ((SOURCE_PRIORITY[skill.source] || 0) > (SOURCE_PRIORITY[existing.source] || 0)) {
      const merged = {
        ...skill,
        sources: existing.sources,
        identifiers: existing.identifiers,
      };
      if (!merged.description && existing.description) merged.description = existing.description;
      map.set(key, merged);
    } else if (!existing.description && skill.description) {
      existing.description = skill.description;
    }
  }

  return [...map.values()];
}

function scanSkills(options = {}) {
  const home = options.home || getHome();
  const claudeDir = options.claudeDir ||
    (options.home ? path.join(home, '.claude') : getClaudeDir());
  const projectDir = getProjectDir(options.projectDir);
  const cfg = readEnabledPlugins(claudeDir, projectDir);

  const stats = {
    raw: 0,
    unique: 0,
    duplicatesMerged: 0,
    pluginsScanned: 0,
    pluginsSkipped: 0,
    projectSkipped: false,
    enabledFilter: cfg.active,
  };

  const pluginSkills = scanPluginSkills(claudeDir, cfg, stats);
  const localSkillsDir = path.join(claudeDir, 'skills');
  const localSkills = scanSkillDir(localSkillsDir, 'local');

  let projectSkills = [];
  const projectSkillsDir = path.join(projectDir, '.claude', 'skills');
  if (fs.existsSync(projectSkillsDir) && samePath(projectSkillsDir, localSkillsDir)) {
    stats.projectSkipped = true;
  } else {
    projectSkills = scanSkillDir(projectSkillsDir, 'project');
  }

  const raw = [...pluginSkills, ...localSkills, ...projectSkills];
  stats.raw = raw.length;

  const all = dedupeSkills(raw);
  const blacklist = options.blacklist || readBlacklist(home);
  const skills = blacklist.length > 0
    ? all.filter(s => !isBlacklisted(s, blacklist))
    : all;

  stats.unique = skills.length;
  stats.duplicatesMerged = raw.length - all.length;
  stats.blacklisted = all.length - skills.length;

  return {
    skills,
    blacklist,
    stats,
    projectDir,
    home,
    claudeDir,
    categoryOverrides: readCategoryOverrides(claudeDir),
  };
}

// ── Categories ─────────────────────────────────────────────────────────

const SPECIAL_CATEGORIES = {
  'gsap-skills': 'GSAP',
  'hyperframes': 'HyperFrames',
  'playwright': 'Playwright',
  'document-skills': 'Document Skills',
  'example-skills': 'Document Skills',
  'superpowers': 'Superpowers',
  'superpowers-dev': 'Superpowers',
  'ponytail': 'Ponytail',
  'caveman': 'Caveman',
  'planning-with-files': 'Planning with Files',
  'andrej-karpathy-skills': 'Karpathy Guidelines',
  'karpathy-skills': 'Karpathy Guidelines',
  'taste-skill': 'Taste Skill',
  'claude-plugins-official': 'Code Quality',
};

const CATEGORY_DESCRIPTIONS = {
  'HyperFrames': '视频、动画、motion graphics 制作。包括视频编辑、字幕、转场、音频、渲染等全流程。',
  'GSAP': 'GSAP 动画库。包括核心 API、React、Vue、ScrollTrigger、Timeline、性能优化等。',
  'Playwright': 'Playwright 测试框架。包括开发、DevOps、测试结果查询、bug 复现等。',
  'UI/UX Design': 'UI/UX 设计。包括设计系统、品牌、前端设计、图片生成、banner 设计等。',
  'Document Skills': '文档处理。包括 Word、PDF、PPT、Excel、幻灯片、内部沟通文档等。',
  'Caveman': '代码简化与重构。包括代码审查、压缩、安全重构、探索、优化等。',
  'Superpowers': '开发流程增强。包括头脑风暴、计划、调试、TDD、代码审查、Git worktree 等。',
  'Ponytail': '代码质量管理。包括审计、技术债追踪、代码增益分析等。',
  'Planning with Files': '项目规划与文件管理。多语言支持。',
  'Karpathy Guidelines': 'AI 编码指导原则。减少幻觉，提高代码质量。',
  'Code Quality': '代码质量工具。',
  'Taste Skill': '高端 UI 设计品味。反 AI 模板化设计。',
  'auto-selector-skill': '自动 skill 路由（本插件）。',
  'Other Local Skills': '其他未分类的 skill。',
};

// Explicit buckets come from config.json (categoryOverrides), not from code,
// so the plugin ships no personal skill names. Unknown names use heuristics.
function categorizeLocalSkill(name, overrides) {
  const n = String(name || '').toLowerCase();
  const custom = overrides && overrides[n];
  if (typeof custom === 'string' && custom.trim()) return custom.trim();
  if (n.includes('hyperframes') || n.includes('motion') ||
      n.includes('video') || n.includes('caption') ||
      n.includes('slideshow') || n.includes('remotion') ||
      n === 'media-use' || n === 'figma' || n === 'general-video') {
    return 'HyperFrames';
  }
  if (n.includes('gsap')) return 'GSAP';
  if (n.includes('playwright')) return 'Playwright';
  if (n.includes('design') || n.includes('ui') || n.includes('ux') ||
      n.includes('brand') || n.includes('imagegen') ||
      n === 'slides' || n === 'image-to-code') {
    return 'UI/UX Design';
  }
  if (n.includes('full-output')) return 'Code Quality';
  if (n.includes('slide')) return 'UI/UX Design';
  return 'Other Local Skills';
}

function categoryFor(skill, projectDir, overrides) {
  if (skill.source === 'plugin') {
    return SPECIAL_CATEGORIES[skill.marketplace] ||
      SPECIAL_CATEGORIES[skill.plugin] ||
      skill.plugin ||
      skill.marketplace ||
      'Plugin Skills';
  }
  if (skill.source === 'project') {
    const base = path.basename(projectDir || '').trim();
    return base ? `Project (${base})` : 'Project Skills';
  }
  return categorizeLocalSkill(skill.name, overrides);
}

function autoDescription(name, skills) {
  if (CATEGORY_DESCRIPTIONS[name]) return CATEGORY_DESCRIPTIONS[name];
  if (skills.length === 1) {
    return sanitize(skills[0].description || `${name} skill`, 300);
  }
  const sample = skills.slice(0, 3).map(s => sanitize(s.name, 40)).join('、');
  return sanitize(`包含 ${sample} 等 ${skills.length} 个 skill`, 300);
}

function shortDescription(description, name) {
  const first = sanitize(description, 400)
    .split(/[。；;\n]/)[0]
    .trim();
  const base = first || `${sanitize(name, 40)} 相关 skill`;
  return base.length > 26 ? base.slice(0, 26) + '…' : base;
}

function groupSkills(skills, projectDir, overrides) {
  const map = new Map();
  for (const skill of skills) {
    const category = categoryFor(skill, projectDir, overrides);
    if (!map.has(category)) map.set(category, []);
    map.get(category).push(skill);
  }
  return map;
}

function uniqueFileName(name, used) {
  const base = String(name)
    .replace(/[^a-zA-Z0-9一-鿿]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'category';
  let candidate = `${base}.md`;
  if (used.has(candidate.toLowerCase())) {
    const hash = crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 6);
    candidate = `${base}_${hash}.md`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function buildIndexData(skills, options = {}) {
  const projectDir = options.projectDir || getProjectDir();
  const version = options.version || '0.0.0';
  const blacklistCount = options.blacklistCount || 0;
  const categoriesDir = options.categoriesDir;
  const writeDetails = options.writeDetails !== false && categoriesDir;
  const overrides = options.categoryOverrides || {};

  const map = groupSkills(skills, projectDir, overrides);
  const categories = [];
  const usedFiles = new Set();
  const writtenFiles = new Set();

  for (const [name, list] of map) {
    let detailFile = '';
    if (writeDetails) {
      const fileName = uniqueFileName(name, usedFiles);
      const detailPath = path.join(categoriesDir, fileName);
      fs.mkdirSync(categoriesDir, { recursive: true });
      const lines = list.map(s =>
        `- **${sanitize(s.name, 100)}**: ${sanitize(s.description, 300)}`
      ).join('\n');
      writeTextAtomic(
        detailPath,
        `# ${sanitize(name, 100)}\n\n${sanitize(autoDescription(name, list), 300)}\n\n` +
        `包含 ${list.length} 个 skill：\n\n${lines}\n`
      );
      detailFile = detailPath;
      writtenFiles.add(fileName);
    }

    const description = autoDescription(name, list);
    categories.push({
      name: sanitize(name, 80),
      description: sanitize(description, 300),
      shortDescription: shortDescription(description, name),
      skillCount: list.length,
      detailFile,
    });
  }

  categories.sort((a, b) => b.skillCount - a.skillCount || a.name.localeCompare(b.name));

  // Drop detail files for categories that no longer exist.
  if (writeDetails) {
    try {
      for (const entry of fs.readdirSync(categoriesDir)) {
        if (!entry.endsWith('.md') || writtenFiles.has(entry)) continue;
        fs.unlinkSync(path.join(categoriesDir, entry));
      }
    } catch (e) { /* best-effort cleanup */ }
  }

  const names = [...new Set(skills.map(s => s.name))].sort();
  const categorySum = categories.reduce((n, c) => n + c.skillCount, 0);

  return {
    version,
    timestamp: new Date().toISOString(),
    projectDir,
    totalCategories: categories.length,
    totalSkills: skills.length,
    blacklisted: blacklistCount,
    skillNames: names,
    categorySum,
    stats: options.stats || undefined,
    categories,
  };
}

module.exports = {
  getHome,
  getClaudeDir,
  getProjectDir,
  readJson,
  writeJsonAtomic,
  writeTextAtomic,
  readCategoryOverrides,
  parseFrontmatter,
  blacklistPath,
  readBlacklist,
  readBlacklistState,
  isBlacklisted,
  readEnabledPlugins,
  pickVersionDir,
  getIndexPaths,
  projectKey,
  scanSkills,
  dedupeSkills,
  buildIndexData,
  groupSkills,
  categoryFor,
  categorizeLocalSkill,
  SPECIAL_CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  SOURCE_PRIORITY,
};
