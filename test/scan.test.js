'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseFrontmatter,
  dedupeSkills,
  scanSkills,
  buildIndexData,
  isBlacklisted,
  categorizeLocalSkill,
  readCategoryOverrides,
  getIndexPaths,
  pickVersionDir,
} = require('../src/lib/scan');

function skill(name, source, extra = {}) {
  return { name, description: `${name} description`, source, identifier: name, ...extra };
}

test('parseFrontmatter: plain, quoted, block scalar', () => {
  assert.deepEqual(
    parseFrontmatter('---\nname: alpha\ndescription: Hello world\n---\nbody'),
    { name: 'alpha', description: 'Hello world' }
  );

  assert.deepEqual(
    parseFrontmatter('---\nname: "beta"\ndescription: \'Quoted desc\'\n---\n'),
    { name: 'beta', description: 'Quoted desc' }
  );

  const folded = parseFrontmatter(
    '---\nname: gamma\ndescription: >\n  line one\n  line two\n---\n'
  );
  assert.equal(folded.description, 'line one line two');

  const literal = parseFrontmatter(
    '---\nname: delta\ndescription: |\n  line one\n  line two\n---\n'
  );
  assert.equal(literal.description, 'line one\nline two');

  const paragraphs = parseFrontmatter(
    '---\nname: epsilon\ndescription: first paragraph\n  continues here\n\n  second paragraph\n---\n'
  );
  assert.equal(paragraphs.description, 'first paragraph continues here\nsecond paragraph');
});

test('pickVersionDir: numeric version ordering, latest wins', () => {
  assert.equal(pickVersionDir(['1.9.0', '1.10.0']), '1.10.0');
  assert.equal(pickVersionDir(['1.2.0', 'latest']), 'latest');
  assert.equal(pickVersionDir(['1.9.0', '1.10.0'], 'C:/cache/1.9.0'), '1.9.0');
});

test('dedupeSkills: prefers project > local > plugin and merges sources', () => {
  const merged = dedupeSkills([
    skill('alpha', 'plugin', { plugin: 'p1', marketplace: 'm1' }),
    skill('Alpha', 'local'),
    skill('alpha', 'project'),
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'project');
  assert.equal(merged[0].sources.length, 3);
  assert.deepEqual(merged[0].sources.sort(), ['local', 'plugin:p1@m1', 'project']);
});

function makeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-selector-'));

  const writeSkill = (dir, name, description) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`
    );
  };

  // local skills
  writeSkill(path.join(home, '.claude', 'skills', 'alpha'), 'alpha', 'Local alpha');
  writeSkill(path.join(home, '.claude', 'skills', 'beta'), 'beta', 'Local beta');

  const cache = (...parts) => path.join(home, '.claude', 'plugins', 'cache', ...parts);

  // enabled plugin with a skill
  writeSkill(cache('mkt', 'pluginA', 'latest', 'skills', 'plugin-skill'), 'plugin-skill', 'Plugin skill');
  // enabled plugin sharing a name with a local skill
  writeSkill(cache('mkt', 'pluginB', 'latest', 'skills', 'beta'), 'beta', 'Plugin beta');
  // enabled command-only plugin (no skills dir)
  fs.mkdirSync(cache('mkt', 'pluginC', 'latest', '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cache('mkt', 'pluginC', 'latest', '.claude-plugin', 'plugin.json')),
    JSON.stringify({ name: 'pluginC', description: 'commands only' })
  );
  // disabled plugin with a ghost skill
  writeSkill(cache('mkt', 'pluginD', 'latest', 'skills', 'ghost'), 'ghost', 'Ghost skill');

  fs.writeFileSync(
    path.join(home, '.claude', 'settings.json'),
    JSON.stringify({ enabledPlugins: { 'pluginA@mkt': true, 'pluginB@mkt': true, 'pluginC@mkt': true } })
  );

  return home;
}

test('scanSkills: filters disabled plugins, skips command-only plugins, dedupes', () => {
  const home = makeHome();
  const result = scanSkills({ home, projectDir: home });

  assert.equal(result.stats.pluginsSkipped, 1);
  assert.equal(result.stats.projectSkipped, true, 'project dir == local dir');
  assert.equal(result.stats.raw, 4, 'alpha, beta, beta(plugin), plugin-skill');
  assert.equal(result.stats.unique, 3);

  const names = result.skills.map(s => s.name).sort();
  assert.deepEqual(names, ['alpha', 'beta', 'plugin-skill']);

  const beta = result.skills.find(s => s.name === 'beta');
  assert.equal(beta.source, 'local');
  assert.ok(beta.sources.includes('plugin:pluginB@mkt'));
  assert.equal(result.skills.some(s => s.name === 'ghost'), false);

  fs.rmSync(home, { recursive: true, force: true });
});

test('scanSkills: project settings can disable a user-enabled plugin', () => {
  const home = makeHome();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-selector-proj-'));
  fs.mkdirSync(path.join(project, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(project, '.claude', 'settings.local.json'),
    JSON.stringify({ enabledPlugins: { 'pluginA@mkt': false } })
  );

  const result = scanSkills({ home, projectDir: project });
  assert.equal(result.skills.some(s => s.name === 'plugin-skill'), false);
  assert.equal(result.stats.pluginsSkipped, 2, 'pluginA overridden + pluginD disabled');

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
});

test('buildIndexData: counts stay consistent and detail files exist', () => {
  const home = makeHome();
  const { skills } = scanSkills({ home, projectDir: home });
  const dir = path.join(home, 'index');
  const index = buildIndexData(skills, {
    version: '9.9.9',
    blacklistCount: 0,
    categoriesDir: dir,
    projectDir: home,
  });

  assert.equal(index.totalSkills, 3);
  assert.equal(index.categorySum, 3);
  assert.equal(index.skillNames.length, 3);
  assert.equal(index.totalCategories, index.categories.length);
  for (const c of index.categories) {
    assert.ok(fs.existsSync(c.detailFile), c.detailFile);
    assert.ok(c.shortDescription && c.shortDescription.length <= 27);
  }

  fs.rmSync(home, { recursive: true, force: true });
});

test('buildIndexData: categoryOverrides and stale detail cleanup', () => {
  const home = makeHome();
  const { skills } = scanSkills({ home, projectDir: home });
  const dir = path.join(home, 'index-overrides');

  const first = buildIndexData(skills, {
    version: '9.9.9',
    categoriesDir: dir,
    projectDir: home,
    categoryOverrides: { alpha: 'Custom Alpha', beta: 'Custom Alpha' },
  });
  const custom = first.categories.find(c => c.name === 'Custom Alpha');
  assert.ok(custom);
  assert.equal(custom.skillCount, 2);
  assert.ok(fs.existsSync(custom.detailFile));

  const second = buildIndexData(skills, {
    version: '9.9.9',
    categoriesDir: dir,
    projectDir: home,
  });
  assert.equal(second.categories.some(c => c.name === 'Custom Alpha'), false);
  assert.equal(fs.existsSync(custom.detailFile), false, 'stale detail file was not removed');

  fs.rmSync(home, { recursive: true, force: true });
});

test('buildIndexData: colliding category names get distinct detail files', () => {
  const home = makeHome();
  const { skills } = scanSkills({ home, projectDir: home });
  const dir = path.join(home, 'index-collide');

  const index = buildIndexData(skills, {
    version: '9.9.9',
    categoriesDir: dir,
    projectDir: home,
    categoryOverrides: { alpha: 'A/B', beta: 'A:B' },
  });

  const a = index.categories.find(c => c.name === 'A/B');
  const b = index.categories.find(c => c.name === 'A:B');
  assert.ok(a && b);
  assert.notEqual(a.detailFile, b.detailFile);
  assert.ok(fs.existsSync(a.detailFile));
  assert.ok(fs.existsSync(b.detailFile));

  fs.rmSync(home, { recursive: true, force: true });
});

test('getIndexPaths: project skills get a private bucket', () => {
  const home = makeHome();
  const claude = path.join(home, '.claude');

  // home/.claude/skills is the local dir: no isolation.
  assert.equal(getIndexPaths(claude, home).isolated, false);

  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-selector-bucket-'));
  fs.mkdirSync(path.join(project, '.claude', 'skills'), { recursive: true });
  const paths = getIndexPaths(claude, project);
  assert.equal(paths.isolated, true);
  assert.ok(paths.dir.includes(path.join('auto-selector', 'projects')));

  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-selector-bucket-'));
  fs.mkdirSync(path.join(other, '.claude', 'skills'), { recursive: true });
  assert.notEqual(getIndexPaths(claude, other).dir, paths.dir);

  // Project-level enablement also changes the scan result.
  const settingsProject = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-selector-bucket-'));
  fs.mkdirSync(path.join(settingsProject, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(settingsProject, '.claude', 'settings.local.json'),
    JSON.stringify({ enabledPlugins: { 'p@m': true } })
  );
  assert.equal(getIndexPaths(claude, settingsProject).isolated, true);

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
  fs.rmSync(other, { recursive: true, force: true });
  fs.rmSync(settingsProject, { recursive: true, force: true });
});

test('scanSkills: applies the blacklist before indexing', () => {
  const home = makeHome();
  fs.writeFileSync(
    path.join(home, '.auto-selector-skill-blacklist.json'),
    JSON.stringify(['Alpha'])
  );

  const result = scanSkills({ home, projectDir: home });
  assert.equal(result.skills.some(s => s.name === 'alpha'), false);
  assert.equal(result.stats.blacklisted, 1);
  assert.deepEqual(result.blacklist, ['Alpha']);

  fs.rmSync(home, { recursive: true, force: true });
});

test('categorizeLocalSkill: config overrides beat name heuristics', () => {
  const overrides = {
    'local-bucket-a': 'HyperFrames',
    'local-bucket-b': 'HyperFrames',
    'local-bucket-c': 'UI/UX Design',
    'local-bucket-d': 'Document Skills',
    'local-bucket-e': 'Planning with Files',
  };

  assert.equal(categorizeLocalSkill('local-bucket-a', overrides), 'HyperFrames');
  assert.equal(categorizeLocalSkill('local-bucket-b', overrides), 'HyperFrames');
  assert.equal(categorizeLocalSkill('local-bucket-c', overrides), 'UI/UX Design');
  assert.equal(categorizeLocalSkill('local-bucket-d', overrides), 'Document Skills');
  assert.equal(categorizeLocalSkill('local-bucket-e', overrides), 'Planning with Files');

  // No skill names are baked into the plugin.
  assert.equal(categorizeLocalSkill('local-bucket-a'), 'Other Local Skills');
  assert.equal(categorizeLocalSkill('gsap-scrolltrigger'), 'GSAP');
  assert.equal(categorizeLocalSkill('unknown-thing'), 'Other Local Skills');
});

test('readCategoryOverrides: reads config and drops invalid entries', () => {
  const home = makeHome();
  const claude = path.join(home, '.claude');
  fs.mkdirSync(path.join(claude, 'auto-selector'), { recursive: true });
  fs.writeFileSync(
    path.join(claude, 'auto-selector', 'config.json'),
    JSON.stringify({
      categoryOverrides: {
        'My-Skill': 'Custom',
        '': 'ignored',
        'numeric': 3,
        'blank': '   ',
      },
    })
  );

  assert.deepEqual(readCategoryOverrides(claude), { 'my-skill': 'Custom' });

  fs.rmSync(home, { recursive: true, force: true });
});

test('isBlacklisted: name, prefix, case-insensitive', () => {
  assert.equal(isBlacklisted({ name: 'Alpha' }, ['alpha']), true);
  assert.equal(isBlacklisted({ name: 'alpha-extra' }, ['alpha']), true);
  assert.equal(isBlacklisted({ name: 'alphabeta' }, ['alpha']), false);
  assert.equal(isBlacklisted({ name: 'x', plugin: 'P1' }, ['p1']), true);
});
