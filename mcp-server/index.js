#!/usr/bin/env node
// auto-selector-skill MCP server.
// Shares the scanner, enablement filter, and index schema with the
// Claude Code hooks. Matching here is a deterministic lexical fallback;
// Claude Code uses semantic matching.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const rootPkg = require(path.join(root, "package.json"));

const {
  scanSkills,
  groupSkills,
  readBlacklist,
  isBlacklisted,
  getHome,
  blacklistPath,
  writeJsonAtomic,
} = require(path.join(root, "src", "lib", "scan.js"));
const { rankSkills } = require(path.join(root, "src", "lib", "match.js"));

let state = {
  skills: [],
  categoryOf: new Map(),
  stats: null,
  root: null,
  projectDir: null,
  categoryOverrides: {},
};

function buildIndex(projectRoot) {
  const {
    skills,
    stats,
    projectDir: scannedProjectDir,
    categoryOverrides,
  } = scanSkills({ projectDir: projectRoot });
  const blacklist = readBlacklist();
  const visible = blacklist.length
    ? skills.filter(s => !isBlacklisted(s, blacklist))
    : skills;

  const categoryOf = new Map();
  for (const [category, list] of groupSkills(visible, scannedProjectDir, categoryOverrides)) {
    for (const skill of list) categoryOf.set(skill.name, category);
  }

  state = {
    skills: visible,
    categoryOf,
    stats,
    root: projectRoot,
    projectDir: scannedProjectDir,
    categoryOverrides,
  };
  return state;
}

function ensureIndex(projectRoot) {
  if (state.skills.length === 0) return buildIndex(projectRoot || process.cwd());
  return state;
}

function toJson(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer(
  {
    name: "auto-selector-skill",
    version: rootPkg.version,
  },
  {
    capabilities: { tools: {} },
    instructions:
      "Skill router. Call scan_skills once, then match_skill for each user request. " +
      "If a match is relevant, ask the user before executing it.",
  }
);

server.registerTool(
  "scan_skills",
  {
    description:
      "Scan installed skills (enabled plugins + local + project). Rebuilds the index and returns categories with counts.",
    inputSchema: {
      project_root: z
        .string()
        .optional()
        .describe("Project root. Defaults to the server's current directory."),
    },
  },
  async ({ project_root }) => {
    const s = buildIndex(project_root || process.cwd());
    const categories = [...groupSkills(s.skills, s.projectDir, s.categoryOverrides)].map(([name, list]) => ({
      name,
      count: list.length,
      skills: list.map(x => x.name),
    }));
    return toJson({
      status: "ok",
      totalSkills: s.skills.length,
      categories,
      stats: s.stats,
    });
  }
);

server.registerTool(
  "match_skill",
  {
    description:
      "Rank skills for a request. Lexical fallback used by non-Claude hosts; returns top matches with scores.",
    inputSchema: {
      message: z.string().describe("The user's request"),
      limit: z.number().int().min(1).max(10).optional().describe("Max matches (default 5)"),
    },
  },
  async ({ message, limit }) => {
    const s = ensureIndex();
    const matches = rankSkills(message, s.skills, {
      limit: limit || 5,
      categoryFor: skill => s.categoryOf.get(skill.name) || "",
    });

    return toJson({
      status: "ok",
      query: message,
      matches,
      note: "Lexical fallback. Claude Code performs semantic matching instead.",
    });
  }
);

server.registerTool(
  "list_skills",
  {
    description: "List every indexed skill with its category.",
    inputSchema: {},
  },
  async () => {
    const s = ensureIndex();
    return toJson({
      status: "ok",
      totalSkills: s.skills.length,
      skills: s.skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        category: s.categoryOf.get(skill.name) || "",
        source: skill.source,
      })),
    });
  }
);

server.registerTool(
  "ask_user",
  {
    description:
      "Present a confirmation question for a recommended skill. The host shows the options, then calls confirm_skill.",
    inputSchema: {
      skill_name: z.string(),
      skill_description: z.string(),
      options: z.array(z.string()).optional(),
    },
  },
  async ({ skill_name, skill_description, options }) => {
    const opts = options || ["✅ 使用", "❌ 这次不用", "🚫 以后都别推荐"];
    return toJson({
      status: "ask",
      question: `推荐用 ${skill_name}：${skill_description}。要用吗？`,
      options: opts,
      instruction: "展示选项，等待用户选择后调用 confirm_skill。",
    });
  }
);

server.registerTool(
  "confirm_skill",
  {
    description: "Resolve the user's choice after ask_user.",
    inputSchema: {
      skill_name: z.string(),
      user_choice: z.string().describe("use | skip | blacklist"),
    },
  },
  async ({ skill_name, user_choice }) => {
    const choice = String(user_choice || "").trim().toLowerCase();
    const isSkip = ["skip", "2", "❌ 这次不用", "这次不用"].includes(choice);
    const isBlacklist = ["blacklist", "3", "🚫 以后都别推荐", "以后都别推荐"].includes(choice);
    const isUse = ["use", "1", "✅ 使用", "使用"].includes(choice);

    if (isSkip) {
      return toJson({ status: "skipped", message: "跳过本次推荐。" });
    }

    if (isBlacklist) {
      const file = blacklistPath(getHome());
      const list = readBlacklist();
      if (!list.some(x => x.toLowerCase() === skill_name.toLowerCase())) {
        writeJsonAtomic(file, [...list, skill_name]);
      }
      // Invalidate the cached index so the next call rescans and filters it.
      state = {
        skills: [],
        categoryOf: new Map(),
        stats: null,
        root: null,
        projectDir: null,
        categoryOverrides: {},
      };
      return toJson({
        status: "blacklist",
        skill: skill_name,
        file,
        message: `${skill_name} 已加入黑名单，后续不再推荐。`,
      });
    }

    if (!isUse) {
      return toJson({
        status: "error",
        message: `Unrecognized choice "${user_choice}". Use use / skip / blacklist or the option label.`,
      });
    }

    const s = ensureIndex();
    const skill = s.skills.find(x => x.name === skill_name);
    if (!skill) {
      return toJson({ status: "error", message: `Skill '${skill_name}' not in index.` });
    }

    return toJson({
      status: "execute",
      skill: {
        name: skill.name,
        description: skill.description,
        category: s.categoryOf.get(skill.name) || "",
        source: skill.source,
        path: skill.path || null,
        identifier: skill.identifier,
      },
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("auto-selector-skill MCP server running on stdio");
