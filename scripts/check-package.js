#!/usr/bin/env node
'use strict';
// Fail if the npm tarball leaks runtime/dev files or misses a required file.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function packFiles() {
  // npm run sets npm_execpath; using the CLI script avoids the Windows
  // .cmd spawn problem (and the shell-argument deprecation warning).
  const npmCli = process.env.npm_execpath;
  const useCli = npmCli && fs.existsSync(npmCli);
  const command = useCli
    ? process.execPath
    : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = useCli
    ? [npmCli, 'pack', '--dry-run', '--json']
    : ['pack', '--dry-run', '--json'];

  const raw = execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: !useCli && process.platform === 'win32',
  });
  const start = raw.indexOf('[');
  if (start === -1) throw new Error('unexpected npm pack output');
  const data = JSON.parse(raw.slice(start));
  return data[0].files.map(f => f.path.replace(/\\/g, '/'));
}

const REQUIRED = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'bin/install.js',
  'src/hooks/selector-activate.js',
  'src/hooks/selector-match.js',
  'src/lib/scan.js',
  'src/lib/sanitize.js',
  'src/lib/rules.js',
  'skills/auto-selector-skill/SKILL.md',
  'README.md',
  'INSTALL.md',
  'LICENSE',
];

const FORBIDDEN = [
  'node_modules/',
  'mcp-server/',
  'test/',
  'eval/',
  'scripts/',
  '.github/',
  'install.sh',
  'install.ps1',
];

const files = packFiles();
let failed = 0;

for (const required of REQUIRED) {
  if (!files.includes(required)) {
    console.log(`✘ missing from package: ${required}`);
    failed++;
  }
}

for (const prefix of FORBIDDEN) {
  const hits = files.filter(f => f === prefix || f.startsWith(prefix));
  if (hits.length) {
    console.log(
      `✘ should not be packaged: ${hits.slice(0, 5).join(', ')}` +
      `${hits.length > 5 ? ` (+${hits.length - 5} more)` : ''}`
    );
    failed++;
  }
}

if (!failed) console.log(`✔ package is clean (${files.length} files)`);
process.exit(failed ? 1 : 0);
