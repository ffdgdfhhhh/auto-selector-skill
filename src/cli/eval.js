#!/usr/bin/env node
'use strict';
// Routing benchmark.
//   node src/cli/eval.js --check [--allow-missing]
//   node src/cli/eval.js --baseline [--fixture <file>] [--min-top1 0.60] [--min-top3 0.85]
//   node src/cli/eval.js --prompt <outdir> [--fixture <file>]
//   node src/cli/eval.js --results <file.jsonl>
//
// Predictions file format: one JSON per line { "id": "...", "predicted": ["..."] }
// Fixture format: [{ "name": "...", "description": "...", "category": "..." }]

const fs = require('fs');
const path = require('path');
const {
  getClaudeDir,
  getIndexPaths,
  readJson,
  scanSkills,
  groupSkills,
} = require('../lib/scan');
const { rankSkills } = require('../lib/match');

const CASES_PATH = path.join(__dirname, '..', '..', 'eval', 'cases.jsonl');
const INDEX_PATH = getIndexPaths(getClaudeDir()).indexPath;

function readJsonl(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return raw.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        return { ...JSON.parse(line), _line: i + 1 };
      } catch (e) {
        throw new Error(`Invalid JSON on line ${i + 1}: ${e.message}`);
      }
    });
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function readThreshold(args, flag) {
  const raw = argValue(args, flag);
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    console.error(`${flag} expects a number between 0 and 1`);
    process.exit(1);
  }
  return value;
}

function readFixture(file) {
  const data = readJson(file, null);
  if (!Array.isArray(data)) throw new Error(`Invalid fixture: ${file}`);
  return data
    .filter(s => s && typeof s.name === 'string' && s.name.trim())
    .map(s => ({
      name: s.name.trim(),
      description: String(s.description || ''),
      category: String(s.category || ''),
      source: 'local',
      identifier: s.name.trim(),
    }));
}

// Real scan, or a checked-in fixture so CI can run without plugins installed.
function loadSkills(fixturePath) {
  if (fixturePath) {
    return { skills: readFixture(fixturePath), categoryOf: null };
  }

  const { skills, projectDir, categoryOverrides } = scanSkills();
  const categoryOf = new Map();
  for (const [category, list] of groupSkills(skills, projectDir, categoryOverrides)) {
    for (const skill of list) categoryOf.set(skill.name, category);
  }
  return { skills, categoryOf };
}

function categoryFor(categoryOf) {
  return skill => (categoryOf ? categoryOf.get(skill.name) : skill.category) || '';
}

function loadIndexNames() {
  const index = readJson(INDEX_PATH, null);
  return new Set(index && Array.isArray(index.skillNames) ? index.skillNames : []);
}

function check(cases, known, allowMissing) {
  let problems = 0;
  const ids = new Set();

  if (known.size === 0) {
    if (allowMissing) {
      console.log('⚠ no index found; expected-skill existence was not checked');
    } else {
      console.log('✘ no index found; run the SessionStart hook or pass --allow-missing');
      problems++;
    }
  }

  for (const c of cases) {
    if (!c.id || ids.has(c.id)) {
      console.log(`✘ line ${c._line}: missing or duplicate id "${c.id}"`);
      problems++;
    }
    ids.add(c.id);

    if (!c.task) {
      console.log(`✘ ${c.id}: empty task`);
      problems++;
    }
    if (!Array.isArray(c.expected) || c.expected.length === 0) {
      console.log(`✘ ${c.id}: empty expected`);
      problems++;
      continue;
    }

    const missing = known.size ? c.expected.filter(n => !known.has(n)) : [];
    if (missing.length) {
      console.log(
        `${allowMissing ? '⚠' : '✘'} ${c.id}: expected skill not in index — ${missing.join(', ')}`
      );
      if (!allowMissing) problems++;
    }
  }

  console.log(
    `\n${cases.length} cases, ${problems} problem(s)` +
    `${known.size ? `, ${known.size} indexed skills` : ''}`
  );
  return problems === 0;
}

function metrics(cases, predictions) {
  const byId = new Map(predictions.map(p => [p.id, p.predicted || []]));
  let top1 = 0, top3 = 0, covered = 0;
  const failures = [];

  for (const c of cases) {
    const predicted = byId.get(c.id);
    if (!predicted) continue;
    covered++;
    const ok1 = predicted.length > 0 && c.expected.includes(predicted[0]);
    const ok3 = predicted.slice(0, 3).some(n => c.expected.includes(n));
    if (ok1) top1++;
    if (ok3) top3++;
    if (!ok3) failures.push({ id: c.id, predicted: predicted.slice(0, 3), expected: c.expected });
  }

  return {
    covered,
    total: cases.length,
    top1: covered ? top1 / covered : 0,
    top3: covered ? top3 / covered : 0,
    failures,
  };
}

function report(result) {
  const pct = n => `${(n * 100).toFixed(1)}%`;
  console.log(`\ncovered: ${result.covered}/${result.total}`);
  console.log(`top-1:   ${pct(result.top1)}`);
  console.log(`top-3:   ${pct(result.top3)}`);

  if (result.failures.length) {
    console.log('\nmisses (not in top-3):');
    for (const f of result.failures) {
      console.log(`  ${f.id}: got [${f.predicted.join(', ')}] expected [${f.expected.join(', ')}]`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const cases = readJsonl(CASES_PATH);
  const fixture = argValue(args, '--fixture');

  if (args.includes('--check')) {
    const allowMissing = args.includes('--allow-missing');
    const ok = check(cases, loadIndexNames(), allowMissing);
    process.exit(ok ? 0 : 1);
  }

  if (args.includes('--baseline')) {
    const { skills, categoryOf } = loadSkills(fixture);
    const predictions = cases.map(c => ({
      id: c.id,
      predicted: rankSkills(c.task, skills, {
        limit: 3,
        categoryFor: categoryFor(categoryOf),
      }).map(r => r.name),
    }));
    const result = metrics(cases, predictions);
    report(result);

    const minTop1 = readThreshold(args, '--min-top1');
    const minTop3 = readThreshold(args, '--min-top3');
    let failed = false;
    if (minTop1 !== null && result.top1 < minTop1) {
      console.error(`✘ top-1 ${(result.top1 * 100).toFixed(1)}% < ${(minTop1 * 100).toFixed(1)}%`);
      failed = true;
    }
    if (minTop3 !== null && result.top3 < minTop3) {
      console.error(`✘ top-3 ${(result.top3 * 100).toFixed(1)}% < ${(minTop3 * 100).toFixed(1)}%`);
      failed = true;
    }
    process.exit(failed ? 1 : 0);
  }

  const promptIdx = args.indexOf('--prompt');
  if (promptIdx !== -1) {
    const dir = args[promptIdx + 1];
    if (!dir) {
      console.error('Usage: --prompt <outdir>');
      process.exit(1);
    }

    const { skills, categoryOf } = loadSkills(fixture);
    const category = categoryFor(categoryOf);

    fs.mkdirSync(dir, { recursive: true });
    for (const c of cases) {
      const lines = [
        `Task: ${c.task}`,
        '',
        'Pick up to 3 skill names that best match the task.',
        'Output only a JSON array of names, for example ["skill-a", "skill-b"].',
        '',
        'Available skills:',
        ...skills.map(s => `- ${s.name} [${category(s)}]: ${s.description}`),
      ];
      fs.writeFileSync(path.join(dir, `${c.id}.txt`), lines.join('\n'), 'utf8');
    }
    console.log(`Wrote ${cases.length} prompts to ${dir}`);
    return;
  }

  const resultsIdx = args.indexOf('--results');
  if (resultsIdx !== -1) {
    const file = args[resultsIdx + 1];
    if (!file) {
      console.error('Usage: --results <file.jsonl>');
      process.exit(1);
    }
    const predictions = readJsonl(file);
    report(metrics(cases, predictions));
    return;
  }

  console.log(`Usage:
  node src/cli/eval.js --check [--allow-missing]
  node src/cli/eval.js --baseline [--fixture <file>] [--min-top1 0.60] [--min-top3 0.85]
  node src/cli/eval.js --prompt <outdir> [--fixture <file>]
  node src/cli/eval.js --results <file.jsonl>`);
}

main();
