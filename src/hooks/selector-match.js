#!/usr/bin/env node
// auto-selector-skill — UserPromptSubmit hook
// Read pre-built index, output categories for AI to judge

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INDEX_PATH = path.join(HOME, '.claude', 'auto-selector-index.json');

// Read pre-built index
let index = null;
try {
  if (fs.existsSync(INDEX_PATH)) {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  }
} catch (e) {
  console.error(`[auto-selector] Error reading index: ${e.message}`);
}

// If no index, skip
if (!index || !index.categories || index.categories.length === 0) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ""
    }
  }));
  process.exit(0);
}

// Output category list for AI to make the decision
const categoryList = index.categories.map(cat => {
  const skillCount = cat.skills.length;
  const skillNames = cat.skills.map(s => s.name).join(', ');
  return `• ${cat.name} (${skillCount} skills: ${skillNames})`;
}).join('\n');

const context = `<AUTO_SELECTORRouting>
用户消息需要分析是否匹配以下 skill category（共 ${index.categories.length} 个大类，${index.totalSkills} 个 skill）：

${categoryList}

请判断用户需求是否匹配某个 category。
如果匹配 → 调用 AskUserQuestion 推荐该 category
如果不匹配 → 正常回答

匹配原则：按语义理解，不按关键词。
</AUTO_SELECTORRouting>`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: context
  }
}));
