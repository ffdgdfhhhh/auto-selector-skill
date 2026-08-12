#!/usr/bin/env node
// auto-selector-skill installer — run via: npx auto-selector-skill
//
// What it does:
//   1. Copies plugin to ~/.claude/plugins/cache/
//   2. Registers in installed_plugins.json
//   3. Done — restart Claude Code to activate

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_NAME = 'auto-selector-skill';
const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const cacheDir = path.join(claudeDir, 'plugins', 'cache', PLUGIN_NAME, PLUGIN_NAME, 'latest');
const pluginsJson = path.join(claudeDir, 'plugins', 'installed_plugins.json');
const sourceDir = path.join(__dirname, '..');

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    mkdirp(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log(`🔧 Installing ${PLUGIN_NAME}...`);

// 1. Copy files to cache
mkdirp(cacheDir);

const filesToCopy = [
  '.claude-plugin',
  '.github',
  '.codex',
  'plugins',
  'src',
  'AGENTS.md',
  'GEMINI.md',
  'gemini-extension.json',
  'package.json',
  'README.md',
];

for (const file of filesToCopy) {
  const src = path.join(sourceDir, file);
  const dest = path.join(cacheDir, file);
  copyRecursive(src, dest);
}

console.log(`📁 Copied to ${cacheDir}`);

// 2. Register in installed_plugins.json
mkdirp(path.dirname(pluginsJson));

let data;
if (fs.existsSync(pluginsJson)) {
  try {
    data = JSON.parse(fs.readFileSync(pluginsJson, 'utf8'));
  } catch (e) {
    data = { version: 2, plugins: {} };
  }
} else {
  data = { version: 2, plugins: {} };
}

const key = `${PLUGIN_NAME}@${PLUGIN_NAME}`;
if (data.plugins[key]) {
  console.log('✅ Already registered in installed_plugins.json');
} else {
  data.plugins[key] = [{
    scope: 'user',
    installPath: cacheDir,
    version: 'latest',
    installedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  }];
  fs.writeFileSync(pluginsJson, JSON.stringify(data, null, 2) + '\n');
  console.log('✅ Registered in installed_plugins.json');
}

console.log('');
console.log(`🎉 ${PLUGIN_NAME} installed successfully!`);
console.log('   Restart Claude Code to activate.');
console.log('');
console.log("   Quick test: open a new Claude Code session and type 'skills'");
