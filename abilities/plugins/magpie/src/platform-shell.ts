/**
 * 本机执行面：POSIX 用 `sh`，Windows 用 `powershell`。
 *
 * 为什么要有这一层：0.1.3 只会 `sh -c`。Windows 上没有 `sh`，宿主于是回
 * `Command failed to start: sh (ENOENT)`，面板把它读成「这个系统上没有官方命令行构建」——
 * 而官方清单里 `magpie-cli-windows-amd64.exe` 明确存在（85.7 MiB，带 sha256）。
 * 缺的不是构建，是一条能在 Windows 上执行的路径。
 *
 * 两个实现输出**同一套行协议**，所以 gateway-runtime 里的解析器一份就够：
 *
 *     path=<bin> / version=<v>     探针
 *     progress <已下> <总长>        下载进度
 *     verifying                     正在核对 sha256
 *     installed <bin>               已装好
 *
 * PowerShell 脚本走 `-EncodedCommand`（UTF-16LE base64）：一个参数、没有引号与转义，
 * 清单里的 URL 与 sha256 不会和 shell 的解析规则打架。
 */

import type { ReleaseAsset } from "./gateway-runtime";
import { shellQuote, BIN_PATH } from "./gateway-runtime";

export type ShellKind = "posix" | "windows";

export interface ShellRunner {
	readonly kind: ShellKind;
	readonly command: string;
	/** 把脚本变成 argv；POSIX 是 `-c`，Windows 是编码后的单参数。 */
	args(script: string): string[];
}

/** Windows 上的安装位置：用户目录，不需要管理员，也不改 PATH。 */
export const WINDOWS_BIN_DIR = "%LOCALAPPDATA%\\magpie\\bin";

/** 试的顺序：POSIX 先（macOS/Linux 上一条就成），Windows 在后。 */
export const SHELL_CANDIDATES: readonly ShellRunner[] = [
	{
		kind: "posix",
		command: "sh",
		args: (script) => ["-c", script],
	},
	{
		kind: "windows",
		command: "powershell",
		args: (script) => ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodePowerShell(script)],
	},
];

/** 用一句话说清「用哪个 shell 在跑」，面板在诊断里显示它。 */
export function describeShell(shell: ShellRunner | null): string | undefined {
	if (!shell) return undefined;
	return shell.kind === "windows" ? "powershell" : "sh";
}

/**
 * PowerShell 的 `-EncodedCommand` 要 UTF-16LE 的 base64。
 *
 * 渲染进程里没有 Node Buffer，所以手写这两步；非 BMP 字符会按代理对逐码元写入，
 * 对脚本里的 ASCII 与本项目的文案都是精确的。
 */
export function encodePowerShell(script: string): string {
	const units = script.length;
	const bytes = new Uint8Array(units * 2);
	for (let index = 0; index < units; index += 1) {
		const code = script.charCodeAt(index);
		bytes[index * 2] = code & 0xff;
		bytes[(index * 2) + 1] = (code >> 8) & 0xff;
	}
	let binary = "";
	const chunk = 0x8000;
	for (let index = 0; index < bytes.length; index += chunk) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
	}
	return btoa(binary);
}

/** 宿主报的「命令根本没有」：这一类要换 shell，不能当成普通失败。 */
export function shellMissing(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? "");
	return /enoent|not found|not recognized|cannot find|不是内部或外部命令|无法将.*识别为/i.test(message);
}

/** PowerShell 单引号字符串：唯一需要转义的是单引号本身。 */
export function psQuote(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

/** 启动时的探测脚本：先看插件安装位，再看 PATH 上的 magpie.exe。 */
export function windowsProbeScript(): string {
	return [
		"$ErrorActionPreference = 'SilentlyContinue'",
		"$ProgressPreference = 'SilentlyContinue'",
		"$bin = Join-Path $env:LOCALAPPDATA 'magpie\\bin\\magpie.exe'",
		"if (-not (Test-Path $bin)) {",
		"  $found = Get-Command magpie.exe -ErrorAction SilentlyContinue | Select-Object -First 1",
		"  if ($found) { $bin = $found.Source }",
		"}",
		"if (-not (Test-Path $bin)) { exit 127 }",
		"Write-Output \"path=$bin\"",
		"$version = & $bin --version 2>$null",
		"if ($version) { Write-Output \"version=$version\" } else { Write-Output 'version=unknown' }",
	].join("\n");
}

/**
 * Windows 安装脚本，和 POSIX 那份做同一件事、打同样的行。
 *
 * - 下载：优先 `curl.exe`（Windows 10 1803+ 自带），它给出可数的落盘字节，面板才有进度；
 *   没有就退回 `Invoke-WebRequest`（没有中间进度，但一样能装）。
 * - 校验：`Get-FileHash -Algorithm SHA256`，系统自带，不依赖 shasum。
 * - 落地：先在缓存目录，验过再 `Move-Item`，坏包不会留在安装位。
 */
export function windowsInstallScript(asset: ReleaseAsset): string {
	return [
		"$ErrorActionPreference = 'Stop'",
		// PowerShell 在非交互管道下会把“preparing modules”这类进度记录以 CLIXML 写到
		// stderr，宿主会把它当成“最后一行输出”呈现在面板上。关掉进度流就没有了。
		"$ProgressPreference = 'SilentlyContinue'",
		"$dir = Join-Path $env:LOCALAPPDATA 'magpie\\bin'",
		"$bin = Join-Path $dir 'magpie.exe'",
		"if (Test-Path $bin) { Write-Output 'already installed'; exit 0 }",
		"$cache = Join-Path $env:LOCALAPPDATA 'magpie\\cache'",
		"New-Item -ItemType Directory -Force -Path $dir, $cache | Out-Null",
		`$part = Join-Path $cache ${psQuote(asset.key)}`,
		// size 未知时 $want = 0：只影响“残片是否完整”与进度分母，完整性靠下面的 sha256。
		`$want = ${asset.size ?? 0}`,
		`Write-Output ('downloading ${asset.key} ${asset.version} (' + $want + ' bytes)')`,
		"$have = 0",
		"if (Test-Path $part) { $have = (Get-Item $part).Length }",
		"if (($want -eq 0) -or ($have -ne $want)) {",
		"  Remove-Item $part -ErrorAction SilentlyContinue",
		"  Write-Output \"progress 0 $want\"",
		"  $curl = Join-Path $env:SystemRoot 'System32\\curl.exe'",
		"  if (Test-Path $curl) {",
		`    $proc = Start-Process -FilePath $curl -NoNewWindow -PassThru -ArgumentList @('-fsSL', '--retry', '3', '--retry-delay', '2', '--connect-timeout', '20', '-o', $part, ${psQuote(asset.url)})`,
		"    while (-not $proc.HasExited) {",
		"      Start-Sleep -Milliseconds 800",
		"      $n = 0",
		"      if (Test-Path $part) { $n = (Get-Item $part).Length }",
		"      Write-Output \"progress $n $want\"",
		"    }",
		// `Start-Process -PassThru` 的 ExitCode 在 HasExited 刚变 true 时可能还是空的：
		// 空值 `-ne 0` 成立，会把一次成功的下载报成失败（真机实测到过）。先 WaitForExit
		// 把退出信息固化下来，再看它。
		"    $proc.WaitForExit()",
		"    $code = $proc.ExitCode",
		"    if ($null -eq $code) { $code = 0 }",
		"    if ($code -ne 0) {",
		"      Write-Output \"download failed (exit $code)\"",
		"      Remove-Item $part -ErrorAction SilentlyContinue",
		"      exit 5",
		"    }",
		"  } else {",
		`    Invoke-WebRequest -Uri ${psQuote(asset.url)} -OutFile $part -UseBasicParsing`,
		"  }",
		// 总长未知时不报假的「全部完成」。
		"  if ($want -ne 0) { Write-Output \"progress $want $want\" }",
		"}",
		"Write-Output 'verifying'",
		`$got = (Get-FileHash -Algorithm SHA256 -Path $part).Hash.ToLowerInvariant()`,
		`if ($got -ne ${psQuote(asset.sha256)}) {`,
		"  Write-Output \"checksum mismatch: got $got\"",
		"  Remove-Item $part -ErrorAction SilentlyContinue",
		"  exit 4",
		"}",
		"Move-Item -Force $part $bin",
		"Write-Output \"installed $bin\"",
	].join("\n");
}

/** 启动：直接前台跑 `serve`，进程归宿主的 spawn 管（停 = 停整棵进程树）。 */
export function windowsStartScript(resolvedPath?: string): string {
	const head =
		resolvedPath && resolvedPath.trim()
			? [`$bin = ${psQuote(resolvedPath.trim())}`]
			: ["$bin = Join-Path $env:LOCALAPPDATA 'magpie\\bin\\magpie.exe'"];
	return [
		"$ErrorActionPreference = 'Stop'",
		"$ProgressPreference = 'SilentlyContinue'",
		...head,
		"if (-not (Test-Path $bin)) {",
		"  $found = Get-Command magpie.exe -ErrorAction SilentlyContinue | Select-Object -First 1",
		"  if ($found) { $bin = $found.Source }",
		"}",
		"if (-not (Test-Path $bin)) { [Console]::Error.WriteLine('magpie binary not found'); exit 127 }",
		"& $bin serve",
	].join("\n");
}

/** 探针/启动都用得上的「这条 shell 到底能不能跑」：一个必然成功的空脚本。 */
export function shellHandshakeScript(kind: ShellKind): string {
	return kind === "windows" ? ["$ProgressPreference = 'SilentlyContinue'", "Write-Output 'ok'"].join("\n") : "echo ok";
}

/** Windows 的处理器架构：`AMD64` / `ARM64`，安装脚本选资产用。 */
export function windowsArchScript(): string {
	return ["$ProgressPreference = 'SilentlyContinue'", "Write-Output $env:PROCESSOR_ARCHITECTURE"].join("\n");
}

/** 面板上要给用户看的路径：POSIX 与 Windows 各一份。 */
export function binDisplayPath(kind: ShellKind): string {
	return kind === "windows" ? `${WINDOWS_BIN_DIR}\\magpie.exe` : BIN_PATH;
}

/** 给安装脚本用的 POSIX 单引号（保留导出，测试与调用方共用一处实现）。 */
export { shellQuote };
