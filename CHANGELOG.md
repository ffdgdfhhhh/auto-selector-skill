# Changelog

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
