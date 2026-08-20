#!/usr/bin/env node
// auto-selector-skill — UserPromptSubmit hook
// Semantic matching: extract keywords from user message, match top skills

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INDEX_PATH = path.join(HOME, '.claude', 'auto-selector-index.json');
const CACHE_PATH = path.join(HOME, '.claude', 'auto-selector-cache.json');
const MAX_SKILLS = 5; // Only inject top 5 matches, not all 60

const userPrompt = process.argv[2] || '';

// No prompt, skip
if (!userPrompt) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ""
    }
  }));
  process.exit(0);
}

// Read pre-built index
let index = null;
try {
  if (fs.existsSync(INDEX_PATH)) {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  }
} catch (e) {
  console.error(`[auto-selector] Error reading index: ${e.message}`);
}

// If no index, skip
if (!index || !index.skills || index.skills.length === 0) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ""
    }
  }));
  process.exit(0);
}

// Read session cache (track recommended skills)
let cache = { recommended: [], lastReset: Date.now() };
try {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    // Reset cache if older than 1 hour
    if (Date.now() - cache.lastReset > 3600000) {
      cache = { recommended: [], lastReset: Date.now() };
    }
  }
} catch (e) {
  console.error(`[auto-selector] Error reading cache: ${e.message}`);
}

// Synonym mapping for common Chinese tech terms
const SYNONYMS = {
  '网页': ['web', 'website', 'page', 'html'],
  '网站': ['website', 'web', 'site'],
  '界面': ['ui', 'interface', 'frontend'],
  '前端': ['frontend', 'front-end', 'web'],
  '后端': ['backend', 'back-end', 'server', 'api'],
  '动画': ['animation', 'animate', 'motion', 'gsap'],
  '视频': ['video', 'animation', 'motion'],
  '测试': ['test', 'testing', 'playwright'],
  '代码': ['code', 'coding', 'program'],
  '重构': ['refactor', 'simplify', 'clean'],
  '设计': ['design', 'ui', 'ux'],
  '文档': ['doc', 'document', 'documentation'],
  '计划': ['plan', 'planning'],
  '部署': ['deploy', 'devops', 'ci'],
  '数据库': ['database', 'db', 'sql'],
  '插件': ['plugin', 'extension'],
  '应用': ['app', 'application'],
  '移动': ['mobile', 'ios', 'android'],
};

// Extract keywords from user message (handles both English and Chinese)
function extractKeywords(text) {
  const keywords = new Set();

  // English: split by spaces and punctuation
  const englishWords = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && /[a-zA-Z]/.test(w));

  englishWords.forEach(w => keywords.add(w));

  // Chinese: extract 2-4 character segments (simple n-gram approach)
  const chineseChars = text.match(/[一-鿿]+/g) || [];
  for (const segment of chineseChars) {
    // Extract 2-char, 3-char, and 4-char substrings
    for (let len = 2; len <= Math.min(4, segment.length); len++) {
      for (let i = 0; i <= segment.length - len; i++) {
        const word = segment.slice(i, i + len);
        keywords.add(word);

        // Add English synonyms for Chinese words
        if (SYNONYMS[word]) {
          SYNONYMS[word].forEach(syn => keywords.add(syn));
        }
      }
    }
  }

  // Remove common stop words
  const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '里', '什么', '怎么', '为什么', '帮我', '这个', '那个', '可以', '因为', '所以', '但是', '而且', '或者', '如何', '怎样', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'how', 'what', 'why', 'when', 'where', 'which']);

  const result = Array.from(keywords).filter(w => !stopWords.has(w));
  return result;
}

// Calculate match score between user message and skill
function calculateScore(keywords, skill) {
  let score = 0;
  const name = skill.name.toLowerCase();
  const desc = (skill.description || '').toLowerCase();

  for (const keyword of keywords) {
    // Exact match in name: very high score
    if (name === keyword) {
      score += 50;
    }
    // Name contains keyword: high score
    else if (name.includes(keyword)) {
      score += 20;
    }

    // Check description for keyword matches
    const descWords = desc.split(/[\s,;.!?，。；！？]+/).filter(w => w.length > 0);

    // Exact word match in description: medium score
    if (descWords.includes(keyword)) {
      score += 10;
    }
    // Description contains keyword: lower score
    else if (desc.includes(keyword)) {
      score += 5;
    }

    // For Chinese keywords, also check if they appear in common compound words
    if (/^[一-鿿]+$/.test(keyword)) {
      // Check if keyword appears in description (substring match)
      if (desc.includes(keyword)) {
        score += 3; // Additional points for Chinese substring match
      }
    }

    // For English keywords, check word stems (simple suffix removal)
    if (/^[a-zA-Z]+$/.test(keyword) && keyword.length > 3) {
      const stem = keyword.replace(/(ing|ed|er|est|s|es|ly|tion|ment)$/, '');
      if (stem.length > 2) {
        if (name.includes(stem)) score += 5;
        if (desc.includes(stem)) score += 2;
      }
    }
  }

  return score;
}

// Match skills
const keywords = extractKeywords(userPrompt);
const scored = index.skills.map(skill => ({
  skill,
  score: calculateScore(keywords, skill)
}));

// Sort by score, filter out zero scores and already-recommended skills
const matches = scored
  .filter(s => s.score > 0 && !cache.recommended.includes(s.skill.name))
  .sort((a, b) => b.score - a.score)
  .slice(0, MAX_SKILLS);

// Update cache
if (matches.length > 0) {
  cache.recommended.push(...matches.map(m => m.skill.name));
  // Keep only last 20 recommendations
  if (cache.recommended.length > 20) {
    cache.recommended = cache.recommended.slice(-20);
  }
  cache.lastReset = Date.now();

  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.error(`[auto-selector] Error writing cache: ${e.message}`);
  }
}

// If no matches, skip
if (matches.length === 0) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ""
    }
  }));
  process.exit(0);
}

// Build context with only matched skills
const skillList = matches.map(m => {
  const sourceTag = m.skill.source === 'plugin' ? '[plugin]' :
                    m.skill.source === 'skill' ? '[skill]' :
                    m.skill.source === 'local-skill' ? '[local]' : '[project]';
  return `• ${m.skill.name} ${sourceTag} (score: ${m.score}) — ${m.skill.description || '无描述'}`;
}).join('\n');

const context = `<AUTO_SELECTORRouting>
用户消息匹配到 ${matches.length} 个 skill（共 ${index.skills.length} 个可用）：

${skillList}

请判断是否推荐使用这些 skill。
如果有高匹配度的 skill → 调用 AskUserQuestion 推荐
如果匹配度低或不确定 → 正常回答

匹配原则：按语义理解，不按关键词。优先推荐 score > 10 的 skill。
</AUTO_SELECTORRouting>`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: context
  }
}));
