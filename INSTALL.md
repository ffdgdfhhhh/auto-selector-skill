# Install Auto Selector Skill

Claude Code 插件 — 会话启动时自动激活，不需要改 CLAUDE.md。

## 一键安装（推荐）

**macOS / Linux / WSL / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/auto-selector-skill/main/install.sh | bash
```

**Windows (PowerShell 5.1+)**

```powershell
irm https://raw.githubusercontent.com/YOUR_USERNAME/auto-selector-skill/main/install.ps1 | iex
```

安装完成，重启 Claude Code 即可。

---

## 手动安装

如果你不想跑脚本，可以手动操作：

### 1. Clone 仓库

```bash
git clone https://github.com/YOUR_USERNAME/auto-selector-skill.git
```

### 2. 复制到插件目录

```bash
# macOS / Linux
cp -r auto-selector-skill ~/.claude/plugins/cache/auto-selector-skill/auto-selector-skill/latest

# Windows (PowerShell)
Copy-Item -Recurse auto-selector-skill $env:USERPROFILE\.claude\plugins\cache\auto-selector-skill\auto-selector-skill\latest
```

### 3. 注册插件

编辑 `~/.claude/plugins/installed_plugins.json`，在 `plugins` 对象中添加：

```json
"auto-selector-skill@auto-selector-skill": [
  {
    "scope": "user",
    "installPath": "<你的home目录>/.claude/plugins/cache/auto-selector-skill/auto-selector-skill/latest",
    "version": "latest",
    "installedAt": "2026-01-01T00:00:00.000Z",
    "lastUpdated": "2026-01-01T00:00:00.000Z"
  }
]
```

### 4. 重启 Claude Code

关闭当前会话，打开新会话。你应该看到钩子输出 `AUTO-SELECTOR-SKILL ACTIVE`。

---

## 卸载

从 `installed_plugins.json` 中删除 `auto-selector-skill@auto-selector-skill` 条目，然后删除插件目录：

```bash
rm -rf ~/.claude/plugins/cache/auto-selector-skill
```

重启 Claude Code 即可。

---

## 验证安装

重启 Claude Code 后，发一条消息试试：

```
skills
```

如果看到本地 skill/plugin 的分类列表，说明安装成功。

---

## 常见问题

**Q: 安装后没反应？**
A: 确认重启了 Claude Code。插件只在新会话启动时激活。

**Q: installed_plugins.json 格式错误？**
A: 确保 JSON 格式正确，逗号、引号没有遗漏。可以用 `cat ~/.claude/plugins/installed_plugins.json | python -m json.tool` 验证。

**Q: 我用的是 Windows，路径怎么写？**
A: Windows 的 `installPath` 用反斜杠或正斜杠都行，比如 `C:\\Users\\你的用户名\\.claude\\plugins\\cache\\auto-selector-skill\\auto-selector-skill\\latest`。
