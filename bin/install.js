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
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--only': opts.only.push(args[++i]); break;
    case '--list': opts.list = true; break;
    case '--dry-run': opts.dryRun = true; break;
    case '-h': case '--help': opts.help = true; break;
  }
}

if (opts.help) {
  console.log(`
auto-selector-skill installer

Usage:
  npx auto-selector-skill                  Install for all detected agents
  npx auto-selector-skill --list           List detected agents (no install)
  npx auto-selector-skill --only claude    Install for Claude Code only
  npx auto-selector-skill --only gemini    Install for Gemini CLI only
  npx auto-selector-skill --dry-run        Preview without writing files

Supported agents: ${PROVIDERS.map(p => p.id).join(', ')}
`);
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
