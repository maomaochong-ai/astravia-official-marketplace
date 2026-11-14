/**
 * magpie 二进制的「取回 → 校验 → 落地 → 启动」在纯文本层的全部约定。
 *
 * 这个文件只做字符串：选哪个资产、拼哪几行 sh、怎么读回输出。所有副作用都在
 * runtime-manager 里，经宿主 ctx.command 执行。
 *
 * 三条硬规矩：
 * 1. **版本与校验和都来自官网自己的发布接口**（`https://usemagpie.ai/api/latest`），
 *    插件里不写死版本号，也不猜资产名；
 * 2. **下载地址与 sha256 一律当数据校验**：只接受 https 的
 *    `github.com/yetone/magpie-releases/releases/download/…` 与小写 64 位十六进制，
 *    清单被换掉时这一层直接拒绝，不会把任意 URL 送进 shell；
 * 3. 安装位置与官方 install.sh 一致（`$HOME/.local/bin/magpie`），不写系统目录、不碰
 *    `/Applications`、不 sudo。
 */

/** 官网发布接口：`{version, url, assets: {"magpie-cli-darwin-arm64": {url,size,sha256}}}`。 */
export const RELEASE_FEED_URL = "https://usemagpie.ai/api/latest";

/** 官方安装器用的同一个目录，用户 PATH 里通常已经有它。 */
export const BIN_DIR = "$HOME/.local/bin";
export const BIN_PATH = "$HOME/.local/bin/magpie";

/**
 * 只接受官方两条下载前缀：清单是网络取回来的，不当指令用。
 *
 * 线上 feed 现在给的是 `usemagpie.ai/files/…`（站点自己转给 GitHub），
 * 早期版本给的是 GitHub Releases 直链；两条都是同一批制品，都验 sha256。
 */
const DOWNLOAD_PREFIXES = [
	"https://usemagpie.ai/files/",
	"https://github.com/yetone/magpie-releases/releases/download/",
];
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type HostOs = "darwin" | "linux" | "windows";
export type HostArch = "amd64" | "arm64";

export interface HostTarget {
	os: HostOs;
	arch: HostArch;
}

export interface ReleaseAsset {
	/** 清单里的键，例如 `magpie-cli-darwin-arm64`。 */
	key: string;
	/** 清单顶层的 magpie 版本，例如 `0.1.3336`。 */
	version: string;
	url: string;
	sha256: string;
	/** 字节数；官方 feed 自 0.1.4138 起不再发布，缺失时只有 sha256 守着。 */
	size?: number;
}

/**
 * `uname -s` / `uname -m` 的两行输出 → 平台标识。
 * 认不出来（Windows 上没有 sh、或未来出现新架构）返回 null，调用方给人工安装的出口。
 */
export function parseHostTarget(stdout: string): HostTarget | null {
	const [rawOs = "", rawArch = ""] = stdout.trim().toLowerCase().split(/\s+/);
	const os: HostOs | null =
		rawOs === "darwin" ? "darwin" : rawOs === "linux" ? "linux" : rawOs === "windows_nt" ? "windows" : null;
	const arch: HostArch | null =
		rawArch === "arm64" || rawArch === "aarch64"
			? "arm64"
			: rawArch === "x86_64" || rawArch === "amd64" || rawArch === "x64"
				? "amd64"
				: null;
	if (!os || !arch) return null;
	return { os, arch };
}

/**
 * 资产键。terminal build（`magpie-cli-*`）就是带 `serve` 的命令行版本，
 * 比 GUI 的 dmg/zip 小一半，也不需要桌面会话——这里要的就是它。
 */
export function assetKeyFor(target: HostTarget): string {
	const suffix = target.os === "windows" ? ".exe" : "";
	return `magpie-cli-${target.os}-${target.arch}${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** 从发布接口里挑出本平台的资产；任何一项不合规都返回 null（fail-closed）。 */
export function pickReleaseAsset(feed: unknown, target: HostTarget): ReleaseAsset | null {
	if (!isRecord(feed) || !isRecord(feed.assets)) return null;
	const entry = feed.assets[assetKeyFor(target)];
	if (!isRecord(entry)) return null;
	const { url, sha256, size } = entry;
	const version = typeof feed.version === "string" ? feed.version.trim() : "";
	if (typeof url !== "string" || !DOWNLOAD_PREFIXES.some((prefix) => url.startsWith(prefix))) return null;
	if (typeof sha256 !== "string" || !SHA256_PATTERN.test(sha256)) return null;
	// `size` 从 0.1.4138 起变成 0（官方 feed 不再发布字节数）。它不是安全属性：
	// 真正的完整性靠下面那个 sha256，size 只用来算进度与“残片是否已完整”。当未知处理，
	// 不能因为厂商少给一个可选字段就把整个平台的安装入口关死。
	const bytes = typeof size === "number" && Number.isFinite(size) && size > 0 ? size : undefined;
	if (!version) return null;
	return { key: assetKeyFor(target), version, url, sha256, ...(bytes ? { size: bytes } : {}) };
}

/** POSIX sh 单引号字符串：脚本里出现的每个外部值都从这里过。 */
export function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * 安装脚本。已经装过就直接返回 0，所以「安装并启动」可以反复点。
 *
 * 校验用系统自带的工具：macOS 有 `shasum`，多数 Linux 有 `sha256sum`，
 * 两个都没有就不安装 —— 宁可失败也不落地一个没验过的可执行件。
 */
export function installScript(asset: ReleaseAsset): string {
	const url = shellQuote(asset.url);
	const sha = shellQuote(asset.sha256);
	return [
		"set -eu",
		`bin="${BIN_PATH}"`,
		'if [ -x "$bin" ]; then',
		'  echo "already installed: $bin"',
		// 已有就立即返回，不去执行它（版本交给 probe）
		"  exit 0",
		"fi",
		// 下载物落在缓存目录：没下完的残片下次会被整包覆盖，不会当成已装
		`part="$HOME/.cache/magpie/${asset.key}"`,
		'mkdir -p "$HOME/.cache/magpie"',
		`echo "downloading ${asset.key} ${asset.version} (${asset.size ?? "size unknown"}${asset.size ? " bytes" : ""})"`,
		// size 未知时 `want=0`：下面的比较只用于「残片是否已完整」，0 表示不预检。
		`want="${asset.size ?? 0}"`,
		`want="${asset.size}"`,
		'have=0',
		`if [ -f "$part" ]; then have="$(wc -c < "$part" | tr -d ' ')"; fi`,
		// 长度已经对上就直接校验，不再发请求；否则整包重下。
		// 不续传：实测文件主机不处理 Range 请求（curl 报 56），残片一旦存在，
		// `-C -` 会每次以同样的错误失败；整包 70 MB 重下比赌服务端更稳。
		// 不知道总长（want=0）或长度不对，都整包重下；有残片就算不完整。
		'if [ "$want" = 0 ] || [ "$have" != "$want" ]; then',
		// curl 的进度条只画在终端里，插件这边没有终端 —— 70 MB 看起来就是卡住。
		// 所以下载在前台跑，旁边挂一个每秒数一次落盘字节的观察者，把
		// `progress <已下> <总长>` 写进 spawn 的环形缓冲，面板据此画进度。
		'  stop="$HOME/.cache/magpie/.watch.$$"',
		'  rm -f "$stop"',
		'  ( while [ ! -e "$stop" ]; do',
		'      sleep 1',
		`      s="$(wc -c < "$part" 2>/dev/null | tr -d ' ')"`,
		'      [ -n "$s" ] || s=0',
		'      echo "progress $s $want"',
		'    done ) &',
		'  watch=$!',
		'  echo "progress 0 $want"',
		'  rc=0',
		`  curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 20 -o "$part" ${url} || rc=$?`,
		// 观察者靠这个标记收尾；`wait` 把它收回来，免得留下一个空转的子 shell
		'  touch "$stop"',
		'  wait "$watch" 2>/dev/null || true',
		'  rm -f "$stop"',
		'  if [ "$rc" != 0 ]; then',
		'    echo "download failed (exit $rc)"',
		'    rm -f "$part"',
		'    exit 5',
		'  fi',
		// 总长未知时不报假的「全部完成」：让最后一行进度保持为实际字节数。
		'  if [ "$want" != 0 ]; then echo "progress $want $want"; fi',
		'fi',
		'echo "verifying"',
		'if command -v shasum >/dev/null 2>&1; then',
		'  got="$(shasum -a 256 "$part" | cut -d" " -f1)"',
		"elif command -v sha256sum >/dev/null 2>&1; then",
		'  got="$(sha256sum "$part" | cut -d" " -f1)"',
		"else",
		'  echo "no sha256 tool (shasum or sha256sum) on this machine"',
		"  exit 3",
		"fi",
		`if [ "$got" != ${sha} ]; then`,
		'  echo "checksum mismatch: got $got"',
		// 坏包不留，否则下次会从错的位置继续
		'  rm -f "$part"',
		"  exit 4",
		"fi",
		`mkdir -p "${BIN_DIR}"`,
		'install -m 755 "$part" "$bin"',
		'rm -f "$part"',
		'echo "installed $bin"',
		// 这里不执行新装好的文件：版本由随后的 probe 脚本读，避免为一个不可执行件白等
	].join("\n");
}

/**
 * 三处查找顺序一致：插件安装位 → PATH → 常见 bin 目录。
 *
 * 用户的 `~/bin` 里已经有一份时不该为了一次点击重下 70 MB；
 * 但探针找到哪儿、启动就得启哪儿，否则会出现「检测到已安装、启动却找不到」。
 */
function binLookup(): string[] {
	return [
		`bin="${BIN_PATH}"`,
		'if [ ! -x "$bin" ]; then bin="$(command -v magpie 2>/dev/null || true)"; fi',
		'if [ ! -x "$bin" ]; then',
		'  for dir in "$HOME/.local/bin" "$HOME/bin" /usr/local/bin /opt/homebrew/bin; do',
		'    if [ -x "$dir/magpie" ]; then bin="$dir/magpie"; break; fi',
		"  done",
		"fi",
	];
}

/**
 * 探二进制：输出两行可解析的事实（路径、版本），不解析 `which` 的本地化文案。
 */
export function probeScript(): string {
	return [
		...binLookup(),
		'[ -n "$bin" ] || exit 127',
		'echo "path=$bin"',
		'"$bin" --version </dev/null 2>/dev/null || echo "version=unknown"',
	].join("\n");
}

export interface ProbeResult {
	installed: boolean;
	path?: string;
	version?: string;
}

/** 读回 probeScript 的输出；`exit 127` 时 stdout 是空的。 */
export function parseProbe(stdout: string, exitCode: number | null): ProbeResult {
	const lines = stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const pathLine = lines.find((line) => line.startsWith("path="));
	if (exitCode !== 0 || !pathLine) return { installed: false };
	const path = pathLine.slice("path=".length);
	const versionLine = lines.find((line) => line !== pathLine);
	const version = versionLine?.replace(/^magpie\s+/i, "").trim();
	return { installed: Boolean(path), path, version: version || undefined };
}

/**
 * 启动脚本。`magpie serve` 是上游的前台网关命令（`internal/cli/main.go` 的
 * `case "serve"` → `serveCmd`），进程由宿主的 spawn 管着，停止就是把它停掉。
 *
 * 端口跟面板里的地址一致：`serve` 没有 `--addr`，只能靠 `MAGPIE_ADDR` 环境变量，
 * 所以由 runtime-manager 在 spawn 的 env 里注入。
 */
/**
 * `resolvedPath` 是探针读回来的那个路径：传了就直接启它，否则现场再找一遍。
 * 找不到才报错；末尾 `exec` 让 magpie 接管这个 shell，`stop()` 才能一次收掉整棵进程树。
 */
export function startScript(resolvedPath?: string): string {
	const head = resolvedPath && resolvedPath.trim() ? [`bin=${shellQuote(resolvedPath.trim())}`] : binLookup();
	return [
		"set -eu",
		...head,
		'if [ -z "$bin" ] || [ ! -x "$bin" ]; then echo "magpie binary not found" >&2; exit 127; fi',
		'exec "$bin" serve',
	].join("\n");
}

/** 停止交给宿主：spawn 的 handle.stop() 先 SIGTERM 再 SIGKILL 整棵进程树。 */
export type CommandDenial = "denied" | "failed";

/**
 * 宿主的命令门拒绝时会抛 `Command not declared: sh` / `Command disabled by user: sh`
 * / `Plugin permission denied: agent.command.run`。这三种对用户是同一件事：
 * 去插件设置里把 sh 打开。其余错误按普通失败处理。
 */
export function classifyCommandError(error: unknown): CommandDenial {
	const message = error instanceof Error ? error.message : String(error ?? "");
	if (/not declared|disabled by user|permission denied/i.test(message)) return "denied";
	return "failed";
}

/** `progress <已下> <总长>` 是安装脚本给面板看的进度行，不算「一条输出」。 */
const PROGRESS_LINE = /^progress \d+ \d+$/;

/** 从 spawn 的环形缓冲里取最后一行有用的输出，给面板当「最近一条」。 */
export function lastLine(output: string, limit = 240): string | undefined {
	const lines = output
		.split(/\r?\n|\r/)
		.map((line) => line.trim())
		.filter((line) => Boolean(line) && !PROGRESS_LINE.test(line));
	const last = lines[lines.length - 1];
	if (!last) return undefined;
	return last.length > limit ? `${last.slice(0, limit)}…` : last;
}
/** 安装脚本自己报的进度：环形缓冲里取最后一次 `progress`，再看它在哪一步。 */
export interface InstallProgress {
	downloaded?: number;
	total?: number;
	/** 下载完了，正在核对 sha256。 */
	verifying: boolean;
	/** 已经装到 `~/.local/bin/magpie`。 */
	installed: boolean;
}

export function parseInstallProgress(output: string): InstallProgress {
	let downloaded: number | undefined;
	let total: number | undefined;
	let verifying = false;
	let installed = false;
	for (const raw of output.split(/\r?\n|\r/)) {
		const line = raw.trim();
		const match = /^progress (\d+) (\d+)$/.exec(line);
		if (match) {
			downloaded = Number(match[1]);
			total = Number(match[2]);
			continue;
		}
		if (line === "verifying") {
			verifying = true;
			continue;
		}
		// 已经装好时脚本只打一行「already installed」，那也是「装好了」
		if (/^(?:already )?installed\b/.test(line)) {
			installed = true;
			verifying = false;
		}
	}
	if (total !== undefined && !(total > 0)) total = undefined;
	return { downloaded, total, verifying: verifying && !installed, installed };
}

