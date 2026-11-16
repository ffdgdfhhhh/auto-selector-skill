# Contributing to Auto Selector Skill

感谢你对 Auto Selector Skill 的兴趣！

## 报 Bug

在 GitHub Issues 中提交，包含：

- 你的操作系统、Node.js 版本和 Claude Code 版本
- 复现步骤
- 期望行为 vs 实际行为
- `npm run doctor` 的输出（先脱敏路径）

## 提功能建议

在 GitHub Issues 中提交，描述：

- 你想要什么功能
- 为什么需要它
- 你设想的使用方式

## 提交代码

1. Fork 仓库
2. 创建分支：`git checkout -b feature/my-feature`
3. 改代码
4. 跑检查：

```bash
npm test
npm run check
npm run doctor
```

5. 提交 PR

### 代码规范

- 钩子脚本（`src/hooks/`）必须 **silent-fail** — 任何文件系统错误都不能阻塞会话启动
- **规则只有一处来源**：`src/lib/rules.js`。`SKILL.md` / `AGENTS.md` 的规则段由 `npm run sync-docs` 生成，不要手改生成区
- 不要硬编码 skill/plugin 名称 — 分类走动态扫描 + 用户 `config.json` 的 `categoryOverrides`
- 任何进入模型上下文的 skill 名、描述、大类名、黑名单项都必须经过 `src/lib/sanitize.js`
- 安装器只调用 Claude Code 官方插件命令，不复制文件、不覆盖其他 agent 的全局配置
- 新功能先在 Issue 中讨论，避免白做

### 测试

```bash
npm test                       # 单元测试
npm run check                  # 文档规则 + 版本一致性
npm run check:pack             # npm 包内容检查
npm run eval -- --check        # 评测用例集
```

MCP 相关改动额外跑：

```bash
cd mcp-server && npm install && cd ..
npm run test:mcp
```

## License

提交的代码默认使用 MIT License。
