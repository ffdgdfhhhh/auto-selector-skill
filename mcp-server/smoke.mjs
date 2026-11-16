#!/usr/bin/env node
// End-to-end MCP smoke test. Uses an isolated fixture HOME so it works on a
// clean CI runner with no personal skills installed.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import assert from "assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeFixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "as-mcp-home-"));
  const claudeDir = path.join(home, ".claude");
  const skillsDir = path.join(claudeDir, "skills");

  const writeSkill = (name, description) => {
    const dir = path.join(skillsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`
    );
  };

  writeSkill("captions-craft", "Add captions and subtitles to a talking-head video");
  writeSkill("banner-craft", "Design banners for social media ads and print");

  fs.writeFileSync(
    path.join(claudeDir, "settings.json"),
    JSON.stringify({ enabledPlugins: {} })
  );

  return { home, claudeDir, project: fs.mkdtempSync(path.join(os.tmpdir(), "as-mcp-proj-")) };
}

const fixture = makeFixture();
const env = {
  ...process.env,
  AUTO_SELECTOR_HOME: fixture.home,
  AUTO_SELECTOR_CLAUDE_DIR: fixture.claudeDir,
  HOME: fixture.home,
  USERPROFILE: fixture.home,
};

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(__dirname, "index.js")],
  cwd: __dirname,
  env,
  stderr: "pipe",
});

const client = new Client(
  { name: "auto-selector-smoke", version: "0.0.0" },
  { capabilities: {} }
);

function payload(result) {
  assert.ok(result && Array.isArray(result.content) && result.content[0]);
  return JSON.parse(result.content[0].text);
}

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const names = tools.tools.map(t => t.name).sort();
  assert.deepEqual(names, ["ask_user", "confirm_skill", "list_skills", "match_skill", "scan_skills"]);
  console.log(`✔ tools: ${names.join(", ")}`);

  const scan = payload(await client.callTool({
    name: "scan_skills",
    arguments: { project_root: fixture.project },
  }));
  assert.equal(scan.status, "ok");
  assert.equal(scan.totalSkills, 2, `expected 2 fixture skills, got ${scan.totalSkills}`);
  const total = scan.categories.reduce((n, c) => n + c.count, 0);
  assert.equal(total, scan.totalSkills, "category counts do not sum to totalSkills");
  console.log(`✔ scan_skills: ${scan.totalSkills} skills / ${scan.categories.length} categories`);

  const match = payload(await client.callTool({
    name: "match_skill",
    arguments: { message: "给视频加字幕", limit: 3 },
  }));
  assert.equal(match.status, "ok");
  assert.equal(match.matches[0].name, "captions-craft", `unexpected top match: ${match.matches[0].name}`);
  console.log(`✔ match_skill: ${match.matches.map(m => m.name).join(", ")}`);

  const list = payload(await client.callTool({ name: "list_skills", arguments: {} }));
  assert.equal(list.status, "ok");
  assert.equal(list.skills.length, 2);
  console.log(`✔ list_skills: ${list.skills.length} entries`);

  const ask = payload(await client.callTool({
    name: "ask_user",
    arguments: { skill_name: "captions-craft", skill_description: "加字幕" },
  }));
  assert.equal(ask.status, "ask");
  assert.ok(ask.options.includes("🚫 以后都别推荐"));
  console.log(`✔ ask_user: ${ask.options.join(" / ")}`);

  const confirm = payload(await client.callTool({
    name: "confirm_skill",
    arguments: { skill_name: "captions-craft", user_choice: "✅ 使用" },
  }));
  assert.equal(confirm.status, "execute");
  assert.equal(confirm.skill.name, "captions-craft");
  console.log(`✔ confirm_skill: ${confirm.skill.name}`);

  const blacklisted = payload(await client.callTool({
    name: "confirm_skill",
    arguments: { skill_name: "captions-craft", user_choice: "🚫 以后都别推荐" },
  }));
  assert.equal(blacklisted.status, "blacklist");
  assert.ok(fs.existsSync(blacklisted.file), "blacklist file was not written");
  console.log(`✔ blacklist written: ${blacklisted.file}`);

  // The cached index must be invalidated and the new blacklist applied.
  const after = payload(await client.callTool({ name: "list_skills", arguments: {} }));
  assert.equal(after.skills.length, 1, "blacklisted skill still indexed");
  assert.equal(after.skills.some(s => s.name === "captions-craft"), false);
  console.log(`✔ blacklist applied on rescan: ${after.skills.length} skill left`);

  await client.close();
  console.log("\nMCP smoke test passed.");
} catch (err) {
  console.error(`✘ MCP smoke test failed: ${err.message}`);
  try { await client.close(); } catch (_) {}
  process.exitCode = 1;
} finally {
  fs.rmSync(fixture.home, { recursive: true, force: true });
  fs.rmSync(fixture.project, { recursive: true, force: true });
}
