#!/usr/bin/env node
// auto-selector-skill — SessionStart hook
// Build two-level index: category summaries + per-category detail files

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INDEX_DIR = path.join(HOME, '.claude', 'auto-selector');
const INDEX_PATH = path.join(INDEX_DIR, 'index.json');
const CATEGORIES_DIR = path.join(INDEX_DIR, 'categories');
const BLACKLIST_PATH = path.join(HOME, '.auto-selector-skill-blacklist.json');

// Ensure directories exist
fs.mkdirSync(INDEX_DIR, { recursive: true });
fs.mkdirSync(CATEGORIES_DIR, { recursive: true });

// Parse YAML frontmatter from SKILL.md
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const result = {};
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

// Read blacklist
function readBlacklist() {
  try {
    if (fs.existsSync(BLACKLIST_PATH)) {
      return JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf8'));
    }
  } catch (e) {
    console.error(`[auto-selector] Error reading blacklist: ${e.message}`);
  }
  return [];
}

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

        const versionDirs = fs.readdirSync(pluginPath);
        for (const versionDir of versionDirs) {
          const versionPath = path.join(pluginPath, versionDir);
          if (!fs.statSync(versionPath).isDirectory()) continue;

          const pluginJsonPath = path.join(versionPath, '.claude-plugin', 'plugin.json');
          if (fs.existsSync(pluginJsonPath)) {
            try {
              const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
              skills.push({
                name: pluginJson.name || pluginDir,
                description: pluginJson.description || '',
                source: 'plugin',
                marketplace: marketDir,
              });
            } catch (e) {
              console.error(`[auto-selector] Error reading ${pluginJsonPath}: ${e.message}`);
            }
          }

          const skillsDir = path.join(versionPath, 'skills');
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
                    const parsed = parseFrontmatter(skillContent);
                    if (parsed) {
                      skills.push({
                        name: parsed.name || skillDir,
                        description: parsed.description || '',
                        source: 'skill',
                        marketplace: marketDir,
                        plugin: pluginDir,
                      });
                    }
                  } catch (e) {
                    console.error(`[auto-selector] Error reading ${skillMdPath}: ${e.message}`);
                  }
                }
              }
            } catch (e) {
              console.error(`[auto-selector] Error scanning skills: ${e.message}`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`[auto-selector] Error scanning plugins: ${e.message}`);
  }

  return skills;
}

// Scan local skills
function scanLocalSkills() {
  const skills = [];
  const localSkillsDir = path.join(HOME, '.claude', 'skills');
  if (!fs.existsSync(localSkillsDir)) return skills;

  try {
    const skillDirs = fs.readdirSync(localSkillsDir);
    for (const skillDir of skillDirs) {
      const skillPath = path.join(localSkillsDir, skillDir);
      if (!fs.statSync(skillPath).isDirectory()) continue;

      let realPath = skillPath;
      try { realPath = fs.realpathSync(skillPath); } catch (e) {}

      const skillMdPath = path.join(realPath, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        try {
          const skillContent = fs.readFileSync(skillMdPath, 'utf8');
          const parsed = parseFrontmatter(skillContent);
          if (parsed) {
            skills.push({
              name: parsed.name || skillDir,
              description: parsed.description || '',
              source: 'local-skill',
              path: skillPath,
            });
          }
        } catch (e) {
          console.error(`[auto-selector] Error reading ${skillMdPath}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.error(`[auto-selector] Error scanning local skills: ${e.message}`);
  }

  return skills;
}

// Scan project skills
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
          const parsed = parseFrontmatter(skillContent);
          if (parsed) {
            skills.push({
              name: parsed.name || skillDir,
              description: parsed.description || '',
              source: 'project-skill',
              path: skillPath,
            });
          }
        } catch (e) {
          console.error(`[auto-selector] Error reading ${skillMdPath}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.error(`[auto-selector] Error scanning project skills: ${e.message}`);
  }

  return skills;
}

// Category mapping
const SPECIAL_CATEGORIES = {
  'gsap-skills': 'GSAP',
  'hyperframes': 'HyperFrames',
  'playwright': 'Playwright',
  'document-skills': 'Document Skills',
  'example-skills': 'Document Skills',
  'superpowers': 'Superpowers',
  'superpowers-dev': 'Superpowers',
  'ponytail': 'Ponytail',
  'caveman': 'Caveman',
  'planning-with-files': 'Planning with Files',
  'andrej-karpathy-skills': 'Karpathy Guidelines',
  'karpathy-skills': 'Karpathy Guidelines',
  'taste-skill': 'Taste Skill',
  'claude-plugins-official': 'Code Quality',
};

// Category descriptions (brief summaries for first-level selection)
const CATEGORY_DESCRIPTIONS = {
  'HyperFrames': '视频、动画、motion graphics 制作。包括视频编辑、字幕、转场、音频、渲染等全流程。',
  'GSAP': 'GSAP 动画库。包括核心 API、React、Vue、ScrollTrigger、Timeline、性能优化等。',
  'Playwright': 'Playwright 测试框架。包括开发、DevOps、测试结果查询、bug 复现等。',
  'UI/UX Design': 'UI/UX 设计。包括设计系统、品牌、前端设计、图片生成、banner 设计等。',
  'Document Skills': '文档处理。包括 Word、PDF、PPT、Excel、幻灯片、内部沟通文档等。',
  'Caveman': '代码简化与重构。包括代码审查、压缩、安全重构、探索、优化等。',
  'Superpowers': '开发流程增强。包括头脑风暴、计划、调试、TDD、代码审查、Git worktree 等。',
  'Ponytail': '代码质量管理。包括审计、技术债追踪、代码增益分析等。',
  'Planning with Files': '项目规划与文件管理。多语言支持。',
  'Karpathy Guidelines': 'AI 编码指导原则。减少幻觉，提高代码质量。',
  'Code Quality': '代码质量工具。',
  'Taste Skill': '高端 UI 设计品味。反 AI 模板化设计。',
  'auto-selector-skill': '自动 skill 路由（本插件）。',
  'Other Local Skills': '其他未分类的 skill。',
};

function categorizeLocalSkill(skillName) {
  if (skillName.includes('hyperframes') || skillName.includes('motion') ||
      skillName.includes('video') || skillName.includes('captions') ||
      skillName.includes('slideshow') || skillName.includes('remotion') ||
      skillName === 'media-use' || skillName === 'figma') {
    return 'HyperFrames';
  }
  if (skillName.includes('gsap')) return 'GSAP';
  if (skillName.includes('playwright')) return 'Playwright';
  if (skillName.includes('design') || skillName.includes('ui') ||
      skillName.includes('brand') || skillName.includes('imagegen') ||
      skillName === 'slides' || skillName === 'image-to-code') {
    return 'UI/UX Design';
  }
  if (skillName.includes('full-output')) return 'Code Quality';
  return 'Other Local Skills';
}

// ── Main ──────────────────────────────────────────────────────────────

// Scan all skills
const allSkills = [
  ...scanInstalledPlugins(),
  ...scanLocalSkills(),
  ...scanProjectSkills(),
];

// Apply blacklist
const blacklist = readBlacklist();
const filteredSkills = blacklist.length > 0
  ? allSkills.filter(s => !blacklist.includes(s.name))
  : allSkills;

// Group by category
const categoryMap = new Map();

for (const skill of filteredSkills) {
  let category = skill.plugin || skill.marketplace || skill.source;

  if (SPECIAL_CATEGORIES[category]) {
    category = SPECIAL_CATEGORIES[category];
  } else if (SPECIAL_CATEGORIES[skill.marketplace]) {
    category = SPECIAL_CATEGORIES[skill.marketplace];
  } else if (SPECIAL_CATEGORIES[skill.plugin]) {
    category = SPECIAL_CATEGORIES[skill.plugin];
  }

  if (category === 'local-skill') {
    category = categorizeLocalSkill(skill.name);
  }

  if (!categoryMap.has(category)) {
    categoryMap.set(category, []);
  }

  const existing = categoryMap.get(category).find(s => s.name === skill.name);
  if (!existing) {
    categoryMap.get(category).push({
      name: skill.name,
      description: skill.description || '',
    });
  }
}

// Build category summaries and detail files
const categories = [];

for (const [name, skills] of categoryMap) {
  // Write detail file for this category
  const detailPath = path.join(CATEGORIES_DIR, `${name.replace(/[^a-zA-Z0-9一-鿿]/g, '_')}.md`);
  const skillList = skills.map(s => `- **${s.name}**: ${s.description}`).join('\n');
  const detailContent = `# ${name}\n\n${CATEGORY_DESCRIPTIONS[name] || ''}\n\n包含 ${skills.length} 个 skill：\n\n${skillList}\n`;
  fs.writeFileSync(detailPath, detailContent, 'utf8');

  categories.push({
    name,
    description: CATEGORY_DESCRIPTIONS[name] || `${name} 相关 skill`,
    skillCount: skills.length,
    detailFile: detailPath,
  });
}

// Read version
let version = '1.3.0';
try {
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  if (fs.existsSync(pkgPath)) {
    version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || version;
  }
} catch (e) {}

// Save index
const index = {
  version,
  timestamp: new Date().toISOString(),
  totalCategories: categories.length,
  totalSkills: filteredSkills.length,
  blacklisted: blacklist.length,
  categories,
};

fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');

// Output brief category summary for context injection
const categorySummary = categories.map(c =>
  `• ${c.name} (${c.skillCount} skills) — ${c.description}`
).join('\n');

const context = `<EXTREMELY_IMPORTANT>
You have auto-selector-skill v${version} active.

**可用 skill 大类（共 ${categories.length} 个）：**

${categorySummary}

**两级选择流程（必须遵循）：**

1. **第一级：选大类** — 根据用户消息，判断匹配哪个大类
2. **第二级：选具体 skill** — 读取对应大类的详细文件，从中选择最合适的 skill
   - 详细文件路径在 index 中：${INDEX_DIR}/categories/<category_name>.md
   - 用 Read 工具读取文件内容
3. **确认** — 调用 AskUserQuestion 推荐选中的 skill

**如果没有匹配的大类 → 直接回答用户问题**

**Rules:**
- 按语义理解，不按关键词
- 用户说"不用" → 不道歉，下次继续推荐
- 匹配不确定时，优先推荐
</EXTREMELY_IMPORTANT>`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context
  }
}));
