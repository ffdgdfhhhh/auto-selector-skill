# auto-selector-skill

> **你的 AI 助手的智能路由层** — 能甩就甩，甩不了自己干

[![npm version](https://img.shields.io/npm/v/auto-selector-skill)](https://www.npmjs.com/package/auto-selector-skill)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude-Code-purple)](https://claude.ai)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green)](https://modelcontextprotocol.io)

---

## 一句话介绍

装了一堆 AI 插件但记不住名字？**auto-selector-skill** 自动帮你匹配 — 有 skill 能用就问你要不要用，没有就直接干活。

---

## 工作原理

```
用户输入需求
     ↓
auto-selector-skill 介入（你感觉不到它的存在）
     ↓
 ┌─ 有 skill 能用？ → 弹窗问你："要用吗？"
 │                     你点一下 → skill 自动执行
 │
 └─ 没有？ → 直接干活，不废话
```

---

## 支持平台

| 平台 | 加载方式 | 匹配方式 | 确认方式 |
|---|---|---|---|
| **Claude Code** | SessionStart hook 自动注入 | 系统自动列出 skill | ✅ 原生弹窗 (AskUserQuestion) |
| **Cursor** | `.cursorrules` + MCP | MCP 工具 `match_skill` | 文字确认 |
| **Windsurf** | `.windsurfrules` + MCP | MCP 工具 `match_skill` | 文字确认 |
| **Cline** | `.clinerules` + MCP | MCP 工具 `match_skill` | 文字确认 |
| **GitHub Copilot** | `copilot-instructions.md` + MCP | MCP 工具 `match_skill` | 文字确认 |
| **Gemini CLI** | `gemini-extension.json` | 手动扫描 | 文字确认 |
| **Codex** | `.codex/config.toml` | 手动扫描 | 文字确认 |

---

## 快速安装

### Claude Code（推荐）

```bash
npx auto-selector-skill
```

一条命令搞定。重启 Claude Code 生效。

### Cursor / Windsurf / Cline / Copilot

```bash
npx skills add ffdgdfhhhh/auto-selector-skill -a cursor
# 或 -a windsurf / -a cline / -a github-copilot
```

然后启动 MCP server：

```bash
cd mcp-server && npm install && npm start
```

### Gemini CLI

```bash
gemini extensions install https://github.com/ffdgdfhhhh/auto-selector-skill
```

---

## MCP Server

所有支持 MCP 的平台都可以通过 MCP server 获得原生工具调用能力。

### 提供的工具

| 工具 | 作用 |
|---|---|
| `scan_skills` | 扫描项目中的所有可用 skill，建立索引 |
| `match_skill` | 将用户请求与 skill 索引匹配 |
| `list_skills` | 列出所有已注册的 skill |

### 配置方式

每个平台的 MCP 配置文件已包含在项目中：

- Cursor: `.cursor/mcp.json`
- Windsurf: `.windsurf/mcp.json`
- VS Code / Copilot: `.vscode/mcp.json`

只需确保 `mcp-server/index.js` 路径正确即可。

---

## 使用示例

**用户说：** `帮我做个计划`

**auto-selector-skill：**
> 推荐使用 [writing-plans] — 帮你做技术方案、拆解任务。要用吗？

**用户说：** `好`

**auto-selector-skill：** → 自动调用 writing-plans skill

---

**用户说：** `重构这个组件，加上单元测试`

**auto-selector-skill：**
> 📋 推荐执行计划：
> 1. [tech-debt-analyzer] — 分析代码质量
> 2. [test-writer] — 生成单元测试
>
> 按顺序执行？(全部 / 只第一步 / 跳过)

**用户说：** `全部`

**auto-selector-skill：** → 依次调用两个 skill

---

## 项目结构

```
auto-selector-skill/
├── .claude-plugin/plugin.json          # Claude Code 插件配置
├── src/hooks/selector-activate.js      # Claude Code SessionStart hook
├── plugins/.../SKILL.md                # 核心路由逻辑（Claude Code）
├── mcp-server/                         # MCP server（多平台共享）
│   ├── package.json
│   └── index.js
├── .cursor/mcp.json                    # Cursor MCP 配置
├── .windsurf/mcp.json                  # Windsurf MCP 配置
├── .vscode/mcp.json                    # VS Code/Copilot MCP 配置
├── .cursorrules                        # Cursor 规则文件
├── .windsurfrules                      # Windsurf 规则文件
├── .clinerules                         # Cline 规则文件
├── .github/copilot-instructions.md     # GitHub Copilot 规则
├── GEMINI.md                           # Gemini CLI 规则
├── gemini-extension.json               # Gemini CLI 扩展配置
├── .codex/config.toml                  # Codex 配置
└── AGENTS.md                           # 通用 agents 规则
```

---

## 许可证

MIT © [ffdgdfhhhh](https://github.com/ffdgdfhhhh)
