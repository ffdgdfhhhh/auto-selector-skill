#!/usr/bin/env node
// auto-selector-skill — SessionStart hook
// Scan all skills/plugins, build index, save to file

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INDEX_PATH = path.join(HOME, '.claude', 'auto-selector-index.json');
const BLACKLIST_PATH = path.join(HOME, '.auto-selector-skill-blacklist.json');

// Parse YAML frontmatter from SKILL.md
function parseFrontmatter(content) {
  // Handle both \n and \r\n line endings
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const result = {};
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    // Take everything after first colon, trim quotes if present
    let value = line.slice(colonIdx + 1).trim();
    // Remove surrounding quotes
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

        // Iterate version directories (e.g., "latest", "1.0.0", "6.3.0")
        const versionDirs = fs.readdirSync(pluginPath);
        for (const versionDir of versionDirs) {
          const versionPath = path.join(pluginPath, versionDir);
          if (!fs.statSync(versionPath).isDirectory()) continue;

          // Read plugin.json from version directory
          const pluginJsonPath = path.join(versionPath, '.claude-plugin', 'plugin.json');
          if (fs.existsSync(pluginJsonPath)) {
            try {
              const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
              skills.push({
                name: pluginJson.name || pluginDir,
                description: pluginJson.description || '',
                source: 'plugin',
                marketplace: marketDir,
                version: versionDir,
              });
            } catch (e) {
              console.error(`[auto-selector] Error reading ${pluginJsonPath}: ${e.message}`);
            }
          }

          // Scan skills inside plugin version
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
                        version: versionDir,
                      });
                    }
                  } catch (e) {
                    console.error(`[auto-selector] Error reading ${skillMdPath}: ${e.message}`);
                  }
                }
              }
            } catch (e) {
              console.error(`[auto-selector] Error scanning skills in ${versionPath}: ${e.message}`);
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

      // Handle symlinks - resolve to actual path
      let realPath = skillPath;
      try {
        realPath = fs.realpathSync(skillPath);
      } catch (e) { /* use original path */ }

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

// Build full index with category grouping
const installedPlugins = scanInstalledPlugins();
const localSkills = scanLocalSkills();
const projectSkills = scanProjectSkills();
const allSkills = [...installedPlugins, ...localSkills, ...projectSkills];

// Read blacklist and filter
const blacklist = readBlacklist();
const filteredSkills = blacklist.length > 0
  ? allSkills.filter(s => !blacklist.includes(s.name))
  : allSkills;

// Group by category (plugin or source)
const categoryMap = new Map();
const SPECIAL_CATEGORIES = {
  'gsap-skills': 'GSAP',
  'hyperframes': 'HyperFrames',
  'playwright': 'Playwright',
  'document-skills': 'Document Skills',
  'example-skills': 'Example Skills',
  'superpowers': 'Superpowers',
  'superpowers-dev': 'Superpowers',
  'ponytail': 'Ponytail',
  'caveman': 'Caveman',
  'planning-with-files': 'Planning with Files',
  'andrej-karpathy-skills': 'Karpathy Guidelines',
  'karpathy-skills': 'Karpathy Guidelines',
  'taste-skill': 'Taste Skill',
};

// Categorize local skills by name patterns
function categorizeLocalSkill(skillName) {
  if (skillName.includes('hyperframes') || skillName.includes('motion') ||
      skillName.includes('video') || skillName.includes('captions') ||
      skillName.includes('slideshow') || skillName.includes('remotion') ||
      skillName === 'media-use' || skillName === 'figma') {
    return 'HyperFrames';
  }
  if (skillName.includes('gsap')) {
    return 'GSAP';
  }
  if (skillName.includes('playwright')) {
    return 'Playwright';
  }
  if (skillName.includes('design') || skillName.includes('ui') ||
      skillName.includes('brand') || skillName.includes('imagegen') ||
      skillName === 'slides' || skillName === 'image-to-code') {
    return 'UI/UX Design';
  }
  if (skillName.includes('full-output')) {
    return 'Code Generation';
  }
  return 'Other Local Skills';
}

for (const skill of filteredSkills) {
  // Determine category name
  let category = skill.plugin || skill.marketplace || skill.source;

  // Apply special category mapping
  if (SPECIAL_CATEGORIES[category]) {
    category = SPECIAL_CATEGORIES[category];
  } else if (SPECIAL_CATEGORIES[skill.marketplace]) {
    category = SPECIAL_CATEGORIES[skill.marketplace];
  } else if (SPECIAL_CATEGORIES[skill.plugin]) {
    category = SPECIAL_CATEGORIES[skill.plugin];
  }

  // Further categorize local skills
  if (category === 'local-skill') {
    category = categorizeLocalSkill(skill.name);
  }

  // Skip duplicate categories (Document Skills vs Example Skills)
  if (category === 'Example Skills' && categoryMap.has('Document Skills')) {
    continue;
  }

  if (!categoryMap.has(category)) {
    categoryMap.set(category, {
      name: category,
      skills: [],
      source: skill.source,
      marketplace: skill.marketplace,
      plugin: skill.plugin,
    });
  }

  // Avoid duplicate skill names within same category
  const existingSkill = categoryMap.get(category).skills.find(s => s.name === skill.name);
  if (!existingSkill) {
    categoryMap.get(category).skills.push({
      name: skill.name,
      description: skill.description,
    });
  }
}

// Convert to array
const categories = Array.from(categoryMap.values());

// Read version from package.json dynamically
let version = '1.2.1';
try {
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  if (fs.existsSync(pkgPath)) {
    version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || version;
  }
} catch (e) { /* use default */ }

// Save index
const index = {
  version,
  timestamp: new Date().toISOString(),
  totalCategories: categories.length,
  totalSkills: filteredSkills.length,
  blacklisted: blacklist.length,
  categories,
};

try {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
} catch (e) {
  // If write fails, output to stdout for fallback
}

// Output context for Claude
const categoryList = categories.map(cat => {
  const skillCount = cat.skills.length;
  const skillNames = cat.skills.map(s => s.name).join(', ');
  return `• ${cat.name} (${skillCount} skills: ${skillNames})`;
}).join('\n');

const context = `<EXTREMELY_IMPORTANT>
You have auto-selector-skill v${version} active.

**Below are ALL available skill categories in this session (${categories.length} categories, ${filteredSkills.length} total skills):**

${categoryList}

**MANDATORY routing rules — Follow on EVERY user message:**

1. Analyze the user's message intent
2. Check if any CATEGORY above matches the user's need (by meaning, not exact keywords)
3. If YES → call AskUserQuestion tool FIRST:
   - question: "推荐使用 [category名] — {包含的skill列表}"
   - header: "Skill"
   - options: [{"label": "✅ 使用", "description": "用这个skill帮你做"}, {"label": "❌ 不用", "description": "跳过，直接回答"}]
   - multiSelect: false
4. If NO → respond normally

**Matching examples:**
- "帮我做个网页" → UI/UX 设计相关 categories
- "重构代码" → 代码简化相关 categories
- "写测试" → 测试相关 categories
- "做个计划" → 项目规划相关 categories
- "做个视频" → HyperFrames
- "写文档" → Document Skills
- "简洁一点" → Caveman

**Rules:**
- Match by MEANING, not keywords
- 用户说"不用" → 不道歉，下次继续推荐
- 复杂需求可推荐多个 categories
- 匹配不确定时，优先推荐
</EXTREMELY_IMPORTANT>`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context
  }
}));
