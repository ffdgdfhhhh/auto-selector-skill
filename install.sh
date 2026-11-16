#!/bin/bash
# auto-selector-skill installer — delegates to the official Claude Code marketplace.
# Works both from a local clone and from `curl ... | bash`.
#
# Usage:
#   bash install.sh
#   curl -fsSL https://raw.githubusercontent.com/ffdgdfhhhh/auto-selector-skill/main/install.sh | bash

set -euo pipefail

PLUGIN="auto-selector-skill"
REPO="ffdgdfhhhh/auto-selector-skill"

if ! command -v claude >/dev/null 2>&1; then
  echo "❌ Claude Code CLI not found."
  echo "   Install Claude Code first: https://claude.ai/code"
  echo "   Then run:"
  echo "     claude plugin marketplace add $REPO"
  echo "     claude plugin install $PLUGIN@$PLUGIN"
  exit 1
fi

echo "🔧 Installing $PLUGIN..."
claude plugin marketplace add "$REPO"
claude plugin install "$PLUGIN@$PLUGIN"

echo ""
echo "🎉 $PLUGIN installed. Restart Claude Code to activate."
