'use strict';
// Deterministic lexical matcher. Used by the MCP server (non-Claude hosts)
// and as a benchmark baseline. Claude Code itself uses semantic matching.

const LATIN = /[a-z0-9][a-z0-9_.-]*/g;
const CJK = /[一-鿿]+/g;

// Chinese → English hints so a lexical fallback can reach English
// skill names and descriptions. This is a fallback, not the Claude Code
// matcher (which is semantic).
const SYNONYMS = {
  视频: ['video'], 影片: ['video'], 动画: ['animation', 'animate'],
  设计: ['design'], 品牌: ['brand'], 测试: ['test', 'testing'],
  字幕: ['caption', 'subtitle'], 转场: ['transition'], 卡点: ['beat', 'music'],
  音乐: ['music'], 音频: ['audio', 'sound'], 混音: ['mix', 'audio'],
  宣传: ['promo', 'launch'], 推广: ['promo', 'marketing'], 发布: ['launch', 'release'],
  产品: ['product'], 广告: ['ad', 'advertising'], 社交媒体: ['social', 'media'],
  横幅: ['banner'], 落地页: ['landing', 'page'], 网页: ['web', 'website'],
  网站: ['website', 'web'], 移动端: ['mobile', 'app'], 界面: ['ui', 'interface'],
  仪表盘: ['dashboard'], 图表: ['chart', 'graph'], 幻灯片: ['slide', 'presentation'],
  演示: ['presentation', 'slide'], 模板: ['template'], 视觉: ['visual'],
  极简: ['minimal', 'minimalist'], 高端: ['high-end', 'premium'], 工业: ['industrial'],
  军事: ['military'], 终端: ['terminal'], 风格: ['style'], 代码: ['code'],
  完整: ['full', 'complete'], 生成: ['generate'], 模型: ['model'],
  三维: ['3d', 'three'], 图片: ['image'], 文字: ['text', 'typography'],
  标题: ['title', 'headline'], 滚动: ['scroll'], 性能: ['performance'],
  优化: ['optimize'], 调试: ['debug'], 分析: ['analyze'], 失败: ['failure', 'fail'],
  通过率: ['pass', 'rate', 'results'], 解说: ['explainer', 'narrate'],
  迁移: ['migrate'], 项目: ['project'], 时间线: ['timeline'], 顺序: ['sequence', 'timeline'],
  清理: ['cleanup'], 概念图: ['concept'], 参考图: ['reference'], 重新设计: ['redesign'],
  现有: ['existing'], 字幕组: ['subtitle'], 长文: ['article', 'text'],
};

function addToken(tokens, word) {
  if (word.length < 2) return;
  tokens.add(word);
  // Naive plural normalization: captions → caption, subtitles → subtitle.
  if (word.length > 3 && word.endsWith('s')) tokens.add(word.slice(0, -1));
}

function tokenize(text) {
  const lower = String(text || '').toLowerCase();
  const tokens = new Set();

  for (const word of lower.match(LATIN) || []) {
    addToken(tokens, word);
    // Split compound names: gsap-scrolltrigger → gsap, scrolltrigger;
    // banner-design → banner, design.
    if (/[_.-]/.test(word)) {
      for (const part of word.split(/[_.-]+/)) addToken(tokens, part);
    }
  }

  for (const run of lower.match(CJK) || []) {
    if (run.length === 1) tokens.add(run);
    for (let i = 0; i < run.length - 1; i++) {
      tokens.add(run.slice(i, i + 2));
    }
  }

  // Add English hints for any known term contained in the text.
  for (const [term, hints] of Object.entries(SYNONYMS)) {
    if (lower.includes(term)) {
      for (const hint of hints) addToken(tokens, hint);
    }
  }

  return tokens;
}

function overlap(a, b) {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function scoreSkill(queryTokens, skill, options = {}) {
  const nameTokens = tokenize(skill.name);
  const descTokens = tokenize(skill.description);
  const categoryTokens = tokenize(options.category || '');

  const q = String(options.query || '').toLowerCase();
  const name = String(skill.name || '').toLowerCase();

  let score = 0;
  if (q === name) score += 100;
  else if (name && q.includes(name)) score += 20;

  const nameHits = overlap(queryTokens, nameTokens);
  const descHits = overlap(queryTokens, descTokens);
  const categoryHits = overlap(queryTokens, categoryTokens);

  score += nameHits * 8;
  score += descHits * 2;
  score += categoryHits * 3;

  // Prefer specific names when scores tie.
  if (nameHits > 0 && nameTokens.size > 0) {
    score += (nameHits / nameTokens.size) * 4;
  }

  return {
    score: Math.round(score * 100) / 100,
    nameHits,
    descHits,
    categoryHits,
  };
}

function rankSkills(query, skills, options = {}) {
  const limit = options.limit || 5;
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [];

  return skills
    .map(skill => {
      const result = scoreSkill(queryTokens, skill, {
        query,
        category: options.categoryFor ? options.categoryFor(skill) : '',
      });
      return {
        name: skill.name,
        description: skill.description,
        category: options.categoryFor ? options.categoryFor(skill) : '',
        score: result.score,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

module.exports = { tokenize, rankSkills };
