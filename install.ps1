# auto-selector-skill installer — delegates to the official Claude Code marketplace.
# Works both from a local clone and from `irm ... | iex`.
#
# Usage:
#   .\install.ps1
#   irm https://raw.githubusercontent.com/ffdgdfhhhh/auto-selector-skill/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Plugin = "auto-selector-skill"
$Repo = "ffdgdfhhhh/auto-selector-skill"

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Claude Code CLI not found." -ForegroundColor Red
    Write-Host "   Install Claude Code first: https://claude.ai/code"
    Write-Host "   Then run:"
    Write-Host "     claude plugin marketplace add $Repo"
    Write-Host "     claude plugin install $Plugin@$Plugin"
    throw "Claude Code CLI is required."
}

Write-Host "🔧 Installing $Plugin..." -ForegroundColor Cyan

& claude plugin marketplace add $Repo
if ($LASTEXITCODE -ne 0) { throw "marketplace add failed (exit $LASTEXITCODE)" }

& claude plugin install "$Plugin@$Plugin"
if ($LASTEXITCODE -ne 0) { throw "plugin install failed (exit $LASTEXITCODE)" }

Write-Host ""
Write-Host "🎉 $Plugin installed. Restart Claude Code to activate." -ForegroundColor Green
