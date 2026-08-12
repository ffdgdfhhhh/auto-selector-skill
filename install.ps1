# auto-selector-skill installer — PowerShell one-liner
# Usage: irm https://raw.githubusercontent.com/YOUR_USERNAME/auto-selector-skill/main/install.ps1 | iex
#
# What it does:
#   1. Downloads plugin to ~/.claude/plugins/cache/
#   2. Registers in installed_plugins.json
#   3. Done — restart Claude Code to activate

$ErrorActionPreference = "Stop"

$PluginName = "auto-selector-skill"
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$CacheDir = "$ClaudeDir\plugins\cache\$PluginName\$PluginName\latest"
$PluginsJson = "$ClaudeDir\plugins\installed_plugins.json"

Write-Host "🔧 Installing $PluginName..." -ForegroundColor Cyan

# 1. Create cache directory
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

# 2. Download from GitHub (if running as one-liner) or copy from local
$TempDir = "$env:TEMP\auto-selector-skill-install"
if (Test-Path "$PSScriptRoot\.claude-plugin") {
    # Running from local clone
    $SourceDir = $PSScriptRoot
} else {
    # Running as one-liner — download
    Write-Host "📥 Downloading from GitHub..." -ForegroundColor Yellow
    if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
    git clone --depth 1 https://github.com/YOUR_USERNAME/auto-selector-skill.git $TempDir 2>$null
    $SourceDir = $TempDir
}

# Copy files
Copy-Item -Recurse -Force "$SourceDir\.claude-plugin" "$CacheDir\"
Copy-Item -Recurse -Force "$SourceDir\.github" "$CacheDir\"
Copy-Item -Recurse -Force "$SourceDir\plugins" "$CacheDir\"
Copy-Item -Recurse -Force "$SourceDir\src" "$CacheDir\"
Copy-Item -Force "$SourceDir\package.json" "$CacheDir\"
Copy-Item -Force "$SourceDir\README.md" "$CacheDir\"

Write-Host "📁 Copied to $CacheDir" -ForegroundColor Green

# 3. Register in installed_plugins.json
$PluginsDir = Split-Path $PluginsJson
if (-not (Test-Path $PluginsDir)) {
    New-Item -ItemType Directory -Force -Path $PluginsDir | Out-Null
}

if (-not (Test-Path $PluginsJson)) {
    # Create new file
    @{
        version = 2
        plugins = @{
            "$PluginName@$PluginName" = @(
                @{
                    scope = "user"
                    installPath = $CacheDir
                    version = "latest"
                    installedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")
                    lastUpdated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")
                }
            )
        }
    } | ConvertTo-Json -Depth 10 | Set-Content -Path $PluginsJson -Encoding UTF8
    Write-Host "✅ Created installed_plugins.json" -ForegroundColor Green
} else {
    $data = Get-Content $PluginsJson -Raw | ConvertFrom-Json
    $key = "$PluginName@$PluginName"
    if ($data.plugins.PSObject.Properties.Name -contains $key) {
        Write-Host "✅ Already registered" -ForegroundColor Green
    } else {
        $entry = @(
            @{
                scope = "user"
                installPath = $CacheDir
                version = "latest"
                installedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")
                lastUpdated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")
            }
        )
        $data.plugins | Add-Member -NotePropertyName $key -NotePropertyValue $entry
        $data | ConvertTo-Json -Depth 10 | Set-Content -Path $PluginsJson -Encoding UTF8
        Write-Host "✅ Registered in installed_plugins.json" -ForegroundColor Green
    }
}

# Cleanup
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }

Write-Host ""
Write-Host "🎉 $PluginName installed successfully!" -ForegroundColor Green
Write-Host "   Restart Claude Code to activate." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Quick test: open a new Claude Code session and type 'skills'" -ForegroundColor Cyan
