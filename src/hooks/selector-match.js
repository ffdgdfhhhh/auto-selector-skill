#!/usr/bin/env node
// auto-selector-skill — UserPromptSubmit hook
// Remind AI of the two-step process and show category list

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INDEX_DIR = path.join(HOME, '.claude', 'auto-selector');
const INDEX_PATH = path.join(INDEX_DIR, 'index.json');

// Read index
let index = null;
try {
  if (fs.existsSync(INDEX_PATH)) {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  }
} catch (e) {
  console.error(`[auto-selector] Error reading index: ${e.message}`);
}

if (!index || !index.categories || index.categories.length === 0) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ""
    }
  }));
  process.exit(0);
}

// Build brief category list
const categoryList = index.categories.map(c =>
  `• ${c.name} (${c.skillCount} skills) — ${c.description}`
).join('\n');

const context = `<AUTO_SELECTORRouting>
**两级选择流程：**

1. 从以下大类中选择匹配的一个：

${categoryList}

2. 读取该大类的详细文件（路径：${INDEX_DIR}/categories/<文件名>.md）
3. 从详细列表中选择最合适的 skill
4. 调用 AskUserQuestion 推荐给用户

如果无匹配 → 直接回答
</AUTO_SELECTORRouting>`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: context
  }
}));
