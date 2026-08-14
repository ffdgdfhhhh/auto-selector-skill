---
name: auto-selector-skill
description: >
  MANDATORY — On every user message, check available skills. If match found,
  call AskUserQuestion before responding. If no match, respond normally.
---

**MANDATORY RULE — Follow on EVERY user message:**

1. Find the section in your system context titled "Available user-invocable skills in this session"
2. Read each skill listed there (name and description)
3. Does the user's current message match any skill by meaning?
4. If YES → call AskUserQuestion tool FIRST:
   - question: "推荐使用 [skill名] — {description}"
   - header: "Skill"
   - options: [{"label": "✅ 使用", "description": "用这个skill帮你做"}, {"label": "❌ 不用", "description": "跳过，直接回答"}]
   - multiSelect: false
5. If NO → respond normally

Match examples: "做个计划" → planning skill. "设计页面" → UI skill. "写测试" → test skill.
