---
name: auto-selector-skill
description: >
  MANDATORY — On every user message, check available skills. If match found,
  call AskUserQuestion before responding. If no match, respond normally.
---

**MANDATORY RULE — Follow on EVERY user message:**

1. Read the skill list from system context (注入的 skill 索引)
2. 分析用户意图，判断是否匹配某个 skill
3. **有匹配** → 调用 AskUserQuestion 工具：
   - question: "推荐使用 [skill名] — {description}"
   - header: "Skill"
   - options: [{"label": "✅ 使用", "description": "用这个skill帮你做"}, {"label": "❌ 不用", "description": "跳过，直接回答"}]
   - multiSelect: false
4. **没有匹配** → 直接回答用户问题

## 匹配原则

- **按语义理解**，不是关键词匹配
- "帮我做个网页" → 找到 UI/UX 相关 skill
- "重构代码" → 找到代码简化/审查相关 skill
- "写测试" → 找到测试相关 skill
- "做个计划" → 找到项目规划相关 skill
- 不确定时，优先推荐

## 规则

- 用户说"不用" → 不道歉，下次继续推荐
- 复杂需求可推荐多个 skill
- 每次用户消息都触发匹配
