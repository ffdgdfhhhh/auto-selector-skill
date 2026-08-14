#!/usr/bin/env node
// auto-selector-skill MCP Server
// Provides intelligent skill routing for any MCP-compatible AI assistant

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

// Skill registry — loaded from config or scanned from project
let skillIndex = [];

// Load skills from project directory
function scanProjectSkills(projectRoot) {
  const skills = [];

  // Scan package.json scripts
  const pkgPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.scripts) {
        for (const [name, cmd] of Object.entries(pkg.scripts)) {
          skills.push({
            name: `npm:${name}`,
            description: `Run npm script: ${cmd}`,
            keywords: [name, "npm", "script"],
            type: "npm-script",
            command: `npm run ${name}`,
          });
        }
      }
    } catch (e) {}
  }

  // Scan rule files
  const ruleFiles = [
    ".cursorrules",
    ".windsurfrules",
    ".clinerules",
    ".github/copilot-instructions.md",
  ];
  for (const file of ruleFiles) {
    const rulePath = path.join(projectRoot, file);
    if (fs.existsSync(rulePath)) {
      skills.push({
        name: `rule:${file}`,
        description: `Project rules from ${file}`,
        keywords: [file.replace(".", ""), "rules"],
        type: "rule-file",
        path: rulePath,
      });
    }
  }

  // Scan .tools directory if exists
  const toolsDir = path.join(projectRoot, ".tools");
  if (fs.existsSync(toolsDir)) {
    try {
      const files = fs.readdirSync(toolsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const tool = JSON.parse(
              fs.readFileSync(path.join(toolsDir, file), "utf8")
            );
            skills.push({
              name: tool.name || file.replace(".json", ""),
              description: tool.description || `Tool from ${file}`,
              keywords: tool.keywords || [file.replace(".json", "")],
              type: "custom-tool",
              config: tool,
            });
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  return skills;
}

// Match user request against skill index
function matchSkills(userMessage) {
  const msg = userMessage.toLowerCase();
  const matches = [];

  for (const skill of skillIndex) {
    const score = skill.keywords.reduce((acc, keyword) => {
      return acc + (msg.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);

    if (score > 0) {
      matches.push({ ...skill, score });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// Create MCP server
const server = new McpServer(
  {
    name: "auto-selector-skill",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
    instructions:
      "Provides intelligent skill routing. Use scan_skills first, then match_skill to find relevant skills for user requests.",
  }
);

// Tool: scan_skills
server.registerTool(
  "scan_skills",
  {
    description:
      "Scan project for available skills, tools, and plugins. Call this first to build the skill index.",
    inputSchema: {
      project_root: z
        .string()
        .optional()
        .describe("Project root directory path. Defaults to current directory."),
    },
  },
  async ({ project_root }) => {
    const root = project_root || process.cwd();
    skillIndex = scanProjectSkills(root);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "ok",
              count: skillIndex.length,
              skills: skillIndex.map((s) => ({
                name: s.name,
                description: s.description,
                type: s.type,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool: match_skill
server.registerTool(
  "match_skill",
  {
    description:
      "Match a user request against the skill index. Returns matching skills sorted by relevance.",
    inputSchema: {
      message: z.string().describe("The user's request or message to match against"),
    },
  },
  async ({ message }) => {
    if (skillIndex.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "error",
              message:
                "No skills scanned yet. Call scan_skills first to build the index.",
            }),
          },
        ],
      };
    }

    const matches = matchSkills(message);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "ok",
              matches: matches.map((m) => ({
                name: m.name,
                description: m.description,
                score: m.score,
                type: m.type,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool: list_skills
server.registerTool(
  "list_skills",
  {
    description: "List all registered skills in the index.",
    inputSchema: {},
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "ok",
              skills: skillIndex.map((s) => ({
                name: s.name,
                description: s.description,
                keywords: s.keywords,
                type: s.type,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool: ask_user (text-based confirmation for non-Claude Code platforms)
server.registerTool(
  "ask_user",
  {
    description:
      "Ask the user to confirm before running a skill. Returns the user's choice. Use this after match_skill finds a relevant skill.",
    inputSchema: {
      skill_name: z.string().describe("Name of the recommended skill"),
      skill_description: z.string().describe("What the skill does"),
      options: z
        .array(z.string())
        .optional()
        .describe("Custom options. Defaults to ['✅ 使用', '❌ 不用']"),
    },
  },
  async ({ skill_name, skill_description, options }) => {
    const opts = options || ["✅ 使用", "❌ 不用"];
    const formatted = opts.map((o, i) => `${i + 1}. ${o}`).join("\n");

    // Return the question — the AI platform will present it to the user
    // and call this tool again with the user's answer
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "ask",
              question: `推荐使用 ${skill_name} — ${skill_description}`,
              options: opts,
              instruction: `请向用户展示以上选项，等待用户选择后调用 confirm_skill 工具传入用户的选择。`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool: confirm_skill — execute after user confirms
server.registerTool(
  "confirm_skill",
  {
    description:
      "Confirm and execute a skill. Call this after the user confirms they want to use a skill.",
    inputSchema: {
      skill_name: z.string().describe("Name of the skill to execute"),
      user_choice: z
        .string()
        .describe("User's choice: 'use' to execute, 'skip' to skip"),
    },
  },
  async ({ skill_name, user_choice }) => {
    if (user_choice === "skip" || user_choice === "2") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "skipped",
              message: "用户跳过了 skill，直接回答。",
            }),
          },
        ],
      };
    }

    // Find the skill
    const skill = skillIndex.find((s) => s.name === skill_name);
    if (!skill) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: `Skill '${skill_name}' not found in index.`,
            }),
          },
        ],
      };
    }

    // For npm scripts, return the command to run
    if (skill.type === "npm-script") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "execute",
              type: "npm-script",
              command: skill.command,
              message: `请执行命令: ${skill.command}`,
            }),
          },
        ],
      };
    }

    // For rule files, return the path to read
    if (skill.type === "rule-file") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "execute",
              type: "rule-file",
              path: skill.path,
              message: `请读取规则文件: ${skill.path} 并按其中的指令执行。`,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "execute",
            skill: skill,
            message: `请执行 skill: ${skill_name}`,
          }),
        },
      ],
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("auto-selector-skill MCP server running on stdio");
