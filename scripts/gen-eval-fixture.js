#!/usr/bin/env node
'use strict';
// Regenerate eval/fixtures/skills.json from the current machine's scan.
// The fixture pins a skill set so CI can run the routing benchmark without
// any plugins installed. Descriptions are truncated to keep it small.

const fs = require('fs');
const path = require('path');
const { scanSkills, groupSkills } = require('../src/lib/scan');

const out = path.join(__dirname, '..', 'eval', 'fixtures', 'skills.json');
const { skills, projectDir, categoryOverrides } = scanSkills();

const categoryOf = new Map();
for (const [category, list] of groupSkills(skills, projectDir, categoryOverrides)) {
  for (const skill of list) categoryOf.set(skill.name, category);
}

const fixture = skills
  .map(skill => ({
    name: skill.name,
    description: String(skill.description || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    category: categoryOf.get(skill.name) || '',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Wrote ${fixture.length} skills to ${out}`);
