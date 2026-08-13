<div align="center">

# 🎯 Auto Selector Skill

**AI 编码助手的智能路由层**

[![npm version](https://img.shields.io/npm/v/auto-selector-skill?color=blue&label=npm&logo=npm)](https://www.npmjs.com/package/auto-selector-skill)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-yellow?logo=node.js)](https://nodejs.org)
[![GitHub Stars](https://img.shields.io/github/stars/ffdgdfhhhh/auto-selector-skill?style=social)](https://github.com/ffdgdfhhhh/auto-selector-skill)

*装了它，你再也不用记 `/skill-name`。*

支持 **Claude Code · Codex · Gemini CLI · Cursor · Windsurf · Cline · Copilot**

[快速安装](#-快速开始) · [功能特性](#-功能特性) · [支持平台](#-支持平台) · [详细文档](INSTALL.md)

</div>

---

## ⚡ 快速开始

```bash
npx auto-selector-skill
```

重启你的 AI 编码助手，完成。✅

---

## 🔄 工作流程

```
你发消息
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  Step 0   扫描本地 skill/plugin → 过滤黑名单 → 构建路由表   │
│  Step 0.5 初始化项目认知 → 读取技术栈、结构 → 建立项目画像   │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  Step 1   基于「项目上下文 + 用户需求」分析任务              │
│           → 拆解子任务 → 识别需要的能力                     │
│  Step 2   匹配 1~N 个 skill → 按依赖排序 → 生成执行计划     │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  Step 3   弹出原生选择框（AskUserQuestion）                 │
│           → 展示分析结果 + 推荐方案                        │
└─────────────────────────────────────────────────────────┘
  │
  ├─ ✅ 确认推荐 → 按计划依次调用 skill
  ├─ ✏️ 修改计划 → 调整 skill 或顺序
  └─ ❌ 跳过     → 大模型直接回答
```

### 实际演示

**你输入：**
> 做个好看的页面，写完要测试

**Auto Selector 回应：**
```
🧠 需求分析：你需要设计前端页面，并编写测试用例

📁 项目：my-app (React + TypeScript + Tailwind + Vitest)

📋 推荐执行计划：
  1. [frontend-design] — 设计页面结构和样式
  2. [test-driven-development] — 编写测试用例

  ┌──────────────────────────────────┐
  │  ✅ 执行完整计划                   │
  │  ⚡ 只执行第一步 [frontend-design] │
  │  ✏️ 修改计划                      │
  │  ❌ 跳过，直接回答                 │
  └──────────────────────────────────┘
```

---

## ✨ 功能特性

| 特性 | 说明 |
|:-----|:-----|
| 🚀 **零配置激活** | 装好就生效，不需要改 CLAUDE.md 或任何配置文件 |
| 🔍 **项目感知** | 自动读取 package.json、技术栈、目录结构，推荐基于项目上下文 |
| 🧠 **智能分析** | 先理解需求、拆解子任务，再匹配 skill，不是关键词匹配 |
| 🔗 **多 skill 编排** | 复杂需求自动规划多个 skill 的执行顺序和依赖关系 |
| 📋 **原生表单选择** | 使用 AskUserQuestion 弹出选择框，不是输入 1/2 |
| 🛡️ **用户确认** | 每次推荐后问你确认，取消就回退到默认回答 |
| 🚫 **黑名单** | 永久排除特定 skill，聊天命令或 CLI 都能管理 |
| 🔁 **学习能力** | 你纠正一次，本次对话内记住你的偏好 |
| ⏭️ **跳过确认** | 说"直接用"，后续自动调用，不再每次问你 |
| 🔄 **链式执行** | plan → code → test → review，自动串联整个流程 |
| 🪶 **超轻量** | 钩子脚本 < 5ms，不影响任何性能 |

---

## 📦 支持平台

| 平台 | 机制 | 自动激活 |
|:-----|:-----|:--------:|
| **Claude Code** | Plugin (SessionStart hook) | ✅ |
| **Gemini CLI** | Extension (GEMINI.md) | ✅ |
| **Codex CLI** | AGENTS.md | ✅ |
| **Cursor** | AGENTS.md + rules | ✅ |
| **Windsurf** | AGENTS.md + rules | ✅ |
| **Cline** | AGENTS.md + .clinerules | ✅ |
| **GitHub Copilot** | AGENTS.md | ✅ |

---

## 💬 聊天命令

在 AI 对话中直接输入：

| 命令 | 效果 |
|:-----|:-----|
| 直接说需求 | 自动分析、推荐 skill |
| `auto-selector help` | 显示所有命令 |
| `auto-selector on` / `off` | 开启 / 关闭 |
| `auto-selector list` | 列出所有 skill/plugin |
| `auto-selector scan` | 重新扫描项目和 skill |
| `auto-selector status` | 查看当前状态 |
| `auto-selector skip-confirm on/off` | 跳过 / 恢复确认 |
| `auto-selector blacklist add X` | 将 X 加入黑名单 |
| `auto-selector blacklist remove X` | 将 X 移出黑名单 |
| `auto-selector blacklist list` | 查看黑名单 |
| `直接用` / `不用问了` | 跳过确认模式 |
| `不要用 X` / `ignore X` | 加入黑名单 |
| `skills` / `路由表` | 查看所有可用 skill |

---

## 🖥️ CLI 命令

```bash
npx auto-selector-skill                       # 安装（自动检测所有平台）
npx auto-selector-skill --help                # 帮助
npx auto-selector-skill --list                # 列出检测到的 AI 助手
npx auto-selector-skill --only claude         # 只装到 Claude Code
npx auto-selector-skill --only cursor         # 只装到 Cursor
npx auto-selector-skill --dry-run             # 预览，不写文件
npx auto-selector-skill --uninstall           # 卸载

# 黑名单
npx auto-selector-skill --blacklist-add X     # 加入黑名单
npx auto-selector-skill --blacklist-remove X  # 移出黑名单
npx auto-selector-skill --blacklist-list      # 查看
npx auto-selector-skill --blacklist-clear     # 清空
```

---

## 🏗️ 项目结构

```
auto-selector-skill/
├── .claude-plugin/
│   └── plugin.json                    # Claude Code 插件配置
├── .codex/
│   └── config.toml                    # Codex 配置
├── .github/plugin/
│   └── marketplace.json               # 插件市场元数据
├── plugins/auto-selector-skill/
│   └── skills/auto-selector-skill/
│       └── SKILL.md                   # 核心路由逻辑（唯一编辑源）
├── src/hooks/
│   └── selector-activate.js           # SessionStart 钩子
├── bin/install.js                     # 跨平台安装器
├── install.sh                         # macOS/Linux 安装脚本
├── install.ps1                        # Windows 安装脚本
├── AGENTS.md                          # Codex / Cursor / Windsurf / Cline / Copilot
├── GEMINI.md                          # Gemini CLI
├── gemini-extension.json              # Gemini 扩展配置
├── package.json
├── LICENSE
├── INSTALL.md                         # 详细安装教程
├── CHANGELOG.md                       # 版本记录
└── README.md
```

---

## 🔧 工作原理

核心路由逻辑在 `SKILL.md` 中，**不依赖任何平台 API**，所以能跨平台工作。

| 平台 | 激活方式 |
|:-----|:---------|
| Claude Code | `SessionStart` 钩子读取 SKILL.md → 注入系统上下文 |
| Gemini CLI | `gemini-extension.json` → `GEMINI.md` → 引用 SKILL.md |
| Codex / Cursor / Windsurf / Cline / Copilot | `AGENTS.md` 引用 SKILL.md，平台自动发现 |

---

## ❓ FAQ

<details>
<summary><b>装了会影响性能吗？</b></summary>
<br>
钩子脚本只有几行 JS，执行时间 &lt; 5ms。选择分析发生在模型推理阶段，不影响响应速度。
</details>

<details>
<summary><b>不想每次都确认？</b></summary>
<br>
说一次"直接用"或"不用问了"，后续就跳过确认自动调用。
</details>

<details>
<summary><b>新装的 skill 能识别吗？</b></summary>
<br>
能。每次对话都会重新扫描系统 listing，新装的 skill 立刻可用。也可以手动说"重新扫描"触发。
</details>

<details>
<summary><b>能只对某些 skill 关闭选择吗？</b></summary>
<br>
用黑名单功能：聊天中说 <code>auto-selector blacklist add &lt;skill名&gt;</code>，或终端跑 <code>npx auto-selector-skill --blacklist-add &lt;skill名&gt;</code>。
</details>

<details>
<summary><b>复杂任务需要多个 skill 怎么办？</b></summary>
<br>
Auto Selector 会自动拆解需求、识别所有需要的 skill，按依赖关系排序生成执行计划，你可以选择执行全部或只执行第一步。
</details>

---

## 🤝 Contributing

欢迎 PR！见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 📄 License

[MIT](LICENSE)
