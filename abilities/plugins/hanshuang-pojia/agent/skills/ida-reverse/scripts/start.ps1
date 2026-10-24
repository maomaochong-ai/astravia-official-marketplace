<#
.SYNOPSIS
Start IDA Pro MCP HTTP server (background, non-blocking)

.DESCRIPTION
1. Kill old process
2. Start idalib-mcp HTTP server as a background process (stdout/stderr -> local log)
3. Wait for service ready (max 15 seconds)
4. Output result

Usage: run without parameters
#>

# Auto-detect IDA install and idalib-mcp
$idaCandidates = @(
    $env:IDADIR
    "C:\Program Files\IDA Professional 9.3"
    "C:\Program Files\IDA Professional 9.2"
    "C:\Program Files\IDA Professional 9.1"
    "C:\Program Files\IDA Pro 9.0"
    "D:\APP\IDA"
    "C:\IDA"
) | Where-Object { $_ }
foreach ($c in $idaCandidates) {
    if ($c -and (Test-Path $c)) { $env:IDADIR = $c; break }
}

$Port = 13337
$serverCandidates = @(
    (Get-Command idalib-mcp -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
    (Join-Path $env:APPDATA 'Python\Python314\Scripts\idalib-mcp.exe')
    (Join-Path $env:APPDATA 'Python\Python313\Scripts\idalib-mcp.exe')
    (Join-Path $env:APPDATA 'Python\Python312\Scripts\idalib-mcp.exe')
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\Scripts\idalib-mcp.exe')
) | Where-Object { $_ }
$ServerPath = $null
foreach ($c in $serverCandidates) {
    if ($c -and (Test-Path $c)) { $ServerPath = $c; break }
}
if (-not $ServerPath) {
    Write-Output "ERR:idalib-mcp_not_found"
    exit 1
}
if (-not $env:IDADIR -or -not (Test-Path $env:IDADIR)) {
    Write-Output "ERR:IDADIR_not_found"
    exit 1
}

# 清理旧进程（连同 worker 子进程）
$old = Get-Process -Name "idalib-mcp" -ErrorAction SilentlyContinue
if ($old) { $old | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep 2 }

# 后台启动：最小化窗口，输出重定向到日志文件
$LogDir = Join-Path $env:TEMP 'idalib-mcp'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Start-Process -FilePath $ServerPath -WindowStyle Minimized `
    -ArgumentList "--host 127.0.0.1 --port $Port" `
    -RedirectStandardOutput (Join-Path $LogDir 'stdout.log') `
    -RedirectStandardError (Join-Path $LogDir 'stderr.log')

# 等待就绪
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-RestMethod "http://127.0.0.1:$Port/mcp" -Method Post `
            -Body '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' `
            -ContentType "application/json" -ErrorAction Stop
        if ($r.result.tools.Count -gt 0) {
            Write-Output "OK:$($r.result.tools.Count)"
            $ready = $true
            break
        }
    } catch {}
}
if (-not $ready) {
    Write-Output "ERR:timeout"
}