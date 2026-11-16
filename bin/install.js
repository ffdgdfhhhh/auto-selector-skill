#!/usr/bin/env node
// auto-selector-skill — installer for the official Claude Code marketplace.
//
// The plugin is distributed through the GitHub-hosted marketplace. This CLI
// only delegates to `claude plugin ...`; it never copies files into the cache
// or writes to other agents' global config/rule files.
//
// Usage: npx auto-selector-skill [--dry-run] [--uninstall] [--list]

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PLUGIN = 'auto-selector-skill';
const MARKETPLACE = 'auto-selector-skill';
const REPO = 'ffdgdfhhhh/auto-selector-skill';
const KEY = `${PLUGIN}@${MARKETPLACE}`;
const SHELL = process.platform === 'win32'; // claude is a .cmd shim on Windows

function buildCommands() {
  return {
    install: [
      ['claude', ['plugin', 'marketplace', 'add', REPO]],
      ['claude', ['plugin', 'install', KEY]],
    ],
    uninstall: [
      ['claude', ['plugin', 'uninstall', KEY]],
      ['claude', ['plugin', 'marketplace', 'remove', MARKETPLACE]],
    ],
  };
}

function run(command, args) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    encoding: 'utf8',
    shell: SHELL,
  });
}

function hasClaude() {
  const result = spawnSync('claude', ['--version'], {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: SHELL,
  });
  return result.status === 0;
}

function printCommands(commands) {
  for (const [command, args] of commands) {
    console.log(`  ${command} ${args.join(' ')}`);
  }
}

function printFallback() {
  console.error('   Install Claude Code first: https://claude.ai/code');
  console.error('   Then run:');
  printCommands(buildCommands().install);
}

function install() {
  if (!hasClaude()) {
    console.error('✘ Claude Code CLI not found.');
    printFallback();
    return 1;
  }

  for (const [command, args] of buildCommands().install) {
    const result = run(command, args);
    if (result.status !== 0) {
      console.error(`✘ failed: ${command} ${args.join(' ')}`);
      return result.status || 1;
    }
  }

  console.log(`\n🎉 ${PLUGIN} installed. Restart Claude Code to activate.`);
  return 0;
}

function uninstall() {
  if (!hasClaude()) {
    console.error('✘ Claude Code CLI not found.');
    printFallback();
    return 1;
  }

  let failed = false;
  for (const [command, args] of buildCommands().uninstall) {
    const result = run(command, args);
    if (result.status !== 0) failed = true;
  }

  console.log(failed
    ? '\n⚠️  Some removal steps reported an error (the plugin may not have been installed).'
    : `\n🎉 ${PLUGIN} uninstalled. Restart Claude Code.`);
  console.log('   Your blacklist file was kept: ~/.auto-selector-skill-blacklist.json');
  return failed ? 1 : 0;
}

// ── Blacklist helpers ────────────────────────────────────────────────────────
const BLACKLIST_FILE = path.join(os.homedir(), '.auto-selector-skill-blacklist.json');

function readBlacklist() {
  try {
    const parsed = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch (e) {
    return [];
  }
}

function writeBlacklist(list) {
  const seen = new Set();
  const unique = [];
  for (const item of list) {
    const name = String(item || '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(unique, null, 2) + '\n');
}

function blacklistArgs(args) {
  const value = flag => {
    const i = args.indexOf(flag);
    return i === -1 ? null : args[i + 1];
  };

  if (args.includes('--blacklist-list')) {
    const list = readBlacklist();
    console.log(list.length
      ? `📋 Blacklist (${list.length}):\n${list.map(n => `  🚫 ${n}`).join('\n')}`
      : '📋 Blacklist is empty.');
    return 0;
  }

  if (args.includes('--blacklist-clear')) {
    writeBlacklist([]);
    console.log('✅ Blacklist cleared.');
    return 0;
  }

  const add = value('--blacklist-add');
  if (add) {
    const list = readBlacklist();
    if (list.some(n => n.toLowerCase() === add.toLowerCase())) {
      console.log(`⚠️  "${add}" is already blacklisted.`);
    } else {
      writeBlacklist([...list, add]);
      console.log(`🚫 Added "${add}" to blacklist.`);
    }
    return 0;
  }

  const remove = value('--blacklist-remove');
  if (remove) {
    const list = readBlacklist();
    const target = remove.toLowerCase();
    if (!list.some(n => n.toLowerCase() === target)) {
      console.log(`⚠️  "${remove}" is not in the blacklist.`);
    } else {
      writeBlacklist(list.filter(n => n.toLowerCase() !== target));
      console.log(`✅ Removed "${remove}" from blacklist.`);
    }
    return 0;
  }

  return null;
}

function help() {
  const pkg = require('../package.json');
  console.log(`
auto-selector-skill v${pkg.version}

Official install (Claude Code):
  claude plugin marketplace add ${REPO}
  claude plugin install ${KEY}

This CLI is a wrapper around those two commands:
  npx auto-selector-skill                  Install
  npx auto-selector-skill --dry-run        Print commands without running
  npx auto-selector-skill --uninstall      Remove plugin + marketplace
  npx auto-selector-skill --list           Show detection status

Blacklist management (works without Claude Code):
  npx auto-selector-skill --blacklist-add <name>
  npx auto-selector-skill --blacklist-remove <name>
  npx auto-selector-skill --blacklist-list
  npx auto-selector-skill --blacklist-clear

Docs: ${pkg.homepage}
`);
}

function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    help();
    return 0;
  }

  const blacklist = blacklistArgs(argv);
  if (blacklist !== null) return blacklist;

  if (argv.includes('--list')) {
    console.log(`🔍 Claude Code CLI: ${hasClaude() ? 'found' : 'not found'}`);
    console.log(`   marketplace: ${REPO}`);
    console.log(`   plugin:      ${KEY}`);
    return hasClaude() ? 0 : 1;
  }

  if (argv.includes('--dry-run')) {
    console.log('Would run:');
    printCommands(argv.includes('--uninstall')
      ? buildCommands().uninstall
      : buildCommands().install);
    return 0;
  }

  if (argv.includes('-u') || argv.includes('--uninstall')) return uninstall();
  return install();
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { buildCommands, REPO, KEY };
