# Auto Selector Skill

**AI 编码助手自动选择 Skill 插件** — 装了它，你再也不用记 `/skill-name`。

支持 **Claude Code、Codex、Gemini CLI、Cursor、Windsurf、Cline、Copilot** 等所有主流 AI 编码助手。

Auto Selector Skill 在每次会话启动时自动激活，扫描你本地安装的所有 skill 和 plugin，帮你找到最合适的工具来完成任务。

---

## 它做什么

```
你发消息
  ↓
Auto Selector 扫描本地所有 skill/plugin
  ↓
模型分析你的任务 → 从候选中选出最合适的
  ↓
展示给你确认："要用 [skill-name] 吗？"
  ↓
✅ 确认 → 自动调用该 skill
❌ 取消 → 大模型直接回答
没匹配 → 大模型直接回答
```

---

## 特性

| 特性 | 说明 |
|------|------|
| **零配置激活** | 插件装好就生效，不需要改 CLAUDE.md |
| **动态扫描** | 每次对话自动读取系统 listing，装了新 skill 立刻可用 |
| **智能分析** | 模型看完所有候选 skill 的描述后自己判断，不是关键词匹配 |
| **用户确认** | 选完后问你，不强制调用，取消就回退到默认回答 |
| **链式路由** | 做计划 → 写代码 → 测试，自动串联整个流程 |
| **学习能力** | 你纠正一次，本次对话内记住 |
| **开关控制** | `stop auto-selector` 关闭 / `start auto-selector` 开启 |

---

## 安装

一条命令搞定（需要 Node.js 18+）：

```bash
npx auto-selector-skill
```

重启 Claude Code 即可。

其他平台和安装方式见 [INSTALL.md](INSTALL.md)。

---

## 使用

安装后无需任何操作，每次新对话自动生效。

### 日常使用

直接说你的需求就行。Auto Selector 会自动分析并推荐最合适的 skill：

```
你: 帮我 debug 这个登录报错

🧠 Auto Selector 分析：
你的需求："帮我 debug 这个登录报错"
→ 匹配到 [systematic-debugging] — 调试、追踪错误、定位根因

要使用这个 skill 吗？
  ✅ 确认 → 使用 systematic-debugging
  ❌ 取消 → 我直接回答
```

### 命令

| 说 | 效果 |
|---|------|
| 直接说需求 | 自动分析并推荐 skill |
| `stop auto-selector` | 本次对话关闭 |
| `start auto-selector` | 重新开启 |
| `skills` / `路由表` | 查看所有本地可用的 skill/plugin |
| `/caveman` 等明确指定 | 跳过路由，直接调用 |
| `直接用` / `不用问了` | 后续跳过确认，自动调用 |

---

## 项目结构

```
auto-selector-skill/
├── .claude-plugin/
│   └── plugin.json              # Claude Code 插件配置
├── .codex/
│   └── config.toml              # Codex 配置
├── .github/plugin/
│   └── marketplace.json         # 插件市场元数据
├── AGENTS.md                    # Codex / opencode / Cursor / Windsurf / Cline / Copilot
├── GEMINI.md                    # Gemini CLI
├── gemini-extension.json        # Gemini CLI 扩展配置
├── plugins/auto-selector-skill/skills/auto-selector-skill/
│   └── SKILL.md                 # 路由逻辑（唯一编辑源）
├── src/hooks/
│   └── selector-activate.js     # Claude Code SessionStart 钩子
├── install.sh                   # macOS/Linux 一键安装
├── install.ps1                  # Windows 一键安装
├── package.json
├── LICENSE
├── INSTALL.md                   # 详细安装教程
├── CONTRIBUTING.md              # 贡献指南
├── CHANGELOG.md                 # 版本记录
└── README.md
```

---

## 支持的平台

| 平台 | 机制 | 自动激活 | 安装方式 |
|------|------|---------|---------|
| **Claude Code** | Plugin (SessionStart hook) | ✅ | `install.sh` / `install.ps1` |
| **Gemini CLI** | Extension (GEMINI.md) | ✅ | `gemini extensions install` |
| **Codex CLI** | AGENTS.md | ✅ | `npx skills add` |
| **Cursor** | AGENTS.md + rules | ✅ | `npx skills add -a cursor` |
| **Windsurf** | AGENTS.md + rules | ✅ | `npx skills add -a windsurf` |
| **Cline** | AGENTS.md + .clinerules | ✅ | `npx skills add -a cline` |
| **GitHub Copilot** | AGENTS.md | ✅ | `npx skills add -a github-copilot` |
| **opencode** | AGENTS.md | ✅ | 复制到 config 目录 |
| **其他** | SKILL.md 通用格式 | 手动 | 复制 SKILL.md 到对应目录 |

---

## 工作原理

Auto Selector Skill 的核心路由逻辑在 `SKILL.md` 中，**不依赖任何特定平台的 API**，所以能跨平台工作。

不同平台的激活机制：

| 平台 | 怎么激活 |
|------|---------|
| **Claude Code** | `SessionStart` 钩子自动读取 SKILL.md 并注入系统上下文 |
| **Gemini CLI** | `gemini-extension.json` 指向 `GEMINI.md`，`GEMINI.md` 引用 SKILL.md |
| **Codex / Cursor / Windsurf / Cline / Copilot** | `AGENTS.md` 引用 SKILL.md，平台自动发现 |
| **其他** | 将 SKILL.md 内容复制到平台的规则文件中 |

---

## FAQ

**Q: 装了这个会不会影响性能？**
A: 钩子脚本只有几行 JS，执行时间 < 5ms。选择分析发生在模型推理阶段，不影响响应速度。

**Q: 我不想每次都确认，能自动调用吗？**
A: 说一次"直接用"或"不用问了"，后续就跳过确认自动调用。

**Q: 我新装了一个 skill，Auto Selector 能识别吗？**
A: 能。每次对话它都会重新扫描系统 listing，新装的 skill 立刻可用。

**Q: 能不能只对某些 skill 关闭选择？**
A: 目前不支持。你可以 `stop auto-selector` 关闭整个功能，然后手动 `/skill-name`。

---

## License

MIT
