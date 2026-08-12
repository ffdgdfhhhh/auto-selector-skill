#!/usr/bin/env node
// auto-selector-skill — unified cross-platform installer
//
// Detects installed AI coding agents and installs for all of them.
// Usage: npx auto-selector-skill [--only <agent>] [--list] [--dry-run]
//
// Pure stdlib, zero npm runtime deps.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');

const PLUGIN_NAME = 'auto-selector-skill';
const SKILL_DIR = 'plugins/auto-selector-skill/skills/auto-selector-skill';

// ── Provider matrix ─────────────────────────────────────────────────────────
// Each entry: how to detect the agent + how to install for it.
const PROVIDERS = [
  {
    id: 'claude',
    label: 'Claude Code',
    detect: 'command:claude',
    install(dest, sourceDir) {
      const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
      const cacheDir = path.join(claudeDir, 'plugins', 'cache', PLUGIN_NAME, PLUGIN_NAME, 'latest');
      copyDir(sourceDir, cacheDir, ['.claude-plugin', '.github', '.codex', 'plugins', 'src', 'AGENTS.md', 'GEMINI.md', 'gemini-extension.json', 'package.json', 'README.md']);
      registerPlugin(claudeDir, cacheDir);
      return cacheDir;
    },
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    detect: 'command:gemini',
    install(dest, sourceDir) {
      // Gemini uses gemini-extension.json + GEMINI.md at project or config level
      const geminiDir = path.join(os.homedir(), '.gemini');
      mkdirp(geminiDir);
      copyFile(path.join(sourceDir, 'GEMINI.md'), path.join(geminiDir, 'GEMINI.md'));
      copyFile(path.join(sourceDir, 'gemini-extension.json'), path.join(geminiDir, 'gemini-extension.json'));
      // Copy skill file
      const skillDest = path.join(geminiDir, SKILL_DIR);
      copyFile(path.join(sourceDir, SKILL_DIR, 'SKILL.md'), path.join(skillDest, 'SKILL.md'));
      return geminiDir;
    },
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    detect: 'command:codex',
    install(dest, sourceDir) {
      const codexDir = path.join(os.homedir(), '.codex');
      mkdirp(codexDir);
      copyFile(path.join(sourceDir, 'AGENTS.md'), path.join(codexDir, 'AGENTS.md'));
      const skillDest = path.join(codexDir, SKILL_DIR);
      copyFile(path.join(sourceDir, SKILL_DIR, 'SKILL.md'), path.join(skillDest, 'SKILL.md'));
      return codexDir;
    },
  },
  {
    id: 'cursor',
    label: 'Cursor',
    detect: 'command:cursor||macapp:Cursor',
    install(dest, sourceDir) {
      // Cursor uses AGENTS.md at project level — copy to global rules dir
      const rulesDir = path.join(os.homedir(), '.cursor', 'rules');
      mkdirp(rulesDir);
      copyFile(path.join(sourceDir, 'AGENTS.md'), path.join(rulesDir, 'auto-selector-skill.md'));
      return rulesDir;
    },
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    detect: 'command:windsurf||macapp:Windsurf',
    install(dest, sourceDir) {
      const rulesDir = path.join(os.homedir(), '.windsurf', 'rules');
      mkdirp(rulesDir);
      copyFile(path.join(sourceDir, 'AGENTS.md'), path.join(rulesDir, 'auto-selector-skill.md'));
      return rulesDir;
    },
  },
  {
    id: 'cline',
    label: 'Cline',
    detect: 'vscode-ext:cline',
    install(dest, sourceDir) {
      const rulesDir = path.join(os.homedir(), '.clinerules');
      mkdirp(rulesDir);
      copyFile(path.join(sourceDir, 'AGENTS.md'), path.join(rulesDir, 'auto-selector-skill.md'));
      return rulesDir;
    },
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    detect: 'command:gh',
    install(dest, sourceDir) {
      // Copilot uses .github/copilot-instructions.md — this is per-repo, so we just note it
      const copilotDir = path.join(os.homedir(), '.config', 'github-copilot');
      mkdirp(copilotDir);
      copyFile(path.join(sourceDir, 'AGENTS.md'), path.join(copilotDir, 'auto-selector-skill.md'));
      return copilotDir;
    },
  },
];

// ── Detection helpers ────────────────────────────────────────────────────────
function detect(spec) {
  const parts = spec.split('||');
  for (const part of parts) {
    const [type, value] = part.trim().split(':');
    if (type === 'command') {
      try {
        const cmd = process.platform === 'win32' ? `where ${value}` : `which ${value}`;
        child_process.execSync(cmd, { stdio: 'ignore' });
        return true;
      } catch (e) { /* not found */ }
    }
    if (type === 'macapp') {
      if (process.platform === 'darwin') {
        const appPath = `/Applications/${value}.app`;
        if (fs.existsSync(appPath)) return true;
      }
    }
    if (type === 'vscode-ext') {
      // Check VSCode extensions directory
      const extDirs = [
        path.join(os.homedir(), '.vscode', 'extensions'),
        path.join(os.homedir(), '.cursor', 'extensions'),
        path.join(os.homedir(), '.vscode-insiders', 'extensions'),
      ];
      for (const dir of extDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
          const entries = fs.readdirSync(dir);
          if (entries.some(e => e.toLowerCase().includes(value.toLowerCase()))) return true;
        } catch (e) { /* ignore */ }
      }
    }
  }
  return false;
}

// ── File helpers ─────────────────────────────────────────────────────────────
function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, entries) {
  mkdirp(dest);
  for (const entry of entries) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (!fs.existsSync(srcPath)) continue;
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function copyDirRecursive(src, dest) {
  mkdirp(dest);
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function registerPlugin(claudeDir, cacheDir) {
  const pluginsJson = path.join(claudeDir, 'plugins', 'installed_plugins.json');
  mkdirp(path.dirname(pluginsJson));

  let data;
  if (fs.existsSync(pluginsJson)) {
    try { data = JSON.parse(fs.readFileSync(pluginsJson, 'utf8')); } catch (e) { data = { version: 2, plugins: {} }; }
  } else {
    data = { version: 2, plugins: {} };
  }

  const key = `${PLUGIN_NAME}@${PLUGIN_NAME}`;
  if (data.plugins[key]) return false;

  data.plugins[key] = [{
    scope: 'user',
    installPath: cacheDir,
    version: 'latest',
    installedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  }];
  fs.writeFileSync(pluginsJson, JSON.stringify(data, null, 2) + '\n');
  return true;
}

// ── Argv ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = {
  only: [],
  list: false,
  dryRun: false,
  help: false,
  uninstall: false,
  blacklistAdd: null,
  blacklistRemove: null,
  blacklistList: false,
  blacklistClear: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--only': opts.only.push(args[++i]); break;
    case '--list': opts.list = true; break;
    case '--dry-run': opts.dryRun = true; break;
    case '-u': case '--uninstall': opts.uninstall = true; break;
    case '--blacklist-add': opts.blacklistAdd = args[++i]; break;
    case '--blacklist-remove': opts.blacklistRemove = args[++i]; break;
    case '--blacklist-list': opts.blacklistList = true; break;
    case '--blacklist-clear': opts.blacklistClear = true; break;
    case '-h': case '--help': opts.help = true; break;
  }
}

if (opts.help) {
  console.log(`
auto-selector-skill v${require('../package.json').version}

Usage:
  npx auto-selector-skill                        Install for all detected agents
  npx auto-selector-skill --list                 List detected agents (no install)
  npx auto-selector-skill --only <agent>         Install for specific agent only
  npx auto-selector-skill --dry-run              Preview without writing files
  npx auto-selector-skill --uninstall            Remove from all agents

Blacklist management:
  npx auto-selector-skill --blacklist-add <name>     Exclude a skill/plugin
  npx auto-selector-skill --blacklist-remove <name>  Re-include a skill/plugin
  npx auto-selector-skill --blacklist-list            Show current blacklist
  npx auto-selector-skill --blacklist-clear           Clear blacklist

Slash commands (in AI chat):
  /auto-selector help              Show all commands
  /auto-selector on|off            Enable/disable
  /auto-selector list              List detected skills/plugins
  /auto-selector skip-confirm on   Skip confirmation dialog
  /auto-selector blacklist ...     Manage blacklist
  /auto-selector status            Show current state

Supported agents: ${PROVIDERS.map(p => p.id).join(', ')}
`);
  process.exit(0);
}

// ── Blacklist helpers ────────────────────────────────────────────────────────
const BLACKLIST_FILE = path.join(os.homedir(), '.auto-selector-skill-blacklist.json');

function readBlacklist() {
  try { return JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8')); } catch (e) { return []; }
}

function writeBlacklist(list) {
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(list, null, 2) + '\n');
}

if (opts.blacklistList) {
  const list = readBlacklist();
  if (list.length === 0) {
    console.log('📋 Blacklist is empty.');
  } else {
    console.log(`📋 Blacklist (${list.length}):`);
    for (const name of list) console.log(`  🚫 ${name}`);
  }
  process.exit(0);
}

if (opts.blacklistAdd) {
  const list = readBlacklist();
  if (list.includes(opts.blacklistAdd)) {
    console.log(`⚠️  "${opts.blacklistAdd}" is already blacklisted.`);
  } else {
    list.push(opts.blacklistAdd);
    writeBlacklist(list);
    console.log(`🚫 Added "${opts.blacklistAdd}" to blacklist.`);
  }
  process.exit(0);
}

if (opts.blacklistRemove) {
  const list = readBlacklist();
  const idx = list.indexOf(opts.blacklistRemove);
  if (idx === -1) {
    console.log(`⚠️  "${opts.blacklistRemove}" is not in the blacklist.`);
  } else {
    list.splice(idx, 1);
    writeBlacklist(list);
    console.log(`✅ Removed "${opts.blacklistRemove}" from blacklist.`);
  }
  process.exit(0);
}

if (opts.blacklistClear) {
  writeBlacklist([]);
  console.log('✅ Blacklist cleared.');
  process.exit(0);
}

// ── Uninstall ────────────────────────────────────────────────────────────────
if (opts.uninstall) {
  console.log(`🗑️  Uninstalling ${PLUGIN_NAME}...\n`);

  for (const provider of PROVIDERS) {
    try {
      if (provider.id === 'claude') {
        const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
        const cacheDir = path.join(claudeDir, 'plugins', 'cache', PLUGIN_NAME);
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { recursive: true, force: true });
          console.log(`  ✅ ${provider.label} — removed plugin files`);
        }
        // Remove from installed_plugins.json
        const pluginsJson = path.join(claudeDir, 'plugins', 'installed_plugins.json');
        if (fs.existsSync(pluginsJson)) {
          const data = JSON.parse(fs.readFileSync(pluginsJson, 'utf8'));
          delete data.plugins[`${PLUGIN_NAME}@${PLUGIN_NAME}`];
          fs.writeFileSync(pluginsJson, JSON.stringify(data, null, 2) + '\n');
          console.log(`  ✅ ${provider.label} — unregistered from installed_plugins.json`);
        }
      }
      // Other providers: remove installed files
      if (provider.id === 'gemini') {
        const f = path.join(os.homedir(), '.gemini', 'GEMINI.md');
        if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  ✅ ${provider.label} — removed GEMINI.md`); }
      }
      if (provider.id === 'codex') {
        const f = path.join(os.homedir(), '.codex', 'AGENTS.md');
        if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  ✅ ${provider.label} — removed AGENTS.md`); }
      }
      if (provider.id === 'cursor') {
        const f = path.join(os.homedir(), '.cursor', 'rules', 'auto-selector-skill.md');
        if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  ✅ ${provider.label} — removed rule file`); }
      }
      if (provider.id === 'windsurf') {
        const f = path.join(os.homedir(), '.windsurf', 'rules', 'auto-selector-skill.md');
        if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  ✅ ${provider.label} — removed rule file`); }
      }
      if (provider.id === 'cline') {
        const f = path.join(os.homedir(), '.clinerules', 'auto-selector-skill.md');
        if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  ✅ ${provider.label} — removed rule file`); }
      }
      if (provider.id === 'copilot') {
        const f = path.join(os.homedir(), '.config', 'github-copilot', 'auto-selector-skill.md');
        if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  ✅ ${provider.label} — removed rule file`); }
      }
    } catch (e) {
      console.log(`  ❌ ${provider.label} — ${e.message}`);
    }
  }

  // Remove blacklist file
  if (fs.existsSync(BLACKLIST_FILE)) {
    fs.unlinkSync(BLACKLIST_FILE);
    console.log(`  ✅ Blacklist file removed`);
  }

  console.log(`\n🎉 ${PLUGIN_NAME} uninstalled. Restart your AI coding agent.`);
  process.exit(0);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const sourceDir = path.join(__dirname, '..');

console.log(`🔍 Detecting installed AI coding agents...\n`);

const detected = PROVIDERS.filter(p => detect(p.detect));

if (opts.list) {
  for (const p of PROVIDERS) {
    const status = detected.includes(p) ? '✅' : '  ';
    console.log(`  ${status} ${p.label} (${p.id})`);
  }
  process.exit(0);
}

const targets = opts.only.length > 0
  ? PROVIDERS.filter(p => opts.only.includes(p.id))
  : detected;

if (targets.length === 0) {
  console.log('❌ No supported AI coding agents detected.');
  console.log('   Install one of: ' + PROVIDERS.map(p => p.label).join(', '));
  console.log('   Or use --only <agent> to force install.');
  process.exit(1);
}

console.log(`📦 Installing ${PLUGIN_NAME} for:\n`);

for (const provider of targets) {
  if (opts.dryRun) {
    console.log(`  [dry-run] ${provider.label} — would install`);
    continue;
  }
  try {
    const dest = provider.install(null, sourceDir);
    console.log(`  ✅ ${provider.label} → ${dest}`);
  } catch (e) {
    console.log(`  ❌ ${provider.label} — ${e.message}`);
  }
}

if (!opts.dryRun) {
  console.log(`\n🎉 ${PLUGIN_NAME} installed! Restart your AI coding agent to activate.`);
} else {
  console.log(`\n[dry-run] No files were written.`);
}
