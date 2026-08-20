#!/usr/bin/env node
// auto-selector-skill — SessionStart hook
// Scan all skills/plugins, build index, save to file

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INDEX_PATH = path.join(HOME, '.claude', 'auto-selector-index.json');

// Scan installed plugins from Claude cache
function scanInstalledPlugins() {
  const skills = [];
  const cacheDir = path.join(HOME, '.claude', 'plugins', 'cache');

  if (!fs.existsSync(cacheDir)) return skills;

  try {
    const marketplaces = fs.readdirSync(cacheDir);
    for (const marketDir of marketplaces) {
      const marketPath = path.join(cacheDir, marketDir);
      if (!fs.statSync(marketPath).isDirectory()) continue;

      const pluginDirs = fs.readdirSync(marketPath);
      for (const pluginDir of pluginDirs) {
        const pluginPath = path.join(marketPath, pluginDir);
        if (!fs.statSync(pluginPath).isDirectory()) continue;

        // Read plugin.json
        const pluginJsonPath = path.join(pluginPath, '.claude-plugin', 'plugin.json');
        if (fs.existsSync(pluginJsonPath)) {
          try {
            const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
            skills.push({
              name: pluginJson.name || pluginDir,
              description: pluginJson.description || '',
              source: 'plugin',
              marketplace: marketDir,
            });
          } catch (e) {}
        }

        // Scan skills inside plugin
        const skillsDir = path.join(pluginPath, 'skills');
        if (fs.existsSync(skillsDir)) {
          try {
            const skillDirs = fs.readdirSync(skillsDir);
            for (const skillDir of skillDirs) {
              const skillPath = path.join(skillsDir, skillDir);
              if (!fs.statSync(skillPath).isDirectory()) continue;

              const skillMdPath = path.join(skillPath, 'SKILL.md');
              if (fs.existsSync(skillMdPath)) {
                try {
                  const skillContent = fs.readFileSync(skillMdPath, 'utf8');
                  const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
                  if (frontmatterMatch) {
                    const lines = frontmatterMatch[1].split('\n');
                    const name = lines.find(l => l.startsWith('name:'))?.split(':').slice(1).join(':').trim() || skillDir;
                    const desc = lines.find(l => l.startsWith('description:'))?.split(':').slice(1).join(':').trim() || '';
                    skills.push({
                      name: name,
                      description: desc,
                      source: 'skill',
                      marketplace: marketDir,
                      plugin: pluginDir,
                    });
                  }
                } catch (e) {}
              }
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  return skills;
}

// Scan local skills directory (~/.claude/skills/)
function scanLocalSkills() {
  const skills = [];
  const localSkillsDir = path.join(HOME, '.claude', 'skills');

  if (!fs.existsSync(localSkillsDir)) return skills;

  try {
    const skillDirs = fs.readdirSync(localSkillsDir);
    for (const skillDir of skillDirs) {
      const skillPath = path.join(localSkillsDir, skillDir);
      if (!fs.statSync(skillPath).isDirectory()) continue;

      const skillMdPath = path.join(skillPath, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        try {
          const skillContent = fs.readFileSync(skillMdPath, 'utf8');
          const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
          if (frontmatterMatch) {
            const lines = frontmatterMatch[1].split('\n');
            const name = lines.find(l => l.startsWith('name:'))?.split(':')[1]?.trim() || skillDir;
            const desc = lines.find(l => l.startsWith('description:'))?.split(':').slice(1).join(':').trim() || '';
            skills.push({
              name: name,
              description: desc,
              source: 'local-skill',
              path: skillPath,
            });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return skills;
}

// Scan project-level skills (.claude/skills/ in current project)
function scanProjectSkills() {
  const skills = [];
  const projectSkillsDir = path.join(process.cwd(), '.claude', 'skills');

  if (!fs.existsSync(projectSkillsDir)) return skills;

  try {
    const skillDirs = fs.readdirSync(projectSkillsDir);
    for (const skillDir of skillDirs) {
      const skillPath = path.join(projectSkillsDir, skillDir);
      if (!fs.statSync(skillPath).isDirectory()) continue;

      const skillMdPath = path.join(skillPath, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        try {
          const skillContent = fs.readFileSync(skillMdPath, 'utf8');
          const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
          if (frontmatterMatch) {
            const lines = frontmatterMatch[1].split('\n');
            const name = lines.find(l => l.startsWith('name:'))?.split(':')[1]?.trim() || skillDir;
            const desc = lines.find(l => l.startsWith('description:'))?.split(':').slice(1).join(':').trim() || '';
            skills.push({
              name: name,
              description: desc,
              source: 'project-skill',
              path: skillPath,
            });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return skills;
}

// Build full index
const installedPlugins = scanInstalledPlugins();
const localSkills = scanLocalSkills();
const projectSkills = scanProjectSkills();
const allSkills = [...installedPlugins, ...localSkills, ...projectSkills];

// Deduplicate by name
const seen = new Set();
const uniqueSkills = allSkills.filter(s => {
  if (seen.has(s.name)) return false;
  seen.add(s.name);
  return true;
});

// Save index
const index = {
  version: '1.1.0',
  timestamp: new Date().toISOString(),
  totalSkills: uniqueSkills.length,
  skills: uniqueSkills,
};

try {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
} catch (e) {
  // If write fails, output to stdout for fallback
}

// Output context for Claude
const skillList = uniqueSkills.map(s => {
  const sourceTag = s.source === 'plugin' ? '[plugin]' :
                    s.source === 'skill' ? '[skill]' :
                    s.source === 'local-skill' ? '[local]' : '[project]';
  return `• ${s.name} ${sourceTag} — ${s.description || '无描述'}`;
}).join('\n');

const context = `<EXTREMELY_IMPORTANT>
You have auto-selector-skill v1.1.0 active.

**Below are ALL available skills/plugins in this session (${uniqueSkills.length} total):**

${skillList}

**MANDATORY routing rules — Follow on EVERY user message:**

1. Analyze the user's message intent
2. Check if any skill above matches the user's need (by meaning, not exact keywords)
3. If YES → call AskUserQuestion tool FIRST:
   - question: "推荐使用 [skill名] — {description}"
   - header: "Skill"
   - options: [{"label": "✅ 使用", "description": "用这个skill帮你做"}, {"label": "❌ 不用", "description": "跳过，直接回答"}]
   - multiSelect: false
4. If NO → respond normally

**Matching examples:**
- "帮我做个网页" → ui-ux-pro-max (UI design)
- "重构代码" → code-simplifier, ponytail
- "写测试" → superpowers
- "做个计划" → planning-with-files
- "做个视频" → hyperframes
- "写文档" → document-skills
- "简洁一点" → caveman

**Rules:**
- Match by MEANING, not keywords
- 用户说"不用" → 不道歉，下次继续推荐
- 复杂需求可推荐多个 skill
- 匹配不确定时，优先推荐
</EXTREMELY_IMPORTANT>`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context
  }
}));
