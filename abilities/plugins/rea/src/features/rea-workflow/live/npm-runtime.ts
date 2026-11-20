/**
 * 找一条**能真的跑起来**的 npm / npx。
 *
 * 为什么需要这一层：宿主升级到 Node 22.23.5 之后，该运行时不再自带 npm，
 * 而 `%USERPROFILE%\.astravia\runtimes\.npm-global\npm.cmd` 这类 shim 仍指向
 * `node\22.23.5\node_modules\npm\bin\npx-cli.js` —— 文件不存在。
 * Windows 上 `npx` 按 PATH 解析，第一条就是那个坏 shim，于是：
 *
 *   npx.cmd : Error: Cannot find module '...\node_modules\npm\bin\npx-cli.js'
 *
 * 插件声明的是 `npx`，宿主只做 command + args 拼接，换不了 argv[0]。
 * 所以这里做两件事：
 *   1. 探测哪条通道真的可用（`npx --version` 能退出 0 才算）；
 *   2. 给出「用 node 直接跑 npm-cli.js」的等价调用，供需要绕开坏 shim 的路径使用。
 *
 * 不做猜测式兜底：探测失败就明确返回 null，由调用方把原因说给用户，
 * 而不是悄悄退化成一条必然失败的命令。
 */

/** 探测函数：由调用方注入（宿主命令通道 / 测试中的假实现）。 */
export type NpmProbe = (
	file: string,
	args: readonly string[],
) => Promise<{ exitCode: number | null; stdout: string; stderr: string }>;

export interface NpmRuntime {
	/** 直接可用的 `npx`（PATH 上健康的那条）。 */
	npx: { command: string; prefix: string[] } | null;
	/** `node <npm-cli.js>` 的等价形态；`npm` / `npx` 子命令都走它。 */
	node: { command: string; cli: string } | null;
	/** 给用户看的诊断行；两者都为 null 时说明哪里坏了。 */
	diagnostics: string[];
}

/** 一次探测的结果缓存：同一会话不必反复开进程。 */
let cached: Promise<NpmRuntime> | null = null;

type Probe = NpmProbe;

const PROBE_TIMEOUT_MS = 20_000;
const MAX_DIAGNOSTICS = 4;

function line(text: string): string {
	return text.split(/\r?\n/).map(part => part.trim()).find(Boolean) ?? "";
}

/** Windows 上 `node --version` 之外的候选 npm-cli 位置，按「最可能装过」排序。 */
function npmCliCandidates(nodeExe: string): string[] {
	const dir = nodeExe.replace(/[\\/][^\\/]+$/, "");
	const candidates = [
		// 当前运行时自带（22.22.x 及更早的发行版有）
		`${dir}/node_modules/npm/bin/npm-cli.js`,
		// POSIX 发行版布局
		`${dir}/lib/node_modules/npm/bin/npm-cli.js`,
	];
	const programFiles = process.env.ProgramFiles;
	if (programFiles) candidates.push(`${programFiles.replace(/\\/g, "/")}/nodejs/node_modules/npm/bin/npm-cli.js`);
	const appData = process.env.APPDATA;
	if (appData) candidates.push(`${appData.replace(/\\/g, "/")}/npm/node_modules/npm/bin/npm-cli.js`);
	return candidates;
}

async function probe(probeFn: Probe, file: string, args: readonly string[]): Promise<Awaited<ReturnType<Probe>> | null> {
	try {
		return await probeFn(file, args);
	} catch {
		return null;
	}
}

/**
 * 探测顺序：
 *   1. PATH 上的 `npx --version`（健康就够用）；
 *   2. `node <npm-cli>`：进程内的 node 位置 + 常见安装位置（用 `node --version` 确认可执行）。
 * 只返回**实测通过**的通道；一次都没通过时 diagnostics 里带着第一条失败输出。
 */
export async function resolveNpmRuntime(probeFn: Probe): Promise<NpmRuntime> {
	const diagnostics: string[] = [];

	const npxProbe = await probe(probeFn, "npx", ["--version"]);
	if (npxProbe && npxProbe.exitCode === 0) {
		return { npx: { command: "npx", prefix: [] }, node: await findNodeCli(probeFn, diagnostics), diagnostics };
	}
	if (npxProbe) {
		const reason = line(npxProbe.stderr) || line(npxProbe.stdout) || `exit ${npxProbe.exitCode}`;
		diagnostics.push(`npx 不可用：${reason.slice(0, 200)}`);
	} else {
		diagnostics.push("npx 无法启动（PATH 上没有可执行文件，或 shim 指向缺失的 npm-cli.js）");
	}

	const node = await findNodeCli(probeFn, diagnostics);
	if (node) return { npx: null, node, diagnostics };

	for (const candidate of npmCliCandidates(process.execPath)) {
		const result = await probe(probeFn, process.execPath, [candidate, "--version"]);
		if (result && result.exitCode === 0) {
			return { npx: null, node: { command: process.execPath, cli: candidate }, diagnostics };
		}
	}
	diagnostics.push("没有找到可用的 npm-cli.js：Node 运行时可能缺少 npm 组件");
	return { npx: null, node: null, diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS) };
}

async function findNodeCli(probeFn: Probe, diagnostics: string[]): Promise<NpmRuntime["node"]> {
	for (const candidate of npmCliCandidates(process.execPath)) {
		const result = await probe(probeFn, process.execPath, [candidate, "--version"]);
		if (result && result.exitCode === 0) return { command: process.execPath, cli: candidate };
	}
	return null;
}

/** 会话级缓存：传同一个 probe 只探测一次。 */
export function npmRuntimeOnce(probeFn: Probe): Promise<NpmRuntime> {
	cached ??= resolveNpmRuntime(probeFn).catch(() => ({
		npx: null,
		node: null,
		diagnostics: ["探测 npm 运行时失败"],
	}));
	return cached;
}

/** 测试用：清掉缓存。 */
export function resetNpmRuntimeCache(): void {
	cached = null;
}

export { PROBE_TIMEOUT_MS };
