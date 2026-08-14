---
name: auto-selector-skill
description: >
  FIRST-RESPONDER — activate on every user message. On conversation start, scan all
  installed skills/plugins and build a lookup index. On each user message, match the
  request against the index. If a skill matches, use AskUserQuestion to ask the user.
  If nothing matches, shut up and do the work yourself.
  Disable: "stop auto-selector". Re-enable: "start auto-selector".
---

# Auto Selector Skill — 能甩就甩，甩不了自己干

**DEFAULT: ACTIVE.** This skill loads automatically at the start of every conversation.

## Core Flow

```
用户发消息
  ↓
[Step 0] 会话开始时扫描一次 → 建 skill 索引表
  ↓
[Step 1] 查索引表 → 有匹配？ → 弹窗问用户
  ↓                    ↓
  ↓                  没匹配 → 直接干活，不废话
  ↓
[Step 2] 用户确认 → 调用 skill
         用户拒绝 → 直接干活，不废话
```

---

## Step 0: Build Skill Index (once per conversation start, ONCE ONLY)

**扫描一次，整个会话复用。不要每次都重新扫描。**

1. Read the system-reminder for all installed skills/plugins
2. Only include skills in the `Available user-invocable skills in this session:` section
3. Build a compact lookup index:

```
| Skill Name | What It Does | Keywords |
|---|---|---|
| writing-plans | 帮用户做技术方案、拆解任务、规划实现路径 | 计划、规划、方案、拆解、plan |
| frontend-design | 前端 UI 设计、组件布局、样式、主题 | UI、页面、设计、组件、布局、样式 |
| test-driven-development | TDD 测试编写 | 测试、test、单测、TDD |
| ... | ... | ... |
```

4. Store this index — reuse it for ALL subsequent messages in this conversation. Do NOT re-scan.
5. If user says "重新扫描" / "rescan" → rebuild the index. Otherwise never re-scan.

---

## Step 1: Match (every user message)

**One step. Look at the message, check the index, done.**

1. Read the user's message
2. Scan the index for matching skills
   - Match based on what the user is asking to do
   - Multiple skills can match (multi-skill plan)
   - No skill matches → **stop here, respond normally. No explanation needed.**
3. If matched, go to Step 2

**Do not over-analyze.** Don't break down sub-tasks, don't consider project context, don't identify capabilities. Just: "does this message match any skill in the index?"

---

## Step 2: Confirm & Execute

**Use the `AskUserQuestion` tool with this EXACT format:**

### Single skill match:

```json
AskUserQuestion({
  "questions": [{
    "question": "推荐使用 [{skill-name}] — {这个skill干什么}",
    "header": "Skill推荐",
    "options": [
      {"label": "✅ 使用 {skill-name}", "description": "{一句话说明这个skill能帮你做什么}"},
      {"label": "❌ 不用，直接回答", "description": "跳过 skill，由模型直接回答你的问题"}
    ],
    "multiSelect": false
  }]
})
```

### Multi-skill match:

```json
AskUserQuestion({
  "questions": [{
    "question": "📋 推荐执行计划：\n1. [{skill-1}] — {作用}\n2. [{skill-2}] — {作用}",
    "header": "执行计划",
    "options": [
      {"label": "✅ 执行完整计划", "description": "按顺序调用以上 {N} 个 skill"},
      {"label": "⚡ 只执行第一步 [{skill-1}]", "description": "只做第一步，后续手动决定"},
      {"label": "❌ 跳过，直接回答", "description": "不使用任何 skill，由模型直接回答"}
    ],
    "multiSelect": false
  }]
})
```

**After user confirms:** Single → `Skill` tool. Multi → execute sequentially.
**After user declines:** Respond normally. No error, no apology.

---

## Slash Commands (keep minimal)

| Command | Effect |
|---------|--------|
| `/auto-selector on` | Enable |
| `/auto-selector off` | Disable |
| `/auto-selector list` | Show skill index |

Natural language: "stop auto-selector" / "手动模式" → off. "start auto-selector" → on.

---

## Edge Cases

- **No skills installed** → respond normally, don't mention auto-selector
- **Skill invocation fails** ("Unknown skill") → remove from index, try next match or respond normally
- **No match** → respond normally. Do NOT say "no skill matched" or explain why. Just do the work.
- **User corrects your choice** → invoke the correct skill, update index for this session

---

## Step 3: Learn & Persist (when user corrects or gives feedback)

When the user gives feedback about skill routing, persist it to `CLAUDE.md` so it survives across sessions:

1. **User says "以后 XX 都用 YY"** → write to CLAUDE.md:
   ```
   ## Auto Selector Preferences
   - When user asks about XX → always use skill YY
   ```

2. **User blacklists a skill** → write to CLAUDE.md:
   ```
   ## Auto Selector Preferences
   - Never suggest skill ZZ (user blacklisted)
   ```

3. **User corrects routing multiple times** → write to CLAUDE.md:
   ```
   ## Auto Selector Preferences
   - For "做个计划" type requests → use writing-plans (not work-planner)
   ```

**Rules:**
- Only write when user explicitly gives feedback or corrects you
- Read existing CLAUDE.md first, append under `## Auto Selector Preferences` section — don't overwrite other content
- Keep entries short and actionable
- If the section already exists, append new entries — don't duplicate
