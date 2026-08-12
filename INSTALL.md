# Install Auto Selector Skill

支持 Claude Code、Codex、Gemini CLI、Cursor、Windsurf、Cline、Copilot 等所有主流 AI 编码助手。

---

## Claude Code

### npx（最简单，推荐）

```bash
npx auto-selector-skill
```

一条命令，自动完成：下载 → 复制到插件目录 → 注册 → 提示重启。

### 一键安装脚本

**macOS / Linux / WSL / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/ffdgdfhhhh/auto-selector-skill/main/install.sh | bash
```

**Windows (PowerShell 5.1+)**

```powershell
irm https://raw.githubusercontent.com/ffdgdfhhhh/auto-selector-skill/main/install.ps1 | iex
```

重启你的 AI 编码助手即可。

---

## Gemini CLI

```bash
gemini extensions install https://github.com/ffdgdfhhhh/auto-selector-skill
```

重启 Gemini CLI 即可。

---

## Codex CLI

```bash
npx skills add ffdgdfhhhh/auto-selector-skill -a codex
```

---

## Cursor

```bash
npx skills add ffdgdfhhhh/auto-selector-skill -a cursor
```

---

## Windsurf

```bash
npx skills add ffdgdfhhhh/auto-selector-skill -a windsurf
```

---

## Cline

```bash
npx skills add ffdgdfhhhh/auto-selector-skill -a cline
```

---

## GitHub Copilot

```bash
npx skills add ffdgdfhhhh/auto-selector-skill -a github-copilot
```

---

## 其他平台

将 `plugins/auto-selector-skill/skills/auto-selector-skill/SKILL.md` 的内容复制到你平台的规则文件中即可。

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

### 4. 重启你的 AI 编码助手

关闭当前会话，打开新会话。你应该看到钩子输出 `AUTO-SELECTOR-SKILL ACTIVE`。

---

## 卸载

从 `installed_plugins.json` 中删除 `auto-selector-skill@auto-selector-skill` 条目，然后删除插件目录：

```bash
rm -rf ~/.claude/plugins/cache/auto-selector-skill
```

重启你的 AI 编码助手即可。

---

## 验证安装

重启你的 AI 编码助手后，发一条消息试试：

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
