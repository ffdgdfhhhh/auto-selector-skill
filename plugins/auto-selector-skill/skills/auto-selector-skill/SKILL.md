---
name: auto-selector-skill
description: >
  FIRST-RESPONDER — activate BEFORE any other skill or response. On every user message,
  scan all installed skills and plugins, analyze the user's task, select the best matching
  skill/plugin, then ask the user to confirm before invoking. If user declines or no skill
  matches, fall back to default model behavior. Supports blacklist, skip-confirm mode, and
  slash commands. Disable: "stop auto-selector". Re-enable: "start auto-selector".
---

# Auto Selector Skill — Skill & Plugin Dispatcher

**DEFAULT: ACTIVE.** This skill loads automatically at the start of every conversation.

## Slash Commands

| Command | Effect |
|---------|--------|
| `/auto-selector help` | Show all available commands |
| `/auto-selector on` | Enable auto-selector |
| `/auto-selector off` | Disable auto-selector |
| `/auto-selector list` | Show all detected skills/plugins grouped by category |
| `/auto-selector skip-confirm on` | Skip confirmation, auto-invoke matched skills |
| `/auto-selector skip-confirm off` | Restore confirmation (default) |
| `/auto-selector blacklist add <skill>` | Add a skill to the blacklist |
| `/auto-selector blacklist remove <skill>` | Remove a skill from the blacklist |
| `/auto-selector blacklist list` | Show current blacklist |
| `/auto-selector blacklist clear` | Clear all blacklisted skills |
| `/auto-selector status` | Show current state (on/off, blacklist, skip-confirm) |

Natural language equivalents also work:
- "不要用 X" / "ignore X" / "blacklist X" → adds X to blacklist
- "恢复 X" / "unblacklist X" → removes X from blacklist
- "直接用" / "不用问了" → enables skip-confirm mode
- "stop auto-selector" / "手动模式" → disables
- "start auto-selector" / "自动路由" → enables

## Core Flow

```
用户发消息
  ↓
扫描本地所有 skill/plugin → 过滤掉黑名单中的 → 收集候选列表
  ↓
模型分析用户任务 → 从候选中选出最合适的
  ↓
skip-confirm 模式？ → 直接调用
不是 → 展示给用户确认："要用 [skill-name] 吗？"
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
5. **Filter out blacklisted skills/plugins** — never suggest or invoke anything on the blacklist

**Do NOT use a hardcoded table.** The route table is whatever is actually installed on this machine.

## Step 1: Analyze & Select (every user message)

On every user message:

1. **Check if message is a slash command** → handle it directly (see Slash Commands)
2. **Scan the message** for intent, task type, and context
3. **Match against the dynamic route table** from Step 0 (excluding blacklist)
4. **If no match found** → skip routing, respond normally with default model behavior
5. **If matches found** → collect all candidates, read their full descriptions, analyze which one best fits the user's actual task
6. **Select the best one** based on:
   - Specificity: `systematic-debugging` beats `claude-coder` for a bug
   - Workflow order: plan before code, code before test, test before review
   - User's project stage: early → explore/plan; mid → code/test; done → review/commit
7. **If skip-confirm is on** → invoke directly (show `⚡ → skill-name`)
8. **If skip-confirm is off** → present to user for confirmation (see Step 2)

## Step 2: Confirm with User

After selecting the best skill/plugin, **ask the user to confirm before invoking**:

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

### Skip confirmation

- User says "直接用" / "不用问了" → enable skip-confirm for this conversation
- User says `/auto-selector skip-confirm on` → enable
- User says `/auto-selector skip-confirm off` → disable

## Step 3: Invoke or Fallback

**User confirms or skip-confirm on:**
→ Invoke via `Skill` tool → show `⚡ → skill-name`

**User cancels or no match:**
→ Respond normally with default model behavior. No skill needed. No error, no apology.

## Step 4: Learn

If the user corrects your routing choice:
1. Invoke the correct skill
2. Update your mental route table for this conversation

## Blacklist

The blacklist lets users permanently exclude specific skills/plugins from auto-selection.

- **Add**: `/auto-selector blacklist add <skill-name>` or "不要用 <skill-name>"
- **Remove**: `/auto-selector blacklist remove <skill-name>` or "恢复 <skill-name>"
- **List**: `/auto-selector blacklist list`
- **Clear**: `/auto-selector blacklist clear`

Blacklisted skills are still visible in `/auto-selector list` but marked with 🚫 and never auto-selected.

## Edge Cases

- **No skills installed**: respond normally, mention auto-selector is active but found no skills
- **Skill invocation fails**: fall back to default model behavior
- **"skills" / "路由表" / "有什么可以用的"**: show the full scanned route table grouped by category
- **"直接用" / "不用问了"**: enable skip-confirm for remaining messages in this conversation
