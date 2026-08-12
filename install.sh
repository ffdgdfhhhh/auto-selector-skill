#!/bin/bash
# auto-selector-skill installer — one command setup
# Usage: bash install.sh
#
# What it does:
#   1. Copies plugin to ~/.claude/plugins/cache/
#   2. Registers in installed_plugins.json
#   3. Done — restart Claude Code to activate

set -e

# Check Node.js is available (required for JSON handling)
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required but not installed."
  echo "   Install it from https://nodejs.org/ (version 18+)"
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_NAME="auto-selector-skill"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CACHE_DIR="$CLAUDE_DIR/plugins/cache/$PLUGIN_NAME/$PLUGIN_NAME/latest"
PLUGINS_JSON="$CLAUDE_DIR/plugins/installed_plugins.json"

echo "🔧 Installing $PLUGIN_NAME..."

# 1. Create cache directory
mkdir -p "$CACHE_DIR"

# 2. Copy files
cp -r "$REPO_DIR"/.claude-plugin "$CACHE_DIR/"
cp -r "$REPO_DIR"/.github "$CACHE_DIR/"
cp -r "$REPO_DIR"/plugins "$CACHE_DIR/"
cp -r "$REPO_DIR"/src "$CACHE_DIR/"
cp "$REPO_DIR"/package.json "$CACHE_DIR/"
cp "$REPO_DIR"/README.md "$CACHE_DIR/"

echo "📁 Copied to $CACHE_DIR"

# 3. Register in installed_plugins.json
mkdir -p "$(dirname "$PLUGINS_JSON")"

if [ ! -f "$PLUGINS_JSON" ]; then
  # Create new file using node (handles paths with special chars)
  node -e "
    const fs = require('fs');
    const path = require('path');
    const pluginsDir = path.dirname('$PLUGINS_JSON');
    fs.mkdirSync(pluginsDir, {recursive: true});
    const data = {
      version: 2,
      plugins: {
        '$PLUGIN_NAME@$PLUGIN_NAME': [{
          scope: 'user',
          installPath: '$CACHE_DIR',
          version: 'latest',
          installedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }]
      }
    };
    fs.writeFileSync('$PLUGINS_JSON', JSON.stringify(data, null, 2) + '\n');
  "
  echo "✅ Created installed_plugins.json"
else
  # Check if already registered
  if grep -q "$PLUGIN_NAME@$PLUGIN_NAME" "$PLUGINS_JSON" 2>/dev/null; then
    echo "✅ Already registered in installed_plugins.json"
  else
    # Add entry using node (handles JSON properly)
    node -e "
      const fs = require('fs');
      const data = JSON.parse(fs.readFileSync('$PLUGINS_JSON', 'utf8'));
      data.plugins['$PLUGIN_NAME@$PLUGIN_NAME'] = [{
        scope: 'user',
        installPath: '$CACHE_DIR',
        version: 'latest',
        installedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }];
      fs.writeFileSync('$PLUGINS_JSON', JSON.stringify(data, null, 2) + '\n');
    "
    echo "✅ Registered in installed_plugins.json"
  fi
fi

echo ""
echo "🎉 $PLUGIN_NAME installed successfully!"
echo "   Restart Claude Code to activate."
echo ""
echo "   Quick test: open a new Claude Code session and type 'skills'"
