# Changelog

## 1.6.0 (2026-11-09)

### 发布与安装

- **唯一官方渠道**: GitHub marketplace — `claude plugin marketplace add ffdgdfhhhh/auto-selector-skill` + `claude plugin install auto-selector-skill@auto-selector-skill`
- **安装器重写**: `npx auto-selector-skill` / `install.sh` / `install.ps1` 只调用官方 `claude plugin` 命令，不再复制文件、不再覆盖 `~/.gemini`、`~/.codex`、`.cursorrules` 等全局文件
- **npm 包收紧**: `files` 白名单只含运行所需文件；`node_modules`、`mcp-server`、`test`、`eval`、`scripts` 不再进入 tarball（`npm run check:pack` 校验）
- **单一版本源**: `package.json`、`plugin.json`、`marketplace.json`、`mcp-server/package.json` 由 `scripts/check-versions.js` 强制一致
- **清理失效资产**: 删除 JSON 格式的 `.codex/config.toml`、旧平台规则文件、`index.html` 和重复的 marketplace 清单

### 数据与安全

- **不再内置个人 skill 名**: 删除 `LOCAL_CATEGORY_OVERRIDES`；分类改由 `~/.claude/auto-selector/config.json` 的 `categoryOverrides` 驱动
- **注入清洗**: 新增 `src/lib/sanitize.js`，对进入上下文的 skill 名、描述、大类名、黑名单、路径做控制字符剥离、`<`/`>` 转义和长度截断；规则中明确详情文件只作候选数据，不当作指令
- **详情文件清洗**: 大类详情文件中的 skill 名和描述同样经过清洗
- **配置校验**: `doctor` 校验 `rules` / `maxCandidates` / `categoryOverrides` 的类型和取值

### 索引与可靠性

- **项目级索引隔离**: 项目自带 `.claude/skills`，或项目级 settings 声明 `enabledPlugins` 时，使用 `~/.claude/auto-selector/projects/<hash>/`，多个项目并行不再互相覆盖
- **过期详情清理**: 大类消失后对应 `.md` 自动删除
- **文件名冲突**: 清洗后同名的大类追加短哈希，不再互相覆盖
- **状态记录项目路径**: `state.json` 增加 `projectDir`，跨项目状态可判定
- **doctor 修复**: `fail()` 不再返回真值；新鲜度改为按名字集合比较；空索引给出警告；版本一致性纳入检查
- **eval 修复**: `CLAUDE_CONFIG_DIR` 生效；`--check` 缺失期望 skill 计为错误（`--allow-missing` 可放宽）；新增 `--fixture` 与 `--min-top1` / `--min-top3` 阈值
- **MCP 修复**: 版本从 `package.json` 读取；`scan_skills` 使用与 hook 相同的项目分类

### 数据质量

- **全局去重**: 按规范名合并同名 skill，来源优先级 `project > local > plugin`
- **启用状态过滤**: 读取 `settings.json` 的 `enabledPlugins`，禁用插件的 skill 不再进入索引
- **只收录真实 skill**: 插件必须有 `skills/<name>/SKILL.md`；只有命令的插件不再作为候选
- **重复扫描修复**: project 目录与 local 目录相同时自动跳过
- **一致性不变量**: `totalSkills = categorySum = skillNames.length`

### 上下文效率

- **精简注入**: 默认注入 compact 规则，完整弹窗模板按需读取，单条消息注入从 ~3.7KB 降到 ~2.3KB
- **shortDescription**: 大类列表使用一句话短描述
- **新增配置**: `config.json` 支持 `rules` / `maxCandidates` / `categoryOverrides`

### 可维护性

- **扫描逻辑抽取**: `src/lib/scan.js`，hook / CLI / MCP 共用
- **规则单一来源**: `src/lib/rules.js`；`SKILL.md`、`AGENTS.md` 的规则段由 `scripts/sync-docs.js` 生成
- **测试**: 41 个 `node:test` 用例，覆盖扫描、去重、项目隔离、注入清洗、hook、doctor、eval、安装器、规则体积、文档同步
- **评测集**: `eval/cases.jsonl` 31 条；本机词汇基线 top-1 64.5% / top-3 90.3%；CI 使用 `eval/fixtures/skills.json` 固定集合和阈值

### 工程化

- **GitHub Actions**: Node 18/20/22，语法检查 + 测试 + 文档/版本一致性 + 评测阈值 + 包内容检查 + MCP smoke
- **npm scripts**: `test` / `check` / `check:pack` / `sync-docs` / `doctor` / `eval`

### 多平台

- **MCP server**: 复用同一扫描器和索引；`match_skill` 使用中英同义词的词汇回退；作为实验性能力保留，不进入 npm 包
- **MCP 端到端测试**: 官方 SDK client 通过 stdio 调用全部 5 个工具（`npm run test:mcp`）
- **平台范围收敛**: 官方只支持 Claude Code；Gemini / Codex / Cursor 的规则文件安装方式已移除

### 审查修复

- **安装脚本同步**: `install.sh` / `install.ps1` 改为复制 `skills/`（原 `plugins/` 已删除），并补齐 AGENTS/GEMINI 等文件
- **MCP confirm_skill 收紧**: 只接受明确的选择值；选项文案也能识别；未知输入不再默认执行
- **MCP 黑名单落盘**: blacklist 分支真正写入文件并失效索引缓存
- **MCP 分类一致**: `groupSkills` 传入 projectRoot，项目类名与 hook 一致
- **CLAUDE_CONFIG_DIR 支持**: 扫描器与 hook 索引目录跟随 `CLAUDE_CONFIG_DIR`
- **插件启用作用域**: project/local 设置可覆盖 user 设置，`false` 能真正禁用
- **maxCandidates 上限**: 限制为 3，避免 4 候选 + "都不用" 超出弹窗 4 项上限
- **手动刷新更严格**: 同时比较 skill 名集合，重命名/替换也能触发 PARSE
- **CRLF 兼容**: `sync-docs --check` 按行尾归一化比较
- **黑名单删除提示**: 被前缀条目隐藏时明确提示改为删除该条目，不再假装成功
- **版本目录排序**: 数字比较版本号，`1.10.0` 不再输给 `1.9.0`
- **多段描述解析**: frontmatter 普通标量保留段落分隔
- **MCP 冒烟隔离**: 使用临时 fixture HOME，CI 空环境也能跑

## 1.5.0 (2026-11-05)

### 匹配/推荐逻辑重做

- **减少打扰**: 寒暄、追问、纯知识问答、已拉黑候选、配置类消息 → 直接回答，不弹窗
- **更主动**: 2-3 个合理候选时一次列出（最多 3 个 + “都不用”）
- **记住拒绝偏好**: 用户说“以后别推荐 X” → 持久化到 `~/.auto-selector-skill-blacklist.json`，跨会话生效
- **新弹窗文案**: 单候选 3 选项（✅ 使用 / ❌ 不用 / 🚫 不再推荐）；多候选按 skill 名列出
- **黑名单实时生效**: `selector-match.js` 每次注入当前黑名单，拉黑后同会话立即不再推荐
- **文档同步**: SKILL.md、AGENTS.md 更新为同一套规则
- **默认启用**: `plugin.json` 声明 `defaultEnabled: true`，安装后自动启动，无需手动 enable

### 手动调用刷新

- **智能刷新**: `selector-activate.js --manual` 比对「实际扫描 skill 数」与「索引 skill 数」
  - 不一致 → `PARSE`：重建索引，报告新增/移除的 skill
  - 一致但本会话未激活 → `RESTART`：重新激活，输出大类索引
  - 已是最新 → `NOOP`：不做任何写入
- **激活状态**: SessionStart 与手动模式都写 `~/.claude/auto-selector/state.json`（版本、skill 数、激活时间）
- **索引记录 skillNames**: 手动解析时能精确报告增删明细
- **SKILL.md / 路由规则同步**: 手动调用本 skill 时执行同一命令，按 `ACTION` 汇报

### 审查修正

- **“不要用 X” 三态**: 整句拒绝 / 本轮剔除 / 永久拉黑分开处理，避免误拉黑或漏推荐
- **规则顺序化**: 先分类消息再匹配，解决“减少打扰”与“更主动”冲突
- **详情路径修正**: 注入真实 `detailFile` 文件名，避免大类名带空格时 Read 失败
- **单一规则来源**: SessionStart 只注入索引，不再注入另一套规则
- **候选上限**: 4+ 候选取前 3 并注明未列出数量；多候选“都不用”后可多选拉黑
- **blacklist.js**: 新增原子写入工具，自动去重、损坏文件自动备份
- **黑名单级联**: 支持按 name / plugin / marketplace / 名称前缀过滤（大小写不敏感）
- **误触保护**: 拒绝项改为“❌ 这次不用” / “🚫 以后都别推荐”，时间范围一眼可辨
- **模糊拒绝确认**: 裸“不要用 X / 别推荐 X”先问一次“以后都不推荐吗”，再决定是否拉黑
- **撤销拉黑**: 支持“恢复推荐 X”，通过 blacklist.js remove 原子移除
- **任务内拒绝**: 当前任务点过“不用”后，本任务后续消息不再弹窗
- **frontmatter 解析修复**: 支持 `description: >` / `|` 多行块标量，恢复 27 个 skill 的说明
- **规则兜底**: 索引缺失时仍注入完整路由规则，不再静默失效
- **SKILL.md 布局修正**: 移到插件根 `skills/auto-selector-skill/SKILL.md`，让 Claude Code 能发现并手动调用
- **安装脚本同步**: `bin/install.js` 从新路径复制；`package.json` 的 `files` 改为 `skills/`

## 1.4.0 (2026-08-20)

### Two-Level Selection

- **两级选择架构**: 第一级看大类摘要（13 个），第二级读详细文件选具体 skill
- **按来源分组**: 130 个 skill 分为 13 个大类（HyperFrames, GSAP, UI/UX Design 等）
- **详细文件按需读取**: AI 选定大类后，用 Read 工具读取 `~/.claude/auto-selector/categories/<name>.md`
- **Token 消耗降低 97%**: 每次消息只注入 1,260 字符（之前 37,418 字符）
- **更准确的路由**: AI 先看大方向，再深入细节，比一次性看 130 个 skill 准确得多

## 1.2.1 (2026-08-20)

### Revert to AI-driven matching

- **去掉关键词匹配**: 关键词匹配不准确，改回让 AI 自己读 skill 列表判断
- **简化 selector-match.js**: 只注入完整 skill 列表，由 AI 模型自主判断是否匹配

## 1.2.0 (2026-08-20)

### Critical Bug Fixes

- **修复插件扫描器**: 现在正确遍历 version 目录，找到所有 plugin skills（之前找到 0 个，现在找到 71 个）
- **实现真正的语义匹配**: 不再注入全部 130 个 skill，而是根据用户消息提取关键词，只匹配 top-5 相关 skill
- **接入黑名单系统**: hooks 现在读取 `~/.auto-selector-skill-blacklist.json`，过滤掉被拉黑的 skill
- **修复中文分词**: 添加 n-gram 分词 + 中英文同义词映射（"网页" → "web"，"动画" → "animation" 等）
- **修复空 catch**: 所有错误现在输出到 stderr，不再静默失败

### Performance Improvements

- **Token 消耗降低 95%**: 从每次消息注入 ~4000 字符（130 个 skill）降低到 ~800 字符（5 个匹配 skill）
- **会话缓存**: 记录已推荐的 skill，避免重复推荐（1 小时自动重置）
- **动态版本号**: 从 package.json 读取，不再硬编码

### Architecture Changes

- **parseFrontmatter()**: 统一的 frontmatter 解析器，处理 \r\n 和 \n，正确解析包含冒号的值
- **语义匹配引擎**: 基于关键词提取 + 同义词映射 + 评分系统（name 匹配 50 分，description 匹配 5-10 分）
- **BLACKLIST_PATH**: 常量定义，确保 hooks 和 install.js 使用同一路径

## 1.1.0 (2026-08-18)

### Architecture Change

- **去掉了硬编码关键词匹配** — 不再维护固定的关键词映射表
- **改为 AI 自主判断** — 注入完整 skill 索引，让 AI 根据语义自行匹配
- **索引持久化** — SessionStart 时扫描并保存到 `~/.claude/auto-selector-index.json`，后续直接读取

### Bug Fixes

- **每次用户消息触发匹配**: 新增 `UserPromptSubmit` hook，每次用户发消息都自动匹配 skill
- **改进 skill 扫描**: 扫描 plugin cache + 本地 skills + 项目 skills，覆盖所有来源

### Features

- **自动适应新 skill** — 添加新 skill/插件后自动纳入索引，无需改代码
- **多来源扫描** — plugin cache、~/.claude/skills/、项目 .claude/skills/
- **索引去重** — 同名 skill 自动去重

## 1.0.5 (2026-08-14)

### Bug Fixes

- **Hook 输出格式修复**: 改为 JSON 格式 (`hookSpecificOutput.additionalContext`)，和 superpowers 插件相同
- **添加 EXTREMELY_IMPORTANT 标签**: 确保模型优先处理路由指令
- **修复 Skill 匹配失败**: 之前纯文本输出被模型忽略，现在正确注入系统上下文

### Features

- **MCP 服务器**: 新增 `mcp-server/` 目录，提供 `scan_skills`、`match_skill`、`list_skills` 工具
- **多平台 MCP 配置**: 自动配置 Cursor、Windsurf、VS Code 的 MCP 连接

## 1.1.0 (2026-08-13)

### Features

- **项目上下文初始化**: 自动读取项目技术栈、目录结构、依赖，建立项目画像，推荐基于项目上下文
- **多 skill 编排**: 复杂需求自动识别多个 skill，按依赖关系排序，生成执行计划
- **原生表单选择**: 使用 AskUserQuestion 弹出选择框，不再用文本 1/2 输入
- **需求分析前置**: 先理解需求、拆解子任务，再匹配 skill，不是直接推
- **可调用验证**: 只推荐真正可调用的 skill，不会再出现 "Unknown skill" 错误
- **新增命令**: `/auto-selector scan` 重新扫描项目和 skill

## 1.0.4 (2026-08-12)

### Features

- **黑名单系统**: 永久排除特定 skill，支持聊天命令和 CLI 管理
- **跳过确认模式**: 说"直接用"后自动调用，不再每次确认
- **丰富命令**: help, on, off, list, status, skip-confirm, blacklist 等 17 个聊天命令
- **跨平台安装器**: `bin/install.js` 自动检测已安装的 AI 编码助手

## 1.0.0 (2026-08-12)

### Features

- **SessionStart hook**: 每次 Claude Code 会话启动时自动激活
- **动态扫描**: 自动读取系统 listing 中的所有 skill/plugin，不硬编码
- **智能分析**: 模型看完所有候选 skill 描述后自己判断最合适的
- **用户确认**: 选完后展示给用户确认，取消则回退到默认大模型回答
- **无匹配回退**: 没有合适的 skill 时，直接由大模型默认处理
- **链式路由**: 支持 plan → code → test 的流程串联
- **学习能力**: 用户纠正后，本次对话内记住
- **开关控制**: `stop auto-selector` / `start auto-selector`
- **一键安装**: `install.sh` (macOS/Linux) + `install.ps1` (Windows)
