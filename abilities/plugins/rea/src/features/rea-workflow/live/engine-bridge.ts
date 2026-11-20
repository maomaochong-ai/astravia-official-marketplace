/**
 * REA CLI 通道的桥接层：把「插件想跑的 rea 子命令」变成宿主真正能执行的调用。
 *
 * 为什么需要这一层：`plugin.json#providers.cli` 声明的命令是 `npx`，宿主
 * `cliProviders.run` 只把 provider 命令和调用方给的参数拼起来，**不追加包名**。
 * 所以调用方只写 `["doctor", "--json"]` 时，宿主执行的是 `npx doctor --json` ——
 * npm exec 找不到名为 doctor 的包，回落到 shell，得到 `sh: doctor: command not found`。
 * 面板上表现为「检查没有返回任何项目」，而引擎其实完全正常。
 *
 * 收口点放在这里而不是每个调用方：`-y rea-agents@6.7.0` 只拼一次，
 * doctor / setup / 以及后续任何子命令都不会再各写一遍。
 */

import type {
	Disposable,
	PluginCliProviderStatus,
	PluginCommandRunOptions,
	PluginCommandRunResult,
	PluginCommandSpawnHandle,
	PluginCommandSpawnOptions,
} from "@astravia-org/plugin-sdk";

/** npx 需要的前缀：允许首次运行自动确认，并始终取最新发布的 CLI。 */
export const REA_PACKAGE_ARGS: readonly string[] = ["-y", "rea-agents@6.7.0"];

/**
 * 给 rea 子命令补上包名前缀。已经自带前缀时原样返回，避免二次调用叠成
 * `npx -y rea-agents@6.7.0 -y rea-agents@6.7.0 doctor`。
 */
export function reaPackageArgs(args: readonly string[]): string[] {
	if (args[0] === "-y" && args[1] === "rea-agents@6.7.0") return [...args];
	if (args[0] === "rea-agents@6.7.0" || args[0] === "rea-agents") return [...REA_PACKAGE_ARGS, ...args.slice(1)];
	return [...REA_PACKAGE_ARGS, ...args];
}

/** 面板与 Agent 工具共用的 doctor 调用。 */
export function doctorArgs(refresh?: boolean): string[] {
	const args = ["doctor", "--json"];
	if (refresh === true) args.push("--refresh");
	return args;
}

/** tab 组件需要的 provider 能力；宿主没有的通道（旧版无 spawn）以 null 表达。 */
export interface ReaProviderBridge {
	getStatus(): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): Disposable;
	retry(): Promise<void>;
	/** 参数是 rea 子命令，包名前缀由桥接层补齐。 */
	run(args: readonly string[], options: { cwd?: string; timeoutMs?: number }): Promise<PluginCommandRunResult>;
	spawn: ((args: readonly string[], options: { cwd?: string }) => Promise<PluginCommandSpawnHandle>) | null;
	/** npm 运行时诊断（provider 不可用时的原因）；没有兜底通道时为 undefined。 */
	diagnostics?: (() => Promise<readonly string[]>) | undefined;
}

/** 桥接层依赖的宿主任意子集，便于在测试里替换成假实现。 */

/** provider 通道不可用时的等价执行路径（`node <npm-cli.js> exec …`）。 */
export interface ReaNpmFallback {
	run(args: readonly string[], options?: { cwd?: string; timeoutMs?: number }): Promise<PluginCommandRunResult>;
	/** 长驻进程（一键安装要看得见过程、停得下来）。 */
	spawn?(args: readonly string[], options?: { cwd?: string }): Promise<PluginCommandSpawnHandle>;
	/** 给界面看的诊断行。 */
	diagnostics?(): Promise<readonly string[]>;
}

export interface ReaCliSource {
	getStatus(providerId: string): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): Disposable;
	retry(providerId: string): Promise<void>;
	run(providerId: string, args?: string[], options?: PluginCommandRunOptions): Promise<PluginCommandRunResult>;
	spawn?(providerId: string, args?: string[], options?: PluginCommandSpawnOptions): Promise<PluginCommandSpawnHandle>;
}

/**
 * npm 组件缺失的可识别特征：22.23.5 运行时不再自带 npm，PATH 上的 npx shim 会直指
 * 不存在的 `npm-cli.js`。这两种输出要当成「运行时坏了」，而不是「REA 没装好」。
 */
export const NPM_MISSING_PATTERN = /npm-cli\.js|npx-cli\.js|Cannot find module .*node_modules[\\/]npm\b|npx.*ENOENT/i;

export function looksLikeMissingNpm(result: { exitCode: number | null; stdout: string; stderr: string }): boolean {
	if (result.exitCode === 0) return false;
	return NPM_MISSING_PATTERN.test(`${result.stderr}\n${result.stdout}`);
}

export function createReaProviderBridge(source: ReaCliSource, providerId: string, fallback?: ReaNpmFallback): ReaProviderBridge {
	// 旧宿主可能还没有 spawn（长驻进程通道）：探测不到就整条通道为 null，
	// 面板退回只给可复制命令，而不是给一个点了报错的按钮。
	const spawnCli = typeof source.spawn === "function" ? source.spawn.bind(source) : null;

	/** provider 通道失败且原因是 npm 缺失时，用 `node <npm-cli.js> exec` 重跑一次。 */
	const runWithFallback = async (
		runProvider: () => Promise<PluginCommandRunResult>,
		args: readonly string[],
		options?: { cwd?: string; timeoutMs?: number },
	): Promise<PluginCommandRunResult> => {
		try {
			const result = await runProvider();
			if (fallback && looksLikeMissingNpm(result)) return fallback.run(args, options);
			return result;
		} catch (error) {
			if (!fallback) throw error;
			return fallback.run(args, options);
		}
	};

	return {
		getStatus: () => source.getStatus(providerId),
		onStatusChanged: (listener) =>
			source.onStatusChanged((status) => {
				if (status.providerId === providerId) listener(status);
			}),
		retry: () => source.retry(providerId),
		run: (args, options) => runWithFallback(() => source.run(providerId, reaPackageArgs(args), options), args, options),
		// 一键安装走 spawn：provider 通道抛错时（npx shim 指向缺失的 npm-cli.js）
		// 用 `node <npm-cli.js> exec …` 重试，否则安装按钮会一直失败。
		spawn:
			spawnCli === null && !fallback?.spawn
				? null
				: async (args, options) => {
						if (spawnCli) {
							try {
								return await spawnCli(providerId, reaPackageArgs(args), options);
							} catch (error) {
								if (!fallback?.spawn) throw error;
							}
						}
						if (!fallback?.spawn) throw new Error("spawn 通道不可用");
						return fallback.spawn(args, options);
					},
		diagnostics: fallback?.diagnostics,
	};
}
