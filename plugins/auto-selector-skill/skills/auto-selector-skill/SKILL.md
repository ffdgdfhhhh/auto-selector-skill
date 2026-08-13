---
name: auto-selector-skill
description: >
  FIRST-RESPONDER — activate BEFORE any other skill or response. On every user message,
  first understand the project context (tech stack, structure, conventions), then analyze
  the user's task in detail, match against all installed skills/plugins (supports multi-skill
  workflows), then use the AskUserQuestion tool for native form selection.
  If user declines or no skill matches, fall back to default model behavior.
  Supports blacklist, skip-confirm mode, and slash commands.
  Disable: "stop auto-selector". Re-enable: "start auto-selector".
---

# Auto Selector Skill — Intelligent Skill & Plugin Dispatcher

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
| `/auto-selector scan` | Re-scan project context and skill route table |

Natural language equivalents also work:
- "不要用 X" / "ignore X" / "blacklist X" → adds X to blacklist
- "恢复 X" / "unblacklist X" → removes X from blacklist
- "直接用" / "不用问了" → enables skip-confirm mode
- "stop auto-selector" / "手动模式" → disables
- "start auto-selector" / "自动路由" → enables
- "重新扫描" / "rescan" → re-run Step 0 + Step 0.5

## Core Flow

```
用户发消息
  ↓
[Step 0] 扫描可用 skill/plugin → 过滤黑名单 → 构建路由表
  ↓
[Step 0.5] 初始化项目认知 → 读取项目结构、技术栈、配置 → 建立项目上下文
  ↓
[Step 1] 基于「项目上下文 + 用户需求」分析任务 → 拆解子任务 → 识别需要的能力
  ↓
[Step 2] 匹配 skill → 单 skill 或多 skill → 按依赖排序 → 制定执行计划
  ↓
skip-confirm 模式？ → 直接按计划执行
不是 → 用 AskUserQuestion 弹出原生选择框
  ↓
┌─ 用户选择"推荐方案" → 按计划依次调用 skill
├─ 用户选择"跳过" → 默认大模型直接回答
└─ 没匹配到任何 skill → 默认大模型直接回答
```

---

## Step 0: Scan & Build Route Table (once per conversation start)

Read the full skill and plugin listing from the system-reminder. Build a dynamic route table:

1. **Read the system-reminder** for the complete skill & plugin listing
2. **Identify invocable skills** — look for the section titled `Available user-invocable skills in this session:` in the system-reminder. Only skills listed in THIS section can be invoked via the `Skill` tool.
3. For each invocable skill, extract the **task keywords** from its description
4. Build the mapping: `task keyword → skill/plugin name`
5. **Filter out blacklisted skills/plugins** — never suggest or invoke anything on the blacklist
6. **Mark non-invocable skills** — skills that appear in the system-reminder but are NOT in the "Available user-invocable skills" section cannot be invoked. Exclude them from the candidate list.

**Do NOT use a hardcoded table.** The route table is whatever is actually installed on this machine.

---

## Step 0.5: Project Context Initialization (once per conversation start, runs after Step 0)

Before matching any skill, **understand the current project**. This makes skill recommendations context-aware.

### What to scan

Read the project's key files to build a project profile:

1. **Project root** — list top-level files and directories
2. **Package/config files** (read whichever exist):
   - `package.json` → name, dependencies, scripts, framework
   - `tsconfig.json` / `jsconfig.json` → language, module system
   - `requirements.txt` / `pyproject.toml` / `Pipfile` → Python deps
   - `Cargo.toml` → Rust project
   - `go.mod` → Go project
   - `pom.xml` / `build.gradle` → Java project
   - `Makefile` / `Dockerfile` / `docker-compose.yml` → build/deploy setup
   - `.env.example` / `.env.local` → environment config
3. **Project structure** — scan `src/`, `app/`, `lib/`, `components/`, `pages/`, `tests/`, `test/`, `spec/` to understand layout
4. **Existing skills/config** — check `.claude/`, `.cursorrules`, `CLAUDE.md`, `AGENTS.md` for existing AI config
5. **Git info** (if available) — current branch, recent commits for context

### Project profile to build

```
📋 项目画像：
├─ 名称：{project-name}
├─ 语言：TypeScript / Python / Go / ...
├─ 框架：React / Next.js / Express / FastAPI / ...
├─ 构建工具：Vite / Webpack / esbuild / ...
├─ 测试框架：Jest / Vitest / pytest / ...
├─ 包管理：npm / pnpm / yarn / pip / ...
├─ 项目结构：monorepo / 单体 / 微服务
├─ 已有AI配置：CLAUDE.md / .cursorrules / ...
└─ 当前分支：feature/xxx
```

### How to use this profile

The project profile informs all downstream decisions:

| Project context | Skill recommendation impact |
|---|---|
| React + Tailwind project | `frontend-design` → suggest Tailwind patterns |
| No test framework installed | `test-driven-development` → warn about missing deps first |
| Python + FastAPI | `writing-plans` → plan in Python context |
| Monorepo with multiple packages | Recommend `domain-organize` for structure |
| Has CLAUDE.md already | Skip redundant config suggestions |
| On feature branch, uncommitted changes | `receiving-code-review` is timely |
| No `.cursorrules` or similar | Could suggest creating one |

### When to re-scan

- User says "重新扫描" / "rescan" / `/auto-selector scan`
- User mentions switching to a different project directory
- After major project changes (new framework, restructure)

---

## Step 1: Analyze (every user message)

Before matching any skill, **always analyze the user's request in the context of their project**:

1. **Check if message is a slash command** → handle it directly (see Slash Commands)
2. **Understand the request** — what does the user actually want to achieve?
3. **Consider project context** — how does this request relate to the current project?
   - Is this a new feature in an existing React app? → frontend-design + writing-plans
   - Is this a bug in a Python API? → systematic-debugging
   - Is this restructuring a monorepo? → domain-organize
4. **Break it down** — identify the sub-tasks involved:
   - What capabilities are needed? (planning, coding, testing, debugging, reviewing, designing, etc.)
   - What's the scope? (single task vs multi-step project)
   - What's the user's stage? (exploring → plan; building → code; done → review)
5. **Identify skill candidates** — which skills from the route table match each sub-task?
6. **Verify invocability** — each candidate MUST appear in `Available user-invocable skills in this session:`. Discard any that don't.
7. **If no invocable candidates remain** → skip routing, respond normally with default model behavior

**Never skip this analysis.** The user sees your understanding of their request before any skill recommendation.

---

## Step 2: Match & Plan (single-skill and multi-skill)

### Single-skill requests
When one skill clearly covers the entire request (e.g., "帮我做个计划" → `writing-plans`):
- Match that one skill
- Proceed to Step 3

### Multi-skill requests
When the request spans multiple capabilities (e.g., "设计个好看的页面，写完要测试" → `frontend-design` + `test-driven-development`):
1. Identify ALL needed skills
2. Order them by logical dependency:
   - Plan before code (`writing-plans` → `frontend-design`)
   - Code before test (`frontend-design` → `test-driven-development`)
   - Code before review (`frontend-design` → `code-review:correctness`)
   - Debug before fix (`systematic-debugging` → coding)
3. Create a brief execution plan showing each step and which skill handles it
4. Proceed to Step 3 with the full plan

### Conflict resolution (when multiple skills could match)
- **Specificity wins**: `systematic-debugging` > generic for bugs
- **Workflow order**: plan > code > test > review
- **Project context**: e.g., if the project has no test framework, flag that before recommending test skills
- **User emphasis**: if the user explicitly mentions a concern ("一定要测试"), that skill gets priority

---

## Step 3: Present & Confirm (use AskUserQuestion)

**CRITICAL: Use the `AskUserQuestion` tool for native form selection. Do NOT use text-based 1/2 input.**

After analysis and matching, present results using `AskUserQuestion`. The presentation MUST include:
- Your understanding of the user's request
- Relevant project context (if it affects the recommendation)
- The recommended skill(s) with reasoning

### Single-skill presentation

```
Use AskUserQuestion with:
  question: "🧠 需求分析：{分析总结}\n\n📁 项目：{项目名} ({技术栈})\n\n推荐使用 [{skill-name}] — {推荐理由}"
  header: "Skill选择"
  options:
    - label: "✅ 使用 {skill-name}"
      description: "{为什么推荐这个 skill}"
    - label: "❌ 跳过，直接回答"
      description: "不使用任何 skill，由模型直接回答"
```

### Multi-skill presentation

```
Use AskUserQuestion with:
  question: "🧠 需求分析：{分析总结}\n\n📁 项目：{项目名} ({技术栈})\n\n📋 推荐执行计划：\n1. [{skill-1}] — {作用}\n2. [{skill-2}] — {作用}\n3. [{skill-3}] — {作用}"
  header: "执行计划"
  options:
    - label: "✅ 执行完整计划"
      description: "按顺序调用以上 {N} 个 skill"
    - label: "⚡ 只执行第一步 [{skill-1}]"
      description: "只做第一步，后续手动决定"
    - label: "✏️ 修改计划"
      description: "我想调整 skill 选择或执行顺序"
    - label: "❌ 跳过，直接回答"
      description: "不使用任何 skill，由模型直接回答"
```

### Skip confirmation mode
When skip-confirm is on:
- Single skill → invoke directly, show `⚡ → {skill-name}`
- Multi-skill → execute full plan sequentially, show `⚡ [{i}/{N}] → {skill-name}`

---

## Step 4: Execute

**Single skill:**
→ Invoke via `Skill` tool → show `⚡ → {skill-name}`

**Multi-skill (sequential):**
→ Execute in order, each step uses the output of the previous:
1. `⚡ [1/3] → writing-plans` — complete
2. `⚡ [2/3] → frontend-design` — complete
3. `⚡ [3/3] → test-driven-development` — complete

**User cancels:**
→ Respond normally with default model behavior. No skill needed. No error, no apology.

---

## Step 5: Learn

If the user corrects your routing choice:
1. Invoke the correct skill
2. Update your mental route table for this conversation
3. Note the correction for future messages in this session

---

## Blacklist

The blacklist lets users permanently exclude specific skills/plugins from auto-selection.

- **Add**: `/auto-selector blacklist add <skill-name>` or "不要用 <skill-name>"
- **Remove**: `/auto-selector blacklist remove <skill-name>` or "恢复 <skill-name>"
- **List**: `/auto-selector blacklist list`
- **Clear**: `/auto-selector blacklist clear`

Blacklisted skills are still visible in `/auto-selector list` but marked with 🚫 and never auto-selected.

---

## Edge Cases

- **No skills installed**: respond normally, mention auto-selector is active but found no skills
- **Skill invocation fails** (Skill tool returns "Unknown skill"): learn that this skill is not invocable, remove it from the candidate list for the rest of the conversation, try the next best match or fall back to default behavior. Never offer the same non-invocable skill again.
- **Matched skill not in invocable list**: skip it silently, try next candidate. Do not offer skills that cannot actually be invoked.
- **"skills" / "路由表" / "有什么可以用的"**: show the full scanned route table grouped by category
- **"直接用" / "不用问了"**: enable skip-confirm for remaining messages in this conversation
- **No project files found** (empty dir, no package.json etc): skip project analysis, proceed with skill matching based on request alone
- **Project changes mid-conversation** (user says "switch to other project"): re-run Step 0.5 with the new path
