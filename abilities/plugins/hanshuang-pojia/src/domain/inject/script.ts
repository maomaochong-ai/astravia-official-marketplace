/**
 * 注入脚本生成器：把一份 `InjectPlan` 变成用户能直接执行的脚本。
 *
 * 为什么是「生成脚本」而不是「插件自己写」：宿主的 `fs.write` 只放行项目内路径，
 * 而 9 个目标里有 8 个的写入点都在 `$HOME`。插件能做的是把计划固化成一个
 * 可审阅、可回滚、可重复执行的文本，由用户在自己的机器上跑。
 *
 * 两条硬约束写进脚本本身，而不是写进说明里：
 *   1. 先备份再写 —— 备份文件名带时间戳，失败也能逐字节还原；
 *   2. 只动标记块内的内容 —— 块外是用户自己的，一个字节都不碰。
 *
 * 脚本不做「看起来聪明」的事：不猜编码、不改权限、不删别的块。
 */

import { INJECT_MARKER_BEGIN, INJECT_MARKER_END, type InjectPlan } from "./targets";

export type Shell = "powershell" | "posix";

export interface RenderOptions {
	/** 状态文件的写入路径；缺省用计划里的。 */
	statePath?: string;
	/** 生成时间（ISO），写进脚本头注释，便于核对是哪一次生成的。 */
	generatedAt?: string;
}

/** 脚本里出现的路径要能安全插进双引号字符串。 */
function quote(value: string): string {
	return value.replace(/(["$`\\])/g, "\\$1");
}

/** 单引号 POSIX 字符串：内部单引号按 `'\''` 拼。 */
function posixSingle(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function stateJson(plan: InjectPlan): string {
	const entry = {
		target: plan.target.id,
		form: plan.form,
		files: plan.writes.filter(write => write.kind !== "key").map(write => write.path),
		markerBlock: plan.target.form === "marker-block",
		packLabel: plan.block.split("\n")[0]?.replace(/^.*→ /, "").replace(/ -->$/, "") ?? "",
	};
	return JSON.stringify({ version: 1, entries: [entry] }, null, 2);
}

/**
 * PowerShell 版。
 *
 * 标记块替换用逐行扫描而不是正则：正则在多行文本里对 `[`、`(` 这些字符敏感，
 * 而标记行里带 `<!--` 与 `-->`，写正则等于给自己埋一个只在特定文件上炸的坑。
 */
function renderPowerShell(plan: InjectPlan, statePath: string, generatedAt: string): string {
	const target = plan.target;
	const blockLines = plan.block.replace(/\r\n/g, "\n").split("\n").filter(line => line.length > 0);

	if (target.form !== "marker-block") {
		// 系统层 / 配置键：整份写入 + 配置提示，不掺标记块。
		return [
			`# hanshuang-pojia inject · ${target.id} · ${plan.form}`,
			`# generated ${generatedAt} — 由用户执行，插件本身不写主目录`,
			`$ErrorActionPreference = 'Stop'`,
			`$target = "${quote(target.entry)}"`,
			`$state  = "${quote(statePath)}"`,
			``,
			`# 1) 备份（存在才备份；带时间戳，可逐字节还原）`,
			`if (Test-Path $target) {`,
			`  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'`,
			`  Copy-Item $target "$target.hanshuang-backup-$stamp" -Force`,
			`  Write-Host "backup -> $target.hanshuang-backup-$stamp"`,
			`}`,
			``,
			`# 2) 整份写入（该文件只由本工具维护）`,
			`New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null`,
			`@'`,
			...plan.block.replace(/\r\n/g, "\n").split("\n"),
			`'@ | Set-Content -Path $target -Encoding utf8`,
			``,
			...(target.configKey
				? [
						`# 3) 配置键：不同版本写法不同，脚本只打印现状，改动由你确认`,
						`Write-Host "配置键 ${target.configKey} 需要指向 $target；确认后手改并做 JSON/TOML 校验"`,
						``,
					]
				: []),
			`# 4) 记录状态`,
			`New-Item -ItemType Directory -Force -Path (Split-Path $state) | Out-Null`,
			`@'`,
			stateJson(plan),
			`'@ | Set-Content -Path $state -Encoding utf8`,
			``,
			`Write-Host "done: $target"`,
		].join("\n");
	}

	return [
		`# hanshuang-pojia inject · ${target.id} · marker-block`,
		`# generated ${generatedAt} — 由用户执行，插件本身不写主目录`,
		`$ErrorActionPreference = 'Stop'`,
		`$target = "${quote(target.entry)}"`,
		`$state  = "${quote(statePath)}"`,
		``,
		`# 1) 备份`,
		`if (Test-Path $target) {`,
		`  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'`,
		`  Copy-Item $target "$target.hanshuang-backup-$stamp" -Force`,
		`  Write-Host "backup -> $target.hanshuang-backup-$stamp"`,
		`} else {`,
		`  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null`,
		`  New-Item -ItemType File -Force -Path $target | Out-Null`,
		`}`,
		``,
		`# 2) 标记块：有则整块替换，无则追加；块外内容不动`,
		`$begin = '${INJECT_MARKER_BEGIN}'`,
		`$end   = '${INJECT_MARKER_END}'`,
		`$block = @'`,
		...blockLines,
		`'@`,
		`$lines = Get-Content -LiteralPath $target -Encoding utf8 -ErrorAction SilentlyContinue`,
		`if ($null -eq $lines) { $lines = @() }`,
		`$startIdx = -1; $endIdx = -1`,
		`for ($i = 0; $i -lt $lines.Count; $i++) {`,
		`  if ($startIdx -lt 0 -and $lines[$i].Contains($begin)) { $startIdx = $i; continue }`,
		`  if ($startIdx -ge 0 -and $lines[$i].Contains($end)) { $endIdx = $i; break }`,
		`}`,
		`if ($startIdx -ge 0 -and $endIdx -ge 0) {`,
		`  $head = if ($startIdx -gt 0) { $lines[0..($startIdx-1)] } else { @() }`,
		`  $tail = if ($endIdx -lt $lines.Count - 1) { $lines[($endIdx+1)..($lines.Count-1)] } else { @() }`,
		`  $out = @($head) + (@($block) -split "\`n") + @($tail)`,
		`} else {`,
		`  $out = @($lines) + @('') + (@($block) -split "\`n")`,
		`}`,
		`Set-Content -LiteralPath $target -Value $out -Encoding utf8`,
		``,
		`# 3) 记录状态（卸载按这份清单还原）`,
		`New-Item -ItemType Directory -Force -Path (Split-Path $state) | Out-Null`,
		`@'`,
		stateJson(plan),
		`'@ | Set-Content -Path $state -Encoding utf8`,
		``,
		`# 4) 回读确认`,
		`$check = Get-Content -LiteralPath $target -Encoding utf8`,
		`if (-not ($check -join "\`n").Contains($begin)) { throw "marker block missing after write: $target" }`,
		`Write-Host "done: $target"`,
		`Write-Host "restore: 删除 ${INJECT_MARKER_BEGIN} … ${INJECT_MARKER_END} 之间的内容，或用同目录备份覆盖"`,
	].join("\n");
}

/** POSIX（bash / sh）版：同一套语义，`sed` 换行处理靠 awk，避免 GNU/BSD 差异。 */
function renderPosix(plan: InjectPlan, statePath: string, generatedAt: string): string {
	const target = plan.target;
	const heredoc = "HANSHUANG_BLOCK";

	if (target.form !== "marker-block") {
		const body = plan.block.replace(/\r\n/g, "\n");
		return [
			`#!/bin/sh`,
			`# hanshuang-pojia inject · ${target.id} · ${plan.form}`,
			`# generated ${generatedAt} — 由用户执行，插件本身不写主目录`,
			`set -eu`,
			`TARGET=${posixSingle(target.entry)}`,
			`STATE=${posixSingle(statePath)}`,
			``,
			`# 1) 备份`,
			`if [ -f "$TARGET" ]; then`,
			`  STAMP=$(date +%Y%m%d-%H%M%S)`,
			`  cp -p "$TARGET" "$TARGET.hanshuang-backup-$STAMP"`,
			`  echo "backup -> $TARGET.hanshuang-backup-$STAMP"`,
			`fi`,
			`mkdir -p "$(dirname "$TARGET")"`,
			``,
			`# 2) 整份写入`,
			`cat > "$TARGET" <<'${heredoc}'`,
			body,
			heredoc,
			``,
			...(target.configKey
				? [`# 3) 配置键 ${target.configKey} 需人工指向该文件，并做格式校验`, ``]
				: []),
			`# 4) 记录状态`,
			`mkdir -p "$(dirname "$STATE")"`,
			`cat > "$STATE" <<'${heredoc}_STATE'`,
			stateJson(plan),
			`${heredoc}_STATE`,
			``,
			`echo "done: $TARGET"`,
		].join("\n");
	}

	return [
		`#!/bin/sh`,
		`# hanshuang-pojia inject · ${target.id} · marker-block`,
		`# generated ${generatedAt} — 由用户执行，插件本身不写主目录`,
		`set -eu`,
		`TARGET=${posixSingle(target.entry)}`,
		`STATE=${posixSingle(statePath)}`,
		`BEGIN=${posixSingle(INJECT_MARKER_BEGIN)}`,
		`END=${posixSingle(INJECT_MARKER_END)}`,
		``,
		`# 1) 备份`,
		`if [ -f "$TARGET" ]; then`,
		`  STAMP=$(date +%Y%m%d-%H%M%S)`,
		`  cp -p "$TARGET" "$TARGET.hanshuang-backup-$STAMP"`,
		`  echo "backup -> $TARGET.hanshuang-backup-$STAMP"`,
		`else`,
		`  mkdir -p "$(dirname "$TARGET")"`,
		`  : > "$TARGET"`,
		`fi`,
		``,
		`# 2) 生成块正文`,
		`BLOCK=$(mktemp)`,
		`cat > "$BLOCK" <<'${heredoc}'`,
		plan.block.replace(/\r\n/g, "\n").replace(/\n$/, ""),
		heredoc,
		``,
		`# 3) 有块则替换，无则追加：awk 逐行扫描，块外内容原样输出`,
		`TMP=$(mktemp)`,
		`awk -v begin="$BEGIN" -v end="$END" -v block="$BLOCK" '`,
		`  BEGIN { inblock = 0; replaced = 0 }`,
		`  {`,
		`    if (!inblock && index($0, begin) > 0) {`,
		`      inblock = 1`,
		`      while ((getline line < block) > 0) print line`,
		`      close(block)`,
		`      replaced = 1`,
		`      next`,
		`    }`,
		`    if (inblock) {`,
		`      if (index($0, end) > 0) { inblock = 0 }`,
		`      next`,
		`    }`,
		`    print`,
		`  }`,
		`  END { if (!replaced) { print ""; while ((getline line < block) > 0) print line } }`,
		`' "$TARGET" > "$TMP"`,
		`mv "$TMP" "$TARGET"`,
		`rm -f "$BLOCK"`,
		``,
		`# 4) 记录状态`,
		`mkdir -p "$(dirname "$STATE")"`,
		`cat > "$STATE" <<'${heredoc}_STATE'`,
		stateJson(plan),
		`${heredoc}_STATE`,
		``,
		`# 5) 回读确认`,
		`if ! grep -qF "$BEGIN" "$TARGET"; then`,
		`  echo "marker block missing after write: $TARGET" >&2`,
		`  exit 1`,
		`fi`,
		`echo "done: $TARGET"`,
		`echo "restore: 删除 ${INJECT_MARKER_BEGIN} … ${INJECT_MARKER_END} 之间的内容，或用同目录备份覆盖"`,
	].join("\n");
}

/** 按目标平台渲染脚本。默认给 PowerShell —— 这套注入器的上游就是 pwsh，跨平台可用。 */
export function renderInstaller(plan: InjectPlan, shell: Shell, options: RenderOptions = {}): string {
	const statePath = options.statePath?.trim() || plan.statePath;
	const generatedAt = options.generatedAt ?? new Date().toISOString();
	return shell === "posix" ? renderPosix(plan, statePath, generatedAt) : renderPowerShell(plan, statePath, generatedAt);
}

/** 还原脚本：按 state 里的备份还原，不做「猜路径」。 */
export function renderRestoreScript(plan: InjectPlan, shell: Shell): string {
	const target = plan.target.entry;
	if (shell === "posix") {
		return [
			`#!/bin/sh`,
			`# hanshuang-pojia restore · ${plan.target.id}`,
			`set -eu`,
			`TARGET=${posixSingle(target)}`,
			`LATEST=$(ls -1t "$TARGET".hanshuang-backup-* 2>/dev/null | head -n 1 || true)`,
			`if [ -n "$LATEST" ]; then cp -p "$LATEST" "$TARGET"; echo "restored from $LATEST"; else echo "no backup found for $TARGET" >&2; exit 1; fi`,
		].join("\n");
	}
	return [
		`# hanshuang-pojia restore · ${plan.target.id}`,
		`$ErrorActionPreference = 'Stop'`,
		`$target = "${quote(target)}"`,
		`$backup = Get-ChildItem "$target.hanshuang-backup-*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1`,
		`if ($null -eq $backup) { throw "no backup found for $target" }`,
		`Copy-Item $backup.FullName $target -Force`,
		`Write-Host "restored from $($backup.FullName)"`,
	].join("\n");
}

/** 卸载与兜底清理的实现集中在 `removal.ts`（四种情形依次判定：现行标记 → 旧标记 → 无标记但命中特征串 → 本来就未装）。 */
export { renderBatchRemoval, renderRemovalScript } from "./removal";