#!/usr/bin/env node
'use strict';
// Generate the rules sections of SKILL.md and AGENTS.md from src/lib/rules.js.
//   node scripts/sync-docs.js          rewrite files
//   node scripts/sync-docs.js --check  fail if files are out of date

const fs = require('fs');
const path = require('path');
const { buildDocsRules } = require('../src/lib/rules');
const { writeTextAtomic } = require('../src/lib/scan');

const START = '<!-- AUTO-RULES START -->';
const END = '<!-- AUTO-RULES END -->';

const FILES = [
  path.join(__dirname, '..', 'skills', 'auto-selector-skill', 'SKILL.md'),
  path.join(__dirname, '..', 'AGENTS.md'),
];

function block() {
  return `${START}\n${buildDocsRules()}\n${END}`;
}

function detectEol(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function normalizeEol(content) {
  return content.replace(/\r\n/g, '\n');
}

function replaceBlock(content, next) {
  const re = new RegExp(
    START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' +
    END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  if (!re.test(content)) return null;
  return content.replace(re, () => next);
}

function main() {
  const check = process.argv.includes('--check');
  const next = block();
  let failed = 0;

  for (const file of FILES) {
    if (!fs.existsSync(file)) {
      console.log(`✘ missing: ${file}`);
      failed++;
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    const eol = detectEol(content);
    const updated = replaceBlock(content, next.replace(/\n/g, eol));
    if (updated === null) {
      console.log(`✘ no markers in ${path.relative(process.cwd(), file)}`);
      failed++;
      continue;
    }
    if (check) {
      if (normalizeEol(updated) !== normalizeEol(content)) {
        console.log(`✘ out of date: ${path.relative(process.cwd(), file)}`);
        failed++;
      } else {
        console.log(`✔ ${path.relative(process.cwd(), file)}`);
      }
    } else {
      writeTextAtomic(file, updated);
      console.log(`✔ wrote ${path.relative(process.cwd(), file)}`);
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
