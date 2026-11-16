#!/usr/bin/env node
'use strict';
// auto-selector-skill — blacklist helper
// Usage: node blacklist.js add <skill> | remove <skill> | list

const fs = require('fs');
const { getHome, blacklistPath, writeJsonAtomic } = require('../lib/scan');

const FILE = blacklistPath(getHome());

function read() {
  if (!fs.existsSync(FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed.filter(x => typeof x === 'string');
  } catch (e) {
    try {
      fs.copyFileSync(FILE, FILE + '.bak');
      console.error(`[auto-selector] Invalid blacklist backed up to ${FILE}.bak`);
    } catch (_) {}
    return [];
  }
}

// Dedupe case-insensitively while preserving the first spelling.
function write(list) {
  const seen = new Set();
  const unique = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const name = item.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  writeJsonAtomic(FILE, unique);
  return unique;
}

const [cmd, name] = process.argv.slice(2);
const list = read();

if (cmd === 'add' && name) {
  if (list.some(x => x.toLowerCase() === name.toLowerCase())) {
    console.log(`already blacklisted: ${name}`);
  } else {
    write([...list, name]);
    console.log(`blacklisted: ${name}`);
  }
} else if (cmd === 'remove' && name) {
  const target = name.toLowerCase();
  const exact = list.filter(x => x.toLowerCase() === target);

  if (exact.length === 0) {
    // A broader entry may be hiding this name via prefix matching.
    const hiding = list.find(x => target.startsWith(x.toLowerCase() + '-'));
    if (hiding) {
      console.log(`not removed: "${name}" is hidden by blacklist entry "${hiding}". Remove "${hiding}" instead.`);
      process.exit(2);
    }
    console.log(`not found: ${name}`);
    process.exit(0);
  }

  write(list.filter(x => x.toLowerCase() !== target));
  console.log(`removed: ${name}`);
} else if (cmd === 'list') {
  console.log(list.length ? list.join('\n') : '(empty)');
} else {
  console.error('Usage: node blacklist.js add|remove|list [name]');
  process.exit(1);
}
