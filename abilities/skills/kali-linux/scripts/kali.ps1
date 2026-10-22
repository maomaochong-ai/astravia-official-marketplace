# kali.ps1 - drive a local Kali Linux environment on Windows through WSL2.
#
# The WSL2 backend only. For the container backend on Windows, run scripts/kali.sh
# from Git Bash (it delegates its install step back to this file).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File kali.ps1 status
#   powershell -ExecutionPolicy Bypass -File kali.ps1 install
#   powershell -ExecutionPolicy Bypass -File kali.ps1 run "nmap -sV 192.168.64.7"
#   powershell -ExecutionPolicy Bypass -File kali.ps1 script   (reads stdin)
#   powershell -ExecutionPolicy Bypass -File kali.ps1 ensure nmap sqlmap
#   powershell -ExecutionPolicy Bypass -File kali.ps1 tools
#   powershell -ExecutionPolicy Bypass -File kali.ps1 stop
#
# Compatibility notes:
#   * The file is deliberately ASCII-only and contains no here-strings. Windows
#     PowerShell 5.1 decodes BOM-less files with the ANSI code page and is
#     unreliable about here-string terminators in files that use LF line endings,
#     so neither construct is used: multi-line text is built from arrays with
#     -join, which behaves the same in 5.1 and 7.x.
#   * .gitattributes pins *.ps1 to CRLF on checkout for the same reason.
#
# Environment:
#   KALI_WSL_DISTRO=kali-linux
#   KALI_STATE_DIR=%USERPROFILE%\.astravia-kali
#   KALI_TIMEOUT=300

$ErrorActionPreference = 'Stop'

$Distro    = if ($env:KALI_WSL_DISTRO) { $env:KALI_WSL_DISTRO } else { 'kali-linux' }
$StateDir  = if ($env:KALI_STATE_DIR) { $env:KALI_STATE_DIR } elseif ($env:USERPROFILE) { Join-Path $env:USERPROFILE '.astravia-kali' } else { Join-Path $HOME '.astravia-kali' }
$Timeout   = if ($env:KALI_TIMEOUT) { [int]$env:KALI_TIMEOUT } else { 300 }
$AuditLog  = Join-Path $StateDir 'audit.log'
$NewLine   = [Environment]::NewLine
$WorkDir   = (Get-Location).Path

function Write-Log { param([string]$Message) [Console]::Error.WriteLine($Message) }

function Fail {
  param([string]$Message, [int]$Code = 1)
  Write-Log "error: $Message"
  exit $Code
}


function Test-Admin {
  # WindowsIdentity is unavailable outside Windows; the WSL backend is Windows-only anyway.
  if ($env:OS -ne 'Windows_NT') { return $false }
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-DistroRegistered {
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return $false }
  try {
    $names = & wsl.exe -l -q 2>$null
    foreach ($name in $names) {
      $clean = ($name -replace "`0", '').Trim()
      if ($clean -eq $Distro) { return $true }
    }
  } catch { return $false }
  return $false
}

function Write-Audit {
  param([string]$Status, [string]$Command)
  try {
    if (-not (Test-Path $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    # One record per line: a multi-line script body would otherwise split the record
    # and break the tab-separated format the docs promise.
    $text = ($Command -replace "`r`n", '\n' -replace "`r", '\n' -replace "`n", '\n').Trim()
    Add-Content -Path $AuditLog -Value ("{0}`twsl`t{1}`t{2}" -f $stamp, $Status, $text)
  } catch { }
}

function Invoke-InKali {
  param([string]$Command)
  Write-Audit 'START' $Command
  $wrapped = "timeout $Timeout bash -lc " + "'" + ($Command -replace "'", "'\''") + "'"
  $code = 0
  try {
    & wsl.exe -d $Distro --cd (Get-Location).Path -- bash -lc $wrapped
    $code = $LASTEXITCODE
  } catch {
    Write-Log "error: $($_.Exception.Message)"
    $code = 1
  }
  Write-Audit "EXIT=$code" $Command
  exit $code
}

function Show-Status {
  $registered = Test-DistroRegistered
  $ready = $registered
  $version = ''
  $hint = ''
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    $hint = 'wsl.exe not found; this backend only exists on Windows'
  } elseif (-not $registered) {
    $hint = "WSL distribution $Distro is not registered; run 'kali.ps1 install' from an elevated PowerShell"
  } else {
    try {
      $version = (& wsl.exe -d $Distro -- sh -c '. /etc/os-release && printf "%s" "$PRETTY_NAME"' 2>$null | Out-String).Trim()
    } catch { $version = '' }
  }
  Write-Output 'backend=wsl'
  Write-Output "ready=$($ready.ToString().ToLower())"
  Write-Output "runtime=wsl:$Distro"
  Write-Output "container="
  Write-Output "image_present=$($registered.ToString().ToLower())"
  Write-Output "workdir=$((Get-Location).Path)"
  Write-Output "audit_log=$AuditLog"
  if ($version) { Write-Output "kali_version=$version" }
  if ($hint) { Write-Output "hint=$hint" }
}

function Install-Kali {
  if ($Distro -and (Test-DistroRegistered)) {
    Write-Log "WSL distribution $Distro is already registered; nothing to install"
    return
  }
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Fail 'wsl.exe not found. Enable the "Windows Subsystem for Linux" optional feature first, then re-run install.'
  }
  if (-not (Test-Admin)) {
    $message = @(
      'registering a WSL distribution needs an elevated PowerShell. Ask the user to run:',
      '',
      "  wsl --install --distribution $Distro --no-launch",
      "  wsl -d $Distro -u root -- apt-get update",
      "  wsl -d $Distro -u root -- apt-get install -y kali-linux-headless",
      '',
      "then re-run 'kali.ps1 status'."
    ) -join $NewLine
    Fail $message
  }
  Write-Log "installing the $Distro WSL distribution (this downloads a few hundred MB) ..."
  & wsl.exe --install --distribution $Distro --no-launch
  if ($LASTEXITCODE -ne 0) { Fail "wsl --install failed with exit code $LASTEXITCODE" }
  Write-Log 'initializing apt inside the new distribution ...'
  & wsl.exe -d $Distro -u root -- sh -c 'apt-get update -qq'
  Write-Log "Kali is ready. Re-run 'kali.ps1 status' to confirm."
}

function Ensure-Tools {
  param([string[]]$Tools)
  $map = @{
    'nc' = 'netcat-traditional'; 'netcat' = 'netcat-traditional'
    'msf' = 'metasploit-framework'; 'metasploit' = 'metasploit-framework'
    'seclists' = 'seclists'; 'wordlists' = 'seclists'
    'dig' = 'dnsutils'; 'nslookup' = 'dnsutils'
    'impacket' = 'python3-impacket'
  }
  if ($Tools.Count -eq 1 -and $Tools[0] -eq '--profile') {
    $packages = 'kali-linux-headless'
  } else {
    $packages = ($Tools | ForEach-Object { if ($map.ContainsKey($_)) { $map[$_] } else { $_ } }) -join ' '
  }
  Write-Log "ensuring: $packages"
  $body = @(
    'export DEBIAN_FRONTEND=noninteractive',
    "apt-get update -qq || { echo 'apt-get update failed' >&2; exit 1; }",
    "apt-get install -y --no-install-recommends $packages"
  ) -join $NewLine
  Invoke-InKali $body
}

function Show-Tools {
  $body = @(
    'for t in nmap masscan sqlmap hydra john hashcat nikto gobuster ffuf whatweb wpscan dirb dnsrecon whois smbclient msfconsole tshark tcpdump aircrack-ng binwalk foremost exiftool socat nc python3; do',
    '  if command -v "$t" >/dev/null 2>&1; then printf "%-16s %s\n" "$t" "$(command -v "$t")"; else printf "%-16s %s\n" "$t" "-"; fi',
    'done'
  ) -join $NewLine
  Invoke-InKali $body
}

# Same [PASS]/[FAIL] contract as kali.sh doctor (and the docx/xlsx skills).
# Probes never go through Invoke-InKali: a diagnosis must not write audit
# records, and it must not start the distribution as a side effect.
function Invoke-Probe {
  param([string]$Command)
  try {
    $out = & wsl.exe -d $Distro --cd $WorkDir -- bash -lc $Command 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($out | Out-String).Trim()
  } catch { return $null }
}

function Show-Doctor {
  $script:fails = 0
  $report = {
    param([string]$Mark, [string]$Label, [string]$Detail)
    if ($Mark -eq 'FAIL') { $script:fails++ }
    Write-Output ('[{0}] {1,-26} {2}' -f $Mark, $Label, $Detail)
  }
  $hasWsl = [bool](Get-Command wsl.exe -ErrorAction SilentlyContinue)

  & $report 'PASS' 'backend' 'wsl'
  if ($hasWsl) {
    & $report 'PASS' 'wsl.exe' ((Get-Command wsl.exe).Source)
  } else {
    & $report 'FAIL' 'wsl.exe' 'not found; enable the WSL optional feature, then reboot'
  }
  $registered = $false
  if ($hasWsl) { $registered = Test-DistroRegistered }
  if (-not $hasWsl) {
    # already reported
  } elseif ($registered) {
    & $report 'PASS' 'distribution' "$Distro registered"
  } else {
    & $report 'FAIL' 'distribution' "$Distro not registered; run 'kali.ps1 install' elevated"
  }

  $probeOk = $false
  if ($registered) { $probeOk = ($null -ne (Invoke-Probe 'true')) }
  if ($probeOk) {
    $writable = Invoke-Probe 'touch .kali-doctor && rm -f .kali-doctor && printf ok'
    if ($writable -eq 'ok') {
      & $report 'PASS' 'workdir' "$WorkDir writable inside Kali"
    } else {
      & $report 'FAIL' 'workdir' "$WorkDir not writable inside Kali"
    }
    $version = Invoke-Probe '. /etc/os-release 2>/dev/null && printf "%s" "$PRETTY_NAME"'
    & $report 'PASS' 'kali version' $(if ($version) { $version } else { 'unknown' })
    $missing = Invoke-Probe 'for t in nmap masscan sqlmap hydra john hashcat nikto gobuster ffuf whatweb wpscan dirb dnsrecon whois smbclient msfconsole tshark tcpdump aircrack-ng binwalk foremost exiftool socat nc python3; do command -v "$t" >/dev/null 2>&1 || printf "%s " "$t"; done'
    $total = 23
    $absent = 0
    if ($missing) { $absent = @($missing.Trim() -split '\s+' | Where-Object { $_ }).Count }
    if ($absent -eq 0) {
      & $report 'PASS' 'tools' "$total/$total key tools present"
    } else {
      & $report 'WARN' 'tools' "$($total - $absent)/$total present; missing $($missing.Trim())"
    }
  } else {
    & $report 'WARN' 'inside Kali' 'not runnable yet; checks that need the distribution were skipped'
  }

  try {
    $null = New-Item -ItemType Directory -Force -Path $StateDir -ErrorAction Stop
    & $report 'PASS' 'audit log' $AuditLog
  } catch {
    & $report 'FAIL' 'audit log' "$StateDir is not writable"
  }

  if ($script:fails -gt 0) {
    Write-Output ''
    Write-Output "NOT READY ($($script:fails) check(s) failed; see FAIL above)"
    exit 1
  }
  Write-Output ''
  Write-Output 'READY'
}

function Show-Usage {
  $text = @(
    'kali.ps1 - drive a local Kali Linux environment through WSL2',
    '',
    '  status               detect the WSL distribution and readiness (always exit 0)',
    '  doctor               the same checks as PASS/FAIL lines; exit 1 if a check fails',
    '  install              register and initialize the kali-linux distribution',
    '  run "<command>"      run one command inside Kali',
    '  script               run a script from stdin inside Kali',
    '  ensure <tool...>     apt-install tools (use --profile for the headless set)',
    '  tools                show which key tools are installed',
    '  stop                 terminate the distribution (state is kept)',
    '  reset                unregister the distribution (the audit log is kept)',
    '',
    'Docs: references/install.md, references/runbook.md, references/safety.md'
  ) -join $NewLine
  Write-Output $text
}

if ($args.Count -lt 1) { Show-Usage; exit 64 }
$action = $args[0]
$rest = @()
if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }

switch ($action) {
  'status'  { Show-Status }
  'doctor'  { Show-Doctor }
  'install' { Install-Kali }
  'run' {
    if ($rest.Count -lt 1) { Fail 'usage: kali.ps1 run "<command>"' }
    Invoke-InKali ($rest -join ' ')
  }
  'script' {
    $body = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($body)) { Fail 'no script on stdin' }
    Invoke-InKali $body
  }
  'ensure' {
    if ($rest.Count -lt 1) { Fail 'usage: kali.ps1 ensure <tool...> | --profile headless' }
    Ensure-Tools $rest
  }
  'tools'   { Show-Tools }
  'stop'    { & wsl.exe --terminate $Distro; Write-Log "distribution $Distro terminated (state kept)" }
  'reset'   {
    if (-not (Test-DistroRegistered)) { Write-Log "distribution $Distro is not registered; nothing to reset"; exit 0 }
    Write-Log "unregistering $Distro; the audit log in $StateDir is kept"
    & wsl.exe --unregister $Distro
    if ($LASTEXITCODE -ne 0) { Fail "wsl --unregister failed with exit code $LASTEXITCODE" }
    Write-Log "done; 'kali.ps1 install' recreates the distribution"
  }
  'help'    { Show-Usage }
  { $_ -in '-h', '--help' } { Show-Usage }
  default   { Fail "unknown command '$action' (try: kali.ps1 help)" }
}
