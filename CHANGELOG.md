# Changelog

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
