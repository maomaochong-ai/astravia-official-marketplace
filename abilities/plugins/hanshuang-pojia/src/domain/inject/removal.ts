/**
 * 卸载与兜底清理的脚本生成。
 *
 * 与上游 `install-*.ps1` 的 `-Uninstall` / `-RestoreMemory` 对齐后，卸载分四种情形，
 * 自上而下依次尝试，命中即停：
 *
 *   1. **现行标记块**存在 → 只摘块，块外内容一字节不动；
 *   2. **旧标记块**（`HANSHUANG-INJECT:BEGIN`）存在 → 按旧标记摘，升级过一轮的用户靠这条能卸干净；
 *   3. 无任何标记但**命中特征串** → 说明是“整份覆盖”式的老注入，摘不了，退到干净备份还原；
 *   4. 无标记也无特征 → 本来就没装，报告 `not installed` 后退出 0。
 *
 * “干净备份”的判定同样照上游：备份文件自身命中特征串的不算（那是注入了内容的备份，
 * 还原它等于没卸），空文件也不算。
 *
 * 为什么不一律整份还原：插件装进去的只有块，整份还原会把用户装完之后自己改的部分一起抹掉。
 * 只有系统层目标（整份文件就是提示词）才走备份还原。
 */

import { INJECT_MARKER_BEGIN, INJECT_MARKER_END, INJECT_SIGNATURES, LEGACY_MARKER_BEGIN, LEGACY_MARKER_END, type InjectPlan } from "./targets";
import { renderRestoreScript, type Shell } from "./script";

const BACKUP_SUFFIX = ".hanshuang-backup-";

function quote(value: string): string {
	return value.replace(/(["$`\\])/g, "\\$1");
}

function posixSingle(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}


export function renderRemovalScript(plan: InjectPlan, shell: Shell): string {
	const target = plan.target.entry;
	// 系统层目标是整份文件，没有“块”可摘，只能按备份还原。
	if (plan.target.form !== "marker-block") return renderRestoreScript(plan, shell);

	return shell === "posix" ? posixRemoval(plan.target.id, target) : powershellRemoval(plan.target.id, target);
}


function posixRemoval(id: string, target: string): string {
	const signatures = INJECT_SIGNATURES.map(value => posixSingle(value)).join(" ");
	return [
		`#!/bin/sh`,
		`# hanshuang-pojia uninstall · ${id}`,
		`set -eu`,
		`TARGET=${posixSingle(target)}`,
		`BEGIN=${posixSingle(INJECT_MARKER_BEGIN)}`,
		`END=${posixSingle(INJECT_MARKER_END)}`,
		`OLD_BEGIN=${posixSingle(LEGACY_MARKER_BEGIN)}`,
		`OLD_END=${posixSingle(LEGACY_MARKER_END)}`,
		`SIGNATURES='${signatures}'`,
		`[ -f "$TARGET" ] || { echo "not installed: $TARGET"; exit 0; }`,
		``,
		`strip_block() {`,
		`  TMP=$(mktemp)`,
		`  awk -v b="$1" -v e="$2" '`,
		`    index($0, b) > 0 { skip = 1; next }`,
		`    skip && index($0, e) > 0 { skip = 0; next }`,
		`    !skip { print }`,
		`  ' "$TARGET" > "$TMP"`,
		`  mv "$TMP" "$TARGET"`,
		`}`,
		``,
		`is_artifact() {`,
		`  for sig in $SIGNATURES; do`,
		`    grep -qF "$sig" "$1" && return 0`,
		`  done`,
		`  return 1`,
		`}`,
		``,
		`# 1) 现行标记`,
		`if grep -qF "$BEGIN" "$TARGET"; then`,
		`  strip_block "$BEGIN" "$END"`,
		`  grep -qF "$BEGIN" "$TARGET" && { echo "block still present: $TARGET" >&2; exit 1; }`,
		`  echo "removed: $TARGET"`,
		`  exit 0`,
		`fi`,
		``,
		`# 2) 旧标记`,
		`if grep -qF "$OLD_BEGIN" "$TARGET"; then`,
		`  strip_block "$OLD_BEGIN" "$OLD_END"`,
		`  echo "removed (legacy marker): $TARGET"`,
		`  exit 0`,
		`fi`,
		``,
		`# 3) 无标记但看起来是注入产物：找一份干净备份还原`,
		`if is_artifact "$TARGET"; then`,
		`  CLEAN=""`,
		`  for cand in $(ls -1t "$TARGET"${BACKUP_SUFFIX}* 2>/dev/null || true); do`,
		`    [ -s "$cand" ] || continue`,
		`    is_artifact "$cand" && continue`,
		`    CLEAN="$cand"`,
		`    break`,
		`  done`,
		`  if [ -n "$CLEAN" ]; then`,
		`    cp -p "$CLEAN" "$TARGET"`,
		`    echo "restored from clean backup: $CLEAN"`,
		`    exit 0`,
		`  fi`,
		`  echo "artifact detected but no clean backup; restore manually: $TARGET" >&2`,
		`  exit 2`,
		`fi`,
		``,
		`# 4) 本来就没装`,
		`echo "not installed: $TARGET"`,
	].join("\n");
}

function powershellRemoval(id: string, target: string): string {
	const signatures = INJECT_SIGNATURES.map(value => `'${value.replace(/'/g, "''")}'`).join(", ");
	return [
		`# hanshuang-pojia uninstall · ${id}`,
		`$ErrorActionPreference = 'Stop'`,
		`$target = "${quote(target)}"`,
		`$begin = '${INJECT_MARKER_BEGIN}'`,
		`$end = '${INJECT_MARKER_END}'`,
		`$oldBegin = '${LEGACY_MARKER_BEGIN}'`,
		`$oldEnd = '${LEGACY_MARKER_END}'`,
		`$signatures = @(${signatures})`,
		`if (-not (Test-Path $target)) { Write-Host "not installed: $target"; exit 0 }`,
		``,
		`function Strip-Block([string]$open, [string]$close) {`,
		`  $out = @(); $skip = $false`,
		`  foreach ($line in (Get-Content -LiteralPath $target -Encoding utf8)) {`,
		`    if ($line.Contains($open)) { $skip = $true; continue }`,
		`    if ($skip -and $line.Contains($close)) { $skip = $false; continue }`,
		`    if (-not $skip) { $out += $line }`,
		`  }`,
		`  Set-Content -LiteralPath $target -Value $out -Encoding utf8`,
		`}`,
		``,
		`function Test-Artifact([string]$path) {`,
		`  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }`,
		`  $text = Get-Content -LiteralPath $path -Raw -Encoding utf8`,
		`  if ([string]::IsNullOrWhiteSpace($text)) { return $false }`,
		`  foreach ($sig in $signatures) { if ($text.Contains($sig)) { return $true } }`,
		`  return $false`,
		`}`,
		``,
		`# 1) current marker`,
		`$text = Get-Content -LiteralPath $target -Raw -Encoding utf8`,
		`if ($text -and $text.Contains($begin)) {`,
		`  Strip-Block $begin $end`,
		`  if ((Get-Content -LiteralPath $target -Raw -Encoding utf8).Contains($begin)) { throw "block still present: $target" }`,
		`  Write-Host "removed: $target"`,
		`  exit 0`,
		`}`,
		``,
		`# 2) legacy marker`,
		`if ($text -and $text.Contains($oldBegin)) {`,
		`  Strip-Block $oldBegin $oldEnd`,
		`  Write-Host "removed (legacy marker): $target"`,
		`  exit 0`,
		`}`,
		``,
		`# 3) unmarked artifact: fall back to the newest clean backup`,
		`if (Test-Artifact $target) {`,
		`  $clean = Get-ChildItem "$target${BACKUP_SUFFIX}*" -File -ErrorAction SilentlyContinue |`,
		`    Where-Object { $_.Length -gt 0 } | Sort-Object LastWriteTime -Descending |`,
		`    Where-Object { -not (Test-Artifact $_.FullName) } | Select-Object -First 1`,
		`  if ($null -ne $clean) {`,
		`    Copy-Item $clean.FullName $target -Force`,
		`    Write-Host "restored from clean backup: $($clean.FullName)"`,
		`    exit 0`,
		`  }`,
		`  Write-Host "artifact detected but no clean backup; restore manually: $target" -ForegroundColor Yellow`,
		`  exit 2`,
		`}`,
		``,
		`# 4) nothing installed`,
		`Write-Host "not installed: $target"`,
	].join("\n");
}

/**
 * 批量清除：遍历所有 marker-block 目标，对每一个调用与单目标相同的四步判定。
 * 把 bash 函数体内联一次比拼接多份脚本更不容易漏，因此这里把单目标的脚本体直接拼进去。
 */
export function renderBatchRemoval(plans: readonly InjectPlan[], shell: Shell): string {
	const targets = plans.filter(plan => plan.target.form === "marker-block").map(plan => plan.target);
	const skipped = plans.filter(plan => plan.target.form !== "marker-block").map(plan => plan.target.id);
	const header = [
		`# hanshuang-pojia uninstall · ${targets.length} target(s)`,
		`# 只动注入内容，块外不碰。${skipped.length > 0 ? ` 跳过（需单独处理）：${skipped.join(", ")}` : ""}`,
		`# 每个目标按四步判定：现行标记 → 旧标记 → 无标记但命中特征串（还原干净备份） → 本来就没装。`,
	];

	if (shell === "posix") {
		return [
			`#!/bin/sh`,
			...header,
			`BEGIN=${posixSingle(INJECT_MARKER_BEGIN)}`,
			`END=${posixSingle(INJECT_MARKER_END)}`,
			`OLD_BEGIN=${posixSingle(LEGACY_MARKER_BEGIN)}`,
			`OLD_END=${posixSingle(LEGACY_MARKER_END)}`,
			`SIGNATURES="${INJECT_SIGNATURES.map(value => posixSingle(value)).join(" ")}"`,
			``,
			`is_artifact() {`,
			`  for sig in $SIGNATURES; do grep -qF "$sig" "$1" && return 0; done`,
			`  return 1`,
			`}`,
			``,
			`strip_block() {`,
			`  TARGET="$1"; OPEN="$2"; CLOSE="$3"`,
			`  TMP=$(mktemp)`,
			`  awk -v b="$OPEN" -v e="$CLOSE" '`,
			`    index($0, b) > 0 { skip = 1; next }`,
			`    skip && index($0, e) > 0 { skip = 0; next }`,
			`    !skip { print }`,
			`  ' "$TARGET" > "$TMP"`,
			`  mv "$TMP" "$TARGET"`,
			`}`,
			``,
			`remove_one() {`,
			`  TARGET="$1"`,
			`  [ -f "$TARGET" ] || { echo "not installed: $TARGET"; return 0 }`,
			`  if grep -qF "$BEGIN" "$TARGET"; then strip_block "$TARGET" "$BEGIN" "$END"; echo "removed: $TARGET"; return 0; fi`,
			`  if grep -qF "$OLD_BEGIN" "$TARGET"; then strip_block "$TARGET" "$OLD_BEGIN" "$OLD_END"; echo "removed (legacy): $TARGET"; return 0; fi`,
			`  if is_artifact "$TARGET"; then`,
			`    for cand in $(ls -1t "$TARGET"${BACKUP_SUFFIX}* 2>/dev/null || true); do`,
			`      [ -s "$cand" ] || continue`,
			`      is_artifact "$cand" && continue`,
			`      cp -p "$cand" "$TARGET"; echo "restored from clean backup: $cand"; return 0`,
			`    done`,
			`    echo "artifact without clean backup: $TARGET" >&2; return 2`,
			`  fi`,
			`  echo "not installed: $TARGET"`,
			`}`,
			``,
			...targets.map(target => `remove_one ${posixSingle(target.entry)}`),
			`echo "done"`,
		].join("\n");
	}

	return [
		...header,
		`$ErrorActionPreference = 'Stop'`,
		`$begin = '${INJECT_MARKER_BEGIN}'`,
		`$end = '${INJECT_MARKER_END}'`,
		`$oldBegin = '${LEGACY_MARKER_BEGIN}'`,
		`$oldEnd = '${LEGACY_MARKER_END}'`,
		`$signatures = @(${INJECT_SIGNATURES.map(value => `'${value.replace(/'/g, "''")}'`).join(", ")})`,
		``,
		`function Test-Artifact([string]$path) {`,
		`  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }`,
		`  $text = Get-Content -LiteralPath $path -Raw -Encoding utf8`,
		`  if ([string]::IsNullOrWhiteSpace($text)) { return $false }`,
		`  foreach ($sig in $signatures) { if ($text.Contains($sig)) { return $true } }`,
		`  return $false`,
		`}`,
		``,
		`function Strip-Block([string]$target, [string]$open, [string]$close) {`,
		`  $out = @(); $skip = $false`,
		`  foreach ($line in (Get-Content -LiteralPath $target -Encoding utf8)) {`,
		`    if ($line.Contains($open)) { $skip = $true; continue }`,
		`    if ($skip -and $line.Contains($close)) { $skip = $false; continue }`,
		`    if (-not $skip) { $out += $line }`,
		`  }`,
		`  Set-Content -LiteralPath $target -Value $out -Encoding utf8`,
		`}`,
		``,
		`function Remove-One([string]$target) {`,
		`  if (-not (Test-Path $target)) { Write-Host "not installed: $target"; return }`,
		`  $text = Get-Content -LiteralPath $target -Raw -Encoding utf8`,
		`  if ($text -and $text.Contains($begin)) { Strip-Block $target $begin $end; Write-Host "removed: $target"; return }`,
		`  if ($text -and $text.Contains($oldBegin)) { Strip-Block $target $oldBegin $oldEnd; Write-Host "removed (legacy): $target"; return }`,
		`  if (Test-Artifact $target) {`,
		`    $clean = Get-ChildItem "$target${BACKUP_SUFFIX}*" -File -ErrorAction SilentlyContinue |`,
		`      Where-Object { $_.Length -gt 0 } | Sort-Object LastWriteTime -Descending |`,
		`      Where-Object { -not (Test-Artifact $_.FullName) } | Select-Object -First 1`,
		`    if ($null -ne $clean) { Copy-Item $clean.FullName $target -Force; Write-Host "restored from clean backup: $($clean.FullName)"; return }`,
		`    Write-Host "artifact without clean backup: $target" -ForegroundColor Yellow`,
		`    return`,
		`  }`,
		`  Write-Host "not installed: $target"`,
		`}`,
		``,
		...targets.map(target => `Remove-One "${quote(target.entry)}"`),
		`Write-Host "done"`,
	].join("\n");
}
