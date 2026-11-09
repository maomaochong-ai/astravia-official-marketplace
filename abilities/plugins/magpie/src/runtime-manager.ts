import type { PluginCommandApi, PluginCommandSpawnHandle, PluginNetworkApi, PluginStorageApi } from "@astravia-org/plugin-sdk";
import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import {
	classifyCommandError,
	installScript,
	lastLine,
	parseHostTarget,
	parseProbe,
	pickReleaseAsset,
	probeScript,
	RELEASE_FEED_URL,
	startScript,
	type ReleaseAsset,
} from "./gateway-runtime";

/**
 * 面板上的「安装并启动」到底做了什么：
 *
 * 1. 探二进制（`$HOME/.local/bin/magpie`，退到 PATH 上的 magpie）；
 * 2. 没有就去官网发布接口要清单，挑本平台的 `magpie-cli-*`，下载并复核 sha256，
 *    装到 `$HOME/.local/bin/magpie`；
 * 3. 用宿主的 spawn 跑 `magpie serve`（子进程、独立进程组、随插件卸载与 App 退出被回收），
 *    端口跟面板里的地址一致（`MAGPIE_ADDR`）。
 *
 * 边界：不 sudo、不写 /Applications、不改用户 PATH、不装开机服务。长期常驻是上游
 * 自己的事（`magpie daemon install`），面板只说明，不代劳。
 */

export type RuntimePhase = "unknown" | "checking" | "absent" | "downloading" | "starting" | "running" | "stopped" | "failed";

export interface RuntimeState {
	phase: RuntimePhase;
	/** 二进制实际位置（PATH 上找到的可能是别处的）。 */
	binPath?: string;
	version?: string;
	pid?: number;
	/** 面板要显示的提示 key。 */
	messageKey?: string;
	/** 最近一行输出或错误原文（截断）。 */
	detail?: string;
	/** 清单里当前发布版本，用于「装的是不是最新」。 */
	releaseVersion?: string;
	/** 用户希望它运行（落盘），下次加载时据此自动拉起。 */
	desiredRunning: boolean;
}

const STATE_PATH = "runtime.json";
const INSTALL_BUDGET_MS = 45 * 60_000;
const POLL_INTERVAL_MS = 1_200;
const PROBE_BUDGET_MS = 15_000;
/** 启动后等网关可用的时间：第一次启动要读配置，给 10 秒。 */
const START_GRACE_MS = 10_000;

interface RuntimeFile {
	desiredRunning?: boolean;
}

export interface RuntimeDeps {
	command: PluginCommandApi;
	network: PluginNetworkApi;
	storage: PluginStorageApi;
	/** 面板里的网关地址，用来对齐 `MAGPIE_ADDR`。 */
	endpoint: () => string;
	/** 状态变了（UI 重渲染 + 重新探网关）。 */
	onChanged: (state: RuntimeState) => void;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 本机回环地址才注入 MAGPIE_ADDR：远端 magpie 不该被本地面板的端口影响。 */
export function loopbackAddress(endpoint: string): string | undefined {
	try {
		const url = new URL(endpoint);
		if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(url.hostname)) return undefined;
		return url.port ? `${url.hostname}:${url.port}` : undefined;
	} catch {
		return undefined;
	}
}

export class RuntimeManager {
	private readonly deps: RuntimeDeps;
	private state: RuntimeState = { phase: "unknown", desiredRunning: false };
	private handle: PluginCommandSpawnHandle | null = null;
	private stoppedByUser = false;
	private operationInFlight = false;
	private disposed = false;

	constructor(deps: RuntimeDeps) {
		this.deps = deps;
	}

	getState(): RuntimeState {
		return this.state;
	}

	private set(patch: Partial<RuntimeState>): void {
		this.state = { ...this.state, ...patch };
		if (!this.disposed) this.deps.onChanged(this.state);
	}

	/** 读回「用户希望它运行」，再探一次二进制。 */
	async hydrate(): Promise<void> {
		const saved = await readJsonFile(this.deps.storage, STATE_PATH).catch(() => undefined);
		const desiredRunning = Boolean((saved as RuntimeFile | undefined)?.desiredRunning);
		this.set({ desiredRunning });
		await this.probeBinary();
	}

	private async persist(): Promise<void> {
		await writeJsonFile(this.deps.storage, STATE_PATH, { desiredRunning: this.state.desiredRunning }).catch(() => undefined);
	}

	/** 只看二进制在不在：`sh` 被禁时把原因说清楚，不假装「没装」。 */
	async probeBinary(): Promise<boolean> {
		this.set({ phase: this.state.phase === "running" ? "running" : "checking", messageKey: undefined });
		try {
			const result = await this.deps.command.run("sh", ["-c", probeScript()], { timeoutMs: PROBE_BUDGET_MS });
			const probe = parseProbe(result.stdout, result.exitCode);
			if (!probe.installed) {
				this.set({ phase: this.state.phase === "running" ? "running" : "absent", binPath: undefined, version: undefined });
				return false;
			}
			this.set({
				phase: this.state.phase === "running" ? "running" : "stopped",
				binPath: probe.path,
				version: probe.version,
			});
			return true;
		} catch (error) {
			const denial = classifyCommandError(error);
			this.set({
				phase: "failed",
				messageKey: denial === "denied" ? "runtime.denied" : "runtime.failed",
				detail: lastLine(error instanceof Error ? error.message : String(error)),
			});
			return false;
		}
	}

	/** 取发布清单并挑本平台资产；失败返回 null 并写好 messageKey。 */
	private async resolveAsset(): Promise<ReleaseAsset | null> {
		let target;
		try {
			const uname = await this.deps.command.run("sh", ["-c", "uname -s; uname -m"], { timeoutMs: PROBE_BUDGET_MS });
			target = parseHostTarget(uname.stdout);
		} catch (error) {
			const denial = classifyCommandError(error);
			const raw = error instanceof Error ? error.message : String(error);
			// 连 `sh` 都没有（Windows）：这不是「装失败」，而是这里没有可走的路。
			const noShell = /enoent|not found/i.test(raw);
			this.set({
				phase: "failed",
				messageKey: denial === "denied" ? "runtime.denied" : noShell ? "runtime.unsupported" : "runtime.failed",
				detail: lastLine(raw),
			});
			return null;
		}
		if (!target) {
			this.set({ phase: "failed", messageKey: "runtime.unsupported" });
			return null;
		}
		let feed: unknown;
		try {
			const response = await this.deps.network.request<unknown>({
				url: RELEASE_FEED_URL,
				method: "GET",
				responseType: "json",
				timeoutMs: 20_000,
			});
			if (!response.ok) {
				this.set({ phase: "failed", messageKey: "runtime.feedFailed", detail: `HTTP ${response.status}` });
				return null;
			}
			feed = response.body;
		} catch (error) {
			this.set({
				phase: "failed",
				messageKey: "runtime.feedFailed",
				detail: lastLine(error instanceof Error ? error.message : String(error)),
			});
			return null;
		}
		const asset = pickReleaseAsset(feed, target);
		if (!asset) {
			this.set({ phase: "failed", messageKey: "runtime.unsupported" });
			return null;
		}
		this.set({ releaseVersion: asset.version });
		return asset;
	}

	/** 安装（已装则直接成功）。安装本身就是一次 spawn，好让面板能显示最后一行输出。 */
	async install(): Promise<boolean> {
		if (this.operationInFlight || this.disposed) return false;
		this.operationInFlight = true;
		this.set({ phase: "downloading", messageKey: undefined, detail: undefined });
		try {
			if (await this.probeBinary()) return true;
			const asset = await this.resolveAsset();
			if (!asset) return false;
			const handle = await this.deps.command.spawn("sh", ["-c", installScript(asset)]);
			const outcome = await this.waitForExit(handle, INSTALL_BUDGET_MS);
			if (outcome.exitCode !== 0) {
				this.set({
					phase: "failed",
					messageKey: "runtime.installFailed",
					detail: lastLine(outcome.output) ?? (outcome.exitCode === null ? "timeout" : `exit ${outcome.exitCode}`),
				});
				return false;
			}
			const installed = await this.probeBinary();
			if (installed) this.set({ releaseVersion: asset.version });
			return installed;
		} catch (error) {
			const denial = classifyCommandError(error);
			this.set({
				phase: "failed",
				messageKey: denial === "denied" ? "runtime.denied" : "runtime.installFailed",
				detail: lastLine(error instanceof Error ? error.message : String(error)),
			});
			return false;
		} finally {
			this.operationInFlight = false;
		}
	}

	/** 启动网关；返回是否真的跑起来了（等第一次可探通）。 */
	async start(): Promise<boolean> {
		if (this.operationInFlight || this.disposed) return false;
		if (this.handle) return true;
		this.operationInFlight = true;
		this.stoppedByUser = false;
		this.set({ phase: "starting", messageKey: undefined, detail: undefined });
		try {
			const address = loopbackAddress(this.deps.endpoint());
			// 用探针读到的路径：用户在 ~/bin 里已有的那份也能启，不必只认插件安装位
			const handle = await this.deps.command.spawn("sh", ["-c", startScript(this.state.binPath)], {
				env: address ? { MAGPIE_ADDR: address } : undefined,
			});
			this.handle = handle;
			handle.onExit((exit) => {
				if (this.disposed || this.stoppedByUser) return;
				this.handle = null;
				this.set({
					phase: "failed",
					pid: undefined,
					messageKey: "runtime.exited",
					detail: exit.exitCode === null ? String(exit.signal ?? "") : `exit ${exit.exitCode}`,
				});
			});
			this.set({ phase: "running", pid: handle.pid, desiredRunning: true });
			await this.persist();
			return true;
		} catch (error) {
			const denial = classifyCommandError(error);
			this.set({
				phase: "failed",
				messageKey: denial === "denied" ? "runtime.denied" : "runtime.startFailed",
				detail: lastLine(error instanceof Error ? error.message : String(error)),
			});
			return false;
		} finally {
			this.operationInFlight = false;
		}
	}

	/** 停止：宿主的 stop 先 SIGTERM 再 SIGKILL 整棵进程树。 */
	async stop(): Promise<void> {
		const handle = this.handle;
		this.handle = null;
		this.stoppedByUser = true;
		this.set({ phase: "stopped", pid: undefined, desiredRunning: false, messageKey: undefined, detail: undefined });
		await this.persist();
		if (handle) await handle.stop().catch(() => undefined);
	}

	/** 一个按钮的全部：装（若需要）+ 启动。 */
	async installAndStart(): Promise<boolean> {
		if (this.disposed) return false;
		if (!(await this.probeBinary())) {
			const installed = await this.install();
			if (!installed) return false;
		}
		return this.start();
	}

	/**
	 * 加载时的自愈：用户上次让它在跑、现在探不到网关 → 拉起来。
	 * 刻意只在「用户表达过要它运行」之后执行，不擅自启动一个后台进程。
	 */
	async autostartIfWanted(gatewayOffline: boolean): Promise<void> {
		if (this.disposed || !gatewayOffline) return;
		if (!this.state.desiredRunning || this.handle) return;
		if (this.state.phase !== "stopped") return;
		await this.start();
	}

	private async waitForExit(
		handle: PluginCommandSpawnHandle,
		budgetMs: number,
	): Promise<{ exitCode: number | null; output: string }> {
		const deadline = Date.now() + budgetMs;
		let output = "";
		while (Date.now() < deadline) {
			const status = await handle.status().catch(() => null);
			if (status) {
				output = status.recentOutput || output;
				const line = lastLine(output);
				if (line) this.set({ detail: line });
				if (!status.running) return { exitCode: status.exit?.exitCode ?? null, output };
			}
			await sleep(POLL_INTERVAL_MS);
		}
		await handle.stop().catch(() => undefined);
		return { exitCode: null, output };
	}

	/** 启动后等网关自答；超时不算失败（服务可能只是慢），由探针给最终结论。 */
	async waitForGateway(canReach: () => Promise<boolean>): Promise<boolean> {
		const deadline = Date.now() + START_GRACE_MS;
		while (Date.now() < deadline) {
			if (await canReach()) return true;
			await sleep(600);
		}
		return false;
	}

	async dispose(): Promise<void> {
		this.disposed = true;
		const handle = this.handle;
		this.handle = null;
		if (handle) await handle.stop().catch(() => undefined);
	}
}
