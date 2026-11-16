#!/usr/bin/env node
'use strict';
// Cross-platform test runner: node scripts/test.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = path.join(__dirname, '..', 'test');
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.test.js'))
  .sort()
  .map(f => path.join(dir, f));

if (files.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
