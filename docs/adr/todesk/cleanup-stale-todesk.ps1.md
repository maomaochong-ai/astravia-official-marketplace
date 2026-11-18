# 清掉 todesk 0.3.0 的残留状态，并装上当前版本

0.3.0 的报错是**旧激活遗留下来的**：插件已经从清单和磁盘上消失，但某个 Astravia
窗口还挂着 0.3.0 的渲染模块，于是右下角反复弹
`ToDesk.exe not found … astravia-plugin://todesk/versions/0.3.0/…`。

这个脚本做三件事，每步都先看清再动手，并可单独跳过：

1. 列出宿主里与 todesk 有关的残留（清单条目、版本目录、插件私有存储、插件市场缓存）；
2. 删除**已无清单条目**的版本目录与私有存储（只删 todesk，不动别的插件）；
3. 打印重新安装与刷新窗口的确切命令。

```powershell
param(
	[switch]$Apply,          # 不带就只体检；带 -Apply 才真的删
	[string]$Package = "D:\open-source-projects\astravia-official-marketplace\abilities\plugins\todesk\release\todesk-0.4.8.astraviapkg"
)

$ErrorActionPreference = "Stop"
$root    = Join-Path $env:USERPROFILE ".astravia"
$ledger  = Join-Path $root "plugins-manifest.json"
$plugs   = Join-Path $root "plugins\todesk"
$data    = Join-Path $root "plugin-data\todesk"

function Read-Ledger {
	$json = Get-Content $ledger -Raw
	$json.TrimStart([char]0xFEFF) | ConvertFrom-Json
}

$entry = (Read-Ledger).todesk
"清单条目：" + $(if ($entry) { "存在 version=$($entry.version) active=$($entry.activeVersion) enabled=$($entry.enabled)" } else { "不存在（插件已被卸载）" })
"版本目录：" + $(if (Test-Path $plugs) { (Get-ChildItem $plugs\versions -Directory | ForEach-Object Name) -join ", " } else { "不存在" })
"私有存储：" + $(if (Test-Path $data) { "存在（$((Get-ChildItem $data -Recurse -File).Count) 个文件）" } else { "不存在" })

$staleVersions = @()
if (Test-Path $plugs\versions) {
	$staleVersions = Get-ChildItem $plugs\versions -Directory | Where-Object { $_.Name -ne $entry.activeVersion }
	"待清理版本目录：" + $(if ($staleVersions) { ($staleVersions | ForEach-Object Name) -join ", " } else { "无" })
}

if (-not $Apply) {
	"`n（只体检，未改动。加 -Apply 执行清理。）"
	return
}

foreach ($dir in $staleVersions) {
	Remove-Item -Recurse -Force $dir.FullName
	"已删除 $($dir.FullName)"
}

if (-not $entry) {
	# 没有清单条目 = 插件已卸载，私有存储也一起收掉，避免旧状态被下一次安装继承。
	if (Test-Path $data) { Remove-Item -Recurse -Force $data; "已删除 $data" }
	if (Test-Path $plugs) {
		$left = Get-ChildItem $plugs -Recurse -File -ErrorAction SilentlyContinue
		if (-not $left) { Remove-Item -Recurse -Force $plugs; "已删除空目录 $plugs" }
	}
}

"`n下一步（二选一）："
"  1) 在 Astravia 里：能力 → 市场源 → 刷新 → 发现 → ToDesk → 安装（一次勾齐权限与 ToDesk.exe 命令）"
"  2) 命令行：astravia action run plugins.manage '<install-from-path 的 JSON，path=$Package>'"
"`n装完重启一次 Astravia，右下角那条 0.3.0 的报错就会消失（它是旧窗口里的模块在报错）。"
```

## 为什么必须重启一次

`astravia-plugin://todesk/versions/0.3.0/dist/assets/index-DyfSJO6F.js` 这个 URL 已经
指向不存在的文件：0.3.0 目录被删了，但那个窗口的渲染进程还拿着旧模块，于是每次
重新挂载都会再抛一次。清理磁盘不会让**正在运行**的进程忘记它——只有刷新/重启窗口
才会。

## 之后怎么确认装对了

```powershell
astravia action run plugins.query '{"operation":"get","id":"todesk"}'
# version / activeVersion 应为 0.4.8，且 grantedCommandNames 里含 "ToDesk.exe"
```

面板里如果还看到「宿主未授权 ToDesk.exe」，就去 设置 → 插件 → ToDesk → 命令 勾一次；
0.4.8 会把这件事直接写在面板上，不再抛到右下角。
