#!/usr/bin/env node
'use strict';
// One version, four manifests. Fails when package.json, plugin.json,
// marketplace.json, or mcp-server/package.json disagree.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function main() {
  const pkg = read('package.json');
  const plugin = read('.claude-plugin/plugin.json');
  const market = read('.claude-plugin/marketplace.json');

  const entry = Array.isArray(market.plugins)
    ? market.plugins.find(p => p && p.name === plugin.name)
    : null;

  const checks = [
    ['plugin.json', plugin.version],
    ['marketplace.json', entry && entry.version],
  ];

  let failed = 0;
  for (const [name, value] of checks) {
    if (!value) {
      console.log(`✘ ${name}: version missing`);
      failed++;
    } else if (value !== pkg.version) {
      console.log(`✘ ${name}: ${value} != package.json ${pkg.version}`);
      failed++;
    } else {
      console.log(`✔ ${name}: ${value}`);
    }
  }

  const mcpPath = path.join(root, 'mcp-server', 'package.json');
  if (fs.existsSync(mcpPath)) {
    const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    if (mcp.version !== pkg.version) {
      console.log(`✘ mcp-server/package.json: ${mcp.version} != ${pkg.version}`);
      failed++;
    } else {
      console.log(`✔ mcp-server/package.json: ${mcp.version}`);
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
