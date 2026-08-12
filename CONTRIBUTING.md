# Contributing to Auto Selector Skill

感谢你对 Auto Selector Skill 的兴趣！

## 报 Bug

在 GitHub Issues 中提交，包含：
- 你的操作系统和 Claude Code 版本
- 复现步骤
- 期望行为 vs 实际行为
- `installed_plugins.json` 中的相关条目（脱敏）

## 提功能建议

在 GitHub Issues 中提交，描述：
- 你想要什么功能
- 为什么需要它
- 你设想的使用方式

## 提交代码

1. Fork 仓库
2. 创建分支：`git checkout -b feature/my-feature`
3. 改代码
4. 测试：重启 Claude Code，确认钩子正常加载，路由逻辑符合预期
5. 提交 PR

### 代码规范

- 钩子脚本（`src/hooks/`）必须 **silent-fail** — 任何文件系统错误都不能阻塞会话启动
- 路由逻辑在 `SKILL.md` 中修改，这是唯一编辑源
- 不要硬编码 skill/plugin 名称 — 路由表是动态扫描的
- 新功能先在 Issue 中讨论，避免白做

### 测试

改完后手动测试：
1. 重启 Claude Code
2. 确认钩子输出 `AUTO-SELECTOR-SKILL ACTIVE`
3. 发一条消息，确认路由/确认流程正常
4. 说 `stop auto-selector`，确认关闭
5. 说 `start auto-selector`，确认重新开启

## License

提交的代码默认使用 MIT License。
