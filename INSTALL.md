# Install Auto Selector Skill

官方支持 **Claude Code**（Node.js 18+）。其他 MCP 宿主为实验性支持，见文末。

---

## Claude Code

### Marketplace（官方渠道，推荐）

```bash
claude plugin marketplace add ffdgdfhhhh/auto-selector-skill
claude plugin install auto-selector-skill@auto-selector-skill
```

重启 Claude Code。插件默认启用，不需要手改 `settings.json`。

### npx

```bash
npx auto-selector-skill
```

等价于上面两条命令的包装。npm 上的 1.0.x 是旧版，已不再维护；请以 GitHub marketplace 为准。

### 一键脚本

**macOS / Linux / WSL / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/ffdgdfhhhh/auto-selector-skill/main/install.sh | bash
```

**Windows (PowerShell 5.1+)**

```powershell
irm https://raw.githubusercontent.com/ffdgdfhhhh/auto-selector-skill/main/install.ps1 | iex
```

脚本本身不复制文件，只调用 `claude plugin marketplace add` 和 `claude plugin install`。

---

## 手动安装

```bash
git clone https://github.com/ffdgdfhhhh/auto-selector-skill.git
claude plugin marketplace add ./auto-selector-skill
claude plugin install auto-selector-skill@auto-selector-skill
```

`claude plugin marketplace add` 接受本地目录，也接受 GitHub 仓库地址。

---

## 验证安装

1. 重启 Claude Code，新开一个会话。
2. 随便发一条消息。
3. 会话上下文里应出现 `<AUTO_SELECTORRouting>` 注入；会话启动时还会看到 skill 大类摘要。

也可以直接跑健康检查：

```bash
node ~/.claude/plugins/cache/auto-selector-skill/auto-selector-skill/<版本>/src/cli/doctor.js
```

全部显示 `✔` 即安装成功（`⚠` 表示索引需要刷新，不影响使用）。

---

## 卸载

```bash
claude plugin uninstall auto-selector-skill@auto-selector-skill
claude plugin marketplace remove auto-selector-skill
```

黑名单文件 `~/.auto-selector-skill-blacklist.json` 会保留；不需要时手动删除。

---

## 其他平台（实验性）

MCP server 不在 npm 包里，需要从仓库运行：

```bash
cd auto-selector-skill/mcp-server
npm install
node index.js
```

把该命令配置到你宿主的 MCP 设置中。可用工具：

- `scan_skills` — 扫描并重建索引
- `match_skill` — 词汇回退匹配
- `list_skills` — 列出所有 skill
- `ask_user` / `confirm_skill` — 确认与黑名单流程

注意：MCP 路径只做确定性词汇匹配，效果弱于 Claude Code 内的语义匹配；各宿主尚未实机验证。

---

## 常见问题

**Q: 安装后没反应？**
A: 确认重启了 Claude Code；用 `/plugin` 检查 `auto-selector-skill` 是否启用。插件只在新会话启动时激活。

**Q: 索引过期 / skill 数量不对？**
A: 运行 `/auto-selector-skill:auto-selector-skill`（手动刷新），或重启会话。

**Q: Windows 路径怎么写？**
A: 安装路径用正斜杠或反斜杠都行。脚本会自动处理。

**Q: 会不会改我的其他配置？**
A: 不会。安装器只调用 Claude Code 官方插件命令，不覆盖其他 AI 工具的全局配置。
