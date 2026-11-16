# auto-selector-skill

> **你的 AI 助手的智能路由层** — 能甩就甩，甩不了自己干

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude-Code-purple)](https://claude.ai/code)
[![MCP](https://img.shields.io/badge/MCP-Experimental-orange)](https://modelcontextprotocol.io)

---

## 一句话介绍

装了一堆 AI 插件但记不住名字？**auto-selector-skill** 自动帮你匹配 — 有 skill 能用就问你要不要用，没有就直接干活。

---

## 安装

要求：Claude Code + Node.js 18+。

```bash
claude plugin marketplace add ffdgdfhhhh/auto-selector-skill
claude plugin install auto-selector-skill@auto-selector-skill
```

重启 Claude Code。插件默认启用，不需要改 `settings.json`。

`npx auto-selector-skill` 是上面两条命令的包装。注意：npm 上的 1.0.x 是旧版，已不再维护，请以 GitHub marketplace 为准。

---

## 工作原理

```
会话启动（SessionStart）
     ↓
扫描启用的插件 + 本地 skills + 项目 skills
     ↓
去重 → 过滤黑名单 → 生成两级索引
     ↓
每条消息（UserPromptSubmit）注入路由规则 + 大类摘要
     ↓
 ┌─ 有 skill 能用？ → 弹窗："要用吗？"
 │
 └─ 没有？ → 直接回答，不废话
```

### 数据从哪来

- 只收录**已启用**插件（读 `settings.json` 的 `enabledPlugins`）
- 只收录真实存在 `skills/<name>/SKILL.md` 的 skill
- 同一 skill 从多个来源扫到（插件 / 本地 / 项目）时，按 `project > local > plugin` 合并成一条
- 本地 skills 和项目 skills 指向同一目录时自动跳过重复扫描

### 两级索引

第一级只注入大类摘要；模型判断需要某类后，再用 Read 打开对应的详情文件。不需要把几百个 skill 全塞进上下文。

索引位置：

```
~/.claude/auto-selector/
├── config.json                 # 全局配置（所有项目共享）
├── index.json                  # 项目没有 .claude/skills 时的索引
├── state.json
├── categories/*.md
└── projects/<hash>/            # 项目影响扫描结果时使用独立索引
    ├── index.json
    ├── state.json
    └── categories/*.md
```

项目索引按项目路径哈希隔离，两个项目同时开会话时不会互相覆盖。触发隔离的条件：项目自带 `.claude/skills`，或项目级 `settings.json` / `settings.local.json` 声明了 `enabledPlugins`。

---

## 使用

### 全自动（默认）

装上就开始工作，不需要手动调用。

### 手动检查 / 刷新

```
/auto-selector-skill:auto-selector-skill
```

会执行 `selector-activate.js --manual`：

| 结果 | 含义 |
|---|---|
| `PARSE` | skill 集合与索引不一致（增删或改名），已重建索引并报告变化 |
| `RESTART` | 集合一致但本会话未激活，已重新激活 |
| `NOOP` | 索引最新，无需操作 |

### 健康检查

```bash
npm run doctor
```

检查索引计数、详情文件、状态、hook 配置、版本一致性、黑名单、索引新鲜度。

### 路由基准测试

```bash
npm run eval -- --baseline          # 词汇匹配基线（本机已装 skill）
npm run eval -- --check             # 校验用例集；缺 skill 视为错误
npm run eval -- --prompt ./prompts  # 生成给任意模型跑的题目
npm run eval -- --results r.jsonl   # 用模型预测计分
```

`eval/cases.jsonl` 包含 31 条任务 → 期望 skill 的标注样本。63 个 skill 的测试环境下，词汇回退基线：**top-1 64.5% / top-3 90.3%**。

CI 用 `eval/fixtures/skills.json` 固定 skill 集合，并设置最低门槛：

```bash
node src/cli/eval.js --baseline --fixture eval/fixtures/skills.json \
  --min-top1 0.60 --min-top3 0.85
```

语义路径的评测流程：`--prompt` 生成 31 个题目文件，模型只需返回 `["skill-a","skill-b"]`，汇总成 `{"id":"...","predicted":[...]}` 的 JSONL 后交给 `--results` 计分。这样换任何模型都能复现同一套基准。

---

## 配置

可选文件 `~/.claude/auto-selector/config.json`：

```json
{
  "rules": "compact",
  "maxCandidates": 3,
  "categoryOverrides": {
    "my-local-skill": "My Category"
  }
}
```

- `rules`: `compact`（默认，精简注入）或 `full`（完整弹窗模板）
- `maxCandidates`: 多候选时最多列几个，1-3（3 是弹窗上限；1 表示只推最佳）
- `categoryOverrides`: 把本地 skill 名（大小写不敏感）映射到自定义大类。插件本身不内置任何个人 skill 名。

---

## 弹窗示例

**单候选**

> 推荐用 **hyperframes**：从 URL、图文或脚本生成视频。要用吗？
> ✅ 使用 ｜ ❌ 这次不用 ｜ 🚫 以后都别推荐

**多候选**

> 为「做个产品宣传视频」挑了 3 个候选 skill，用哪个？
> hyperframes ｜ product-launch-video ｜ motion-graphics ｜ ❌ 都不用

点“都不用”会再问一次哪些该永久跳过，可多选。

---

## 记住拒绝偏好

`~/.auto-selector-skill-blacklist.json`，跨会话生效：

- “这次不用” → 只影响当前轮
- “以后别推荐 X” → 写入黑名单
- “恢复推荐 X” → 移出黑名单
- 匹配大小写不敏感，支持按 skill 名、插件名、marketplace、名称前缀过滤

---

## 支持平台

| 平台 | 加载方式 | 匹配方式 | 状态 |
|---|---|---|---|
| **Claude Code** | hooks 自动注入 | 语义匹配 + 两级索引 | ✅ 主要支持 |
| 其他 MCP 宿主（Cursor / Cline 等） | 手动配置 MCP server | `match_skill`（词汇回退） | ⚠️ 实验性，宿主未实机验证 |

MCP server 与 Claude Code 共用同一套扫描器和索引结构，但**不包含在 npm 包里**，需要从仓库运行：

```bash
cd mcp-server && npm install
node mcp-server/index.js
```

---

## 项目结构

```
auto-selector-skill/
├── .claude-plugin/
│   ├── plugin.json                 # 插件清单（版本与 package.json 同步）
│   └── marketplace.json            # GitHub marketplace 入口
├── src/
│   ├── hooks/
│   │   ├── selector-activate.js    # SessionStart + --manual
│   │   ├── selector-match.js       # UserPromptSubmit
│   │   └── blacklist.js            # 黑名单 CLI
│   ├── lib/
│   │   ├── scan.js                 # 扫描、去重、索引、项目隔离
│   │   ├── rules.js                # 规则单一来源 + 注入清洗
│   │   ├── sanitize.js             # 注入安全
│   │   └── match.js                # 词汇匹配（MCP / 基线）
│   └── cli/
│       ├── doctor.js               # 健康检查
│       └── eval.js                 # 基准测试
├── skills/auto-selector-skill/SKILL.md
├── scripts/
│   ├── sync-docs.js                # 生成 SKILL.md / AGENTS.md 规则段
│   ├── check-versions.js           # 版本一致性
│   └── test.js
├── test/                           # node:test 测试
├── eval/
│   ├── cases.jsonl                 # 路由评测集
│   └── fixtures/skills.json        # CI 用的固定 skill 集合
├── mcp-server/                     # MCP server（实验性，独立依赖）
└── AGENTS.md                       # 通用 agents 规则
```

---

## 开发

```bash
npm test          # 单元测试
npm run check     # 文档规则 + 版本一致性
npm run sync-docs # 重新生成规则段
npm run doctor
npm run eval -- --baseline

# MCP 端到端（先装依赖）
cd mcp-server && npm install && cd ..
npm run test:mcp
```

---

## 许可证

MIT © [ffdgdfhhhh](https://github.com/ffdgdfhhhh)
