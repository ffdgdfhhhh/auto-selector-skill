#!/usr/bin/env node
// auto-selector-skill — Claude Code SessionStart hook
//
// Runs on every session start:
//   1. Reads SKILL.md (single source of truth)
//   2. Strips YAML frontmatter
//   3. Emits routing instructions as hidden system context

const fs = require('fs');
const path = require('path');

// Resolve SKILL.md path — works both as plugin and standalone
function findSkillFile() {
  const candidates = [
    // Plugin install: hooks/ -> ../../plugins/auto-selector-skill/skills/auto-selector-skill/SKILL.md
    path.join(__dirname, '..', '..', 'plugins', 'auto-selector-skill', 'skills', 'auto-selector-skill', 'SKILL.md'),
    // Fallback: hooks/ -> ../../skills/auto-selector-skill/SKILL.md
    path.join(__dirname, '..', '..', 'skills', 'auto-selector-skill', 'SKILL.md'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return null;
}

const skillPath = findSkillFile();

if (!skillPath) {
  // Minimal fallback when SKILL.md is not found
  process.stdout.write(
    'AUTO-SELECTOR-SKILL ACTIVE\n\n' +
    'Before responding to any user message:\n' +
    '1. Scan all installed skills and plugins from the system-reminder listing.\n' +
    '2. If a skill/plugin matches the user request, select the best one.\n' +
    '3. Present your selection to the user for confirmation before invoking.\n' +
    '4. If user declines or no match found, respond with default model behavior.\n' +
    '5. Say "stop auto-selector" to disable, "start auto-selector" to re-enable.'
  );
  process.exit(0);
}

// Read and strip YAML frontmatter
const content = fs.readFileSync(skillPath, 'utf8');
const body = content.replace(/^---[\s\S]*?---\s*/, '');

process.stdout.write('AUTO-SELECTOR-SKILL ACTIVE\n\n' + body);
