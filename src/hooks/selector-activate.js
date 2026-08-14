#!/usr/bin/env node
// auto-selector-skill — Claude Code SessionStart hook
// Outputs JSON in the same format as superpowers plugin

const fs = require('fs');
const path = require('path');

function findSkillFile() {
  const candidates = [
    path.join(__dirname, '..', '..', 'plugins', 'auto-selector-skill', 'skills', 'auto-selector-skill', 'SKILL.md'),
    path.join(__dirname, '..', '..', 'skills', 'auto-selector-skill', 'SKILL.md'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return null;
}

const skillPath = findSkillFile();

let skillContent = '';

if (skillPath) {
  const content = fs.readFileSync(skillPath, 'utf8');
  skillContent = content.replace(/^---[\s\S]*?---\s*/, '').trim();
} else {
  skillContent = `**MANDATORY RULE — Follow on EVERY user message:**

1. Find the section in your system context titled "Available user-invocable skills in this session"
2. Read each skill listed there (name and description)
3. Does the user's current message match any skill by meaning?
4. If YES → call AskUserQuestion tool FIRST
5. If NO → respond normally

Match examples: "做个计划" → planning skill. "设计页面" → UI skill. "写测试" → test skill.`;
}

// Escape for JSON embedding
function escapeForJson(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

const context = `<EXTREMELY_IMPORTANT>
You have auto-selector-skill active.

**Below are your MANDATORY routing rules. You MUST follow them on EVERY user message:**

${skillContent}
</EXTREMELY_IMPORTANT>`;

// Output JSON — default to Claude Code format (hookSpecificOutput)
// Also works for Cursor (additional_context) and Copilot (additionalContext)
if (process.env.CURSOR_PLUGIN_ROOT) {
  console.log(JSON.stringify({ additional_context: context }));
} else {
  // Claude Code format (default) — also works for Copilot CLI
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context
    }
  }));
}
