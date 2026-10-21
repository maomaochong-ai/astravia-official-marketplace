#v1.0 2026.10.21
# Install or repair ego lite on Windows and open it once installed.
# Drop-in counterpart to install.sh on macOS.
<#
.SYNOPSIS
  Install or repair the ego lite Windows app, then open it.
.DESCRIPTION
  Downloads the ego lite Windows installer (x64) from the official CDN, runs it
  silently, waits until the ego-browser command is on PATH, and launches the app.
  If ego lite is already installed, it just opens the app.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/install.ps1
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Official Windows installer. The macOS side uses a .dmg; Windows uses this
# Squirrel-based setup .exe. Keep architecture fixed to x64 (no arm64 build yet).
$ExeUrl = "https://cdn.ego.app/setup/windows/x64/egoliteSetup-Y7MbxKIuhzFB.exe"
$ExeOut  = Join-Path $env:TEMP "egolite-setup.exe"

$AppDisplayName = "ego lite"
$BrowserCmdName = "ego-browser"

# Common locations where a Squirrel-packaged Electron app exposes its launcher.
# We probe these before and after install to decide whether ego lite is present.
$SearchDirs = @(
  (Join-Path $env:LOCALAPPDATA "$AppDisplayName"),
  (Join-Path $env:ProgramFiles "$AppDisplayName")
)

function Write-Log { Write-Host $args -ForegroundColor Cyan }

function Find-EgoBrowser {
    # Returns the absolute path of the ego-browser launcher (exe, cmd, shim) if
    # it can be found on the current PATH or under known install roots.
    $cmd = Get-Command $BrowserCmdName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($dir in $SearchDirs) {
        if (-not (Test-Path $dir)) { continue }
        $hit = Get-ChildItem -Path $dir -Recurse -Filter "$BrowserCmdName*" -File -ErrorAction SilentlyContinue |
               Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return $null
}

function Test-EgoLiteInstalled {
    # "Installed" means the launcher command is reachable so the Agent can drive it.
    return [bool](Find-EgoBrowser)
}

function Download-Installer {
    Write-Log "Downloading $AppDisplayName installer from $ExeUrl ..."
    $oldProgressPreference = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    try {
        Invoke-WebRequest -Uri $ExeUrl -OutFile $ExeOut -UseBasicParsing
    } finally {
        $ProgressPreference = $oldProgressPreference
    }
    if (-not (Test-Path $ExeOut) -or (Get-Item $ExeOut).Length -lt 1MB) {
        throw "Download failed or produced an empty installer: $ExeOut"
    }
    Write-Log "Downloaded installer ($([math]::Round((Get-Item $ExeOut).Length/1MB,1)) MB)."
}

function Install-EgoLite {
    if (-not (Test-Path $ExeOut)) { Download-Installer }

    Write-Log "Running installer silently ..."

    # Squirrel / Omaha-style Electron installer: scheduling the binary to run and
    # exiting immediately installs to %LOCALAPPDATA%\ego lite under Current.
    # It registers ego-browser on the user PATH; only processes started afterwards
    # see the new PATH, so we re-derive PATH ourselves after waiting.
    $p = Start-Process -FilePath $ExeOut -PassThru
    if (-not $p.WaitForExit(300000)) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        throw "Installer did not finish within 5 minutes; aborting."
    }

    # Squirrel defers installation to a spawned child process; give it time to
    # finish even after the parent setup.exe returned.
    $deadline = (Get-Date).AddMinutes(5)
    while (-not (Test-EgoLiteInstalled) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
    }
}

function Ensure-PathForEgoBrowser {
    # The launcher dir may be missing from the current session's PATH (only newly
    # started processes inherit it). Poke the install dir into the session PATH so
    # downstream checks work in this same shell.
    $bin = Find-EgoBrowser
    if (-not $bin) { return }
    $dir = Split-Path $bin -Parent
    if ($env:PATH -notlike "*$dir*") {
        $env:PATH = "$dir;$env:PATH"
    }
}

function Open-App {
    # Launch the app through the launcher Squirrel places on PATH (and under
    # %LOCALAPPDATA%\ego lite\Current). Avoid guessing the shell AUMID, which
    # varies by package identity and only resolves after first launch.
    Write-Log "Launching $AppDisplayName ..."
    $bin = Find-EgoBrowser
    if ($bin) {
        if ($bin -match '\.exe$') {
            Start-Process -FilePath $bin -ArgumentList "" -ErrorAction SilentlyContinue
        } else {
            # A .cmd/.bat shim or other launcher: run via cmd so Start-Process
            # can locate an executable host.
            Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$bin`"" -ErrorAction SilentlyContinue
        }
    } else {
        # Last resort: ask the user to open it from the Start menu.
        Write-Host " $AppDisplayName launcher not found; open it from the Start menu and complete onboarding." -ForegroundColor Yellow
    }
}

# --- main --------------------------------------------------------------

if (-not (Test-EgoLiteInstalled)) {
    Install-EgoLite
} else {
    Write-Log "$AppDisplayName is already installed."
}

Ensure-PathForEgoBrowser

$ok = Test-EgoLiteInstalled
if (-not $ok) {
    Write-Host "`n$BrowserCmdName was not found after install. If this is a fresh install, best-effort install already ran; open $AppDisplayName once and complete onboarding, then reopen a terminal and retry this script." -ForegroundColor Yellow
} else {
    Write-Host "`n$BrowserCmdName is ready: $(Find-EgoBrowser)" -ForegroundColor Green
    Open-App
}