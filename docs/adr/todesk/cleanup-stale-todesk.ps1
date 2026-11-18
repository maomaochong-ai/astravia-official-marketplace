param(
	[switch]$Apply,
	[string]$Package = "D:\open-source-projects\astravia-official-marketplace\abilities\plugins\todesk\release\todesk-0.4.8.astraviapkg"
)

$ErrorActionPreference = "Stop"
$root   = Join-Path $env:USERPROFILE ".astravia"
$ledger = Join-Path $root "plugins-manifest.json"
$plugs  = Join-Path $root "plugins\todesk"
$data   = Join-Path $root "plugin-data\todesk"

$entry = $null
if (Test-Path $ledger) {
	$json = (Get-Content $ledger -Raw).TrimStart([char]0xFEFF)
	$entry = ($json | ConvertFrom-Json).todesk
}

if ($entry) {
	"manifest: version=$($entry.version) active=$($entry.activeVersion) enabled=$($entry.enabled) commands=$($entry.grantedCommandNames -join ',')"
} else {
	"manifest: todesk NOT present (uninstalled)"
}

if (Test-Path $plugs\versions) {
	"versions on disk: " + ((Get-ChildItem $plugs\versions -Directory | ForEach-Object Name) -join ", ")
} else {
	"versions on disk: (none)"
}

if (Test-Path $data) {
	"plugin-data: $((Get-ChildItem $data -Recurse -File).Count) file(s)"
} else {
	"plugin-data: (none)"
}

$stale = @()
if (Test-Path $plugs\versions) {
	$active = if ($entry) { $entry.activeVersion } else { $null }
	$stale = Get-ChildItem $plugs\versions -Directory | Where-Object { $_.Name -ne $active }
	"stale version dirs: " + $(if ($stale) { ($stale | ForEach-Object Name) -join ", " } else { "none" })
}

if (-not $Apply) {
	""
	"dry run only. re-run with -Apply to clean."
	exit 0
}

foreach ($dir in $stale) {
	Remove-Item -Recurse -Force $dir.FullName
	"removed $($dir.FullName)"
}

if (-not $entry) {
	if (Test-Path $data) { Remove-Item -Recurse -Force $data; "removed $data" }
	if (Test-Path $plugs) {
		$left = Get-ChildItem $plugs -Recurse -File -ErrorAction SilentlyContinue
		if (-not $left) { Remove-Item -Recurse -Force $plugs; "removed empty $plugs" }
	}
}

""
"next: install from the marketplace (Found tab) or run:"
"  astravia action run plugins.manage ""{`"operation`":`"install-from-path`",`"path`":`"$($Package -replace '\\','/')`",`"enable`":true,`"source`":`"archive`"}"""
"then reload the Astravia window once."
