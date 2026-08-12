---
name: auto-selector-skill
description: >
  FIRST-RESPONDER — activate BEFORE any other skill or response. On every user message,
  scan all installed skills and plugins, analyze the user's task, select the best matching
  skill/plugin, then ask the user to confirm before invoking. If user declines or no skill
  matches, fall back to default model behavior. Disable: "stop auto-selector". Re-enable: "start auto-selector".
---

# Auto Selector Skill — Skill & Plugin Dispatcher

**DEFAULT: ACTIVE.** This skill loads automatically at the start of every conversation.

- Off: "stop auto-selector" / "disable routing" / "手动模式"
- On: "start auto-selector" / "enable routing" / "自动路由"

## Core Flow

```
用户发消息
  ↓
扫描本地所有 skill/plugin → 收集候选列表
  ↓
模型分析用户任务 → 从候选中选出最合适的
  ↓
展示给用户确认："要用 [skill-name] 吗？"
  ↓
┌─ 用户确认 → 调用该 skill
├─ 用户取消 → 默认大模型直接回答
└─ 没匹配到任何 skill → 默认大模型直接回答
```

## Step 0: Scan (once per conversation)

On the first user message, read the full skill and plugin listing from the system-reminder. Build a dynamic route table:

1. List every skill name and its `description`
2. List every plugin name and what it does
3. For each, extract the **task keywords** from its description
4. Build the mapping: `task keyword → skill/plugin name`

**Do NOT use a hardcoded table.** The route table is whatever is actually installed on this machine.

## Step 1: Analyze & Select (every user message)

On every user message:

1. **Scan the message** for intent, task type, and context
2. **Match against the dynamic route table** from Step 0
3. **If no match found** → skip routing, respond normally with default model behavior
4. **If matches found** → collect all candidates, read their full descriptions, analyze which one best fits the user's actual task
5. **Select the best one** based on:
   - Specificity: `systematic-debugging` beats `claude-coder` for a bug
   - Workflow order: plan before code, code before test, test before review
   - User's project stage: early → explore/plan; mid → code/test; done → review/commit
6. **Present to user for confirmation** (see Step 2)

## Step 2: Confirm with User

After selecting the best skill/plugin, **always ask the user to confirm before invoking**:

```
🧠 Auto Selector 分析：

你的需求："我要做个新功能"
→ 匹配到 [writing-plans] — 先制定实施计划，再进行开发

要使用这个 skill 吗？
  ✅ 确认 → 使用 writing-plans
  ❌ 取消 → 我直接回答
```

### User responses

| User says | Action |
|-----------|--------|
| 确认 / 好的 / 用 / yes / go | Invoke the selected skill via `Skill` tool |
| 取消 / 不用 / 不需要 / no / skip | Cancel routing, respond with default model behavior |
| 换一个 / 用 X | Invoke the user's specified skill instead |
| 不确定 / 你觉得呢 | Briefly explain why this skill was chosen, then ask again |

### When to skip confirmation

Only skip confirmation when the user **explicitly says "直接用"** or **"不用问了"** in a previous message. Otherwise, always confirm.

## Step 3: Invoke or Fallback

**User confirms:**
→ Invoke via `Skill` tool → show `⚡ → skill-name`

**User cancels or no match:**
→ Respond normally with default model behavior. No skill needed. No error, no apology.

## Step 4: Learn

If the user corrects your routing choice:
1. Invoke the correct skill
2. Update your mental route table for this conversation

## Edge Cases

- **No skills installed**: respond normally, mention auto-router is active but found no skills
- **Skill invocation fails**: fall back to default model behavior
- **"skills" / "路由表" / "有什么可以用的"**: show the full scanned route table grouped by category
- **"直接用" / "不用问了"**: skip confirmation for remaining messages in this conversation

## Quick Reference

When user says "skills" / "路由表" / "有什么可以用的", display all scanned skills/plugins grouped by category.

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/auto-selector-skill.git
cp -r auto-selector-skill ~/.claude/plugins/cache/auto-selector-skill/auto-selector-skill/latest
```

Then add to `~/.claude/plugins/installed_plugins.json`:
```json
"auto-selector-skill@auto-selector-skill": [
  {
    "scope": "user",
    "installPath": "<your-home>/.claude/plugins/cache/auto-selector-skill/auto-selector-skill/latest",
    "version": "latest"
  }
]
```

Restart Claude Code to activate.
