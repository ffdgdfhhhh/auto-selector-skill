#!/usr/bin/env node
// auto-selector-skill MCP Server
// Provides intelligent skill routing for any MCP-compatible AI assistant

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const fs = require("fs");
const path = require("path");

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

  // Scan .cursorrules, .windsurfrules, .clinerules for custom rules
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

  // Scan MCP tools directory if exists
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
const server = new Server(
  {
    name: "auto-selector-skill",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "scan_skills",
        description:
          "Scan project for available skills, tools, and plugins. Call this first to build the skill index.",
        inputSchema: {
          type: "object",
          properties: {
            project_root: {
              type: "string",
              description:
                "Project root directory path. Defaults to current directory.",
            },
          },
        },
      },
      {
        name: "match_skill",
        description:
          "Match a user request against the skill index. Returns matching skills sorted by relevance.",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The user's request or message to match against",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "list_skills",
        description: "List all registered skills in the index.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "scan_skills": {
      const projectRoot = args.project_root || process.cwd();
      skillIndex = scanProjectSkills(projectRoot);
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

    case "match_skill": {
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

      const matches = matchSkills(args.message);
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

    case "list_skills": {
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

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// Start server
async function main() {
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("auto-selector-skill MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
