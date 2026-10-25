# 用默认浏览器打开随包安装的图文介绍页。路径按脚本自身位置解析，不依赖当前目录。
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$skillDir = Split-Path -Parent $scriptDir
$page = Join-Path $skillDir 'assets/preview/index.html'

if (-not (Test-Path -LiteralPath $page)) {
    Write-Error "找不到介绍页：$page （请确认技能包完整，应包含 assets/preview/index.html）"
    exit 1
}

Write-Host "介绍页：$page"
Start-Process -FilePath $page
