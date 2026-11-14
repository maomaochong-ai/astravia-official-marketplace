import type { PluginCommandApi, PluginCommandSpawnHandle, PluginNetworkApi, PluginStorageApi } from "@astravia-org/plugin-sdk";
import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import {
	classifyCommandError,
	installScript,
	lastLine,
	parseHostTarget,
	parseProbe,
	parseInstallProgress,
	pickReleaseAsset,
	probeScript,
	RELEASE_FEED_URL,
	startScript,
	type HostTarget,
	type ReleaseAsset,
} from "./gateway-runtime";
import {
	describeShell,
	SHELL_CANDIDATES,
	shellHandshakeScript,
	shellMissing,
	type ShellKind,
	type ShellRunner,
	windowsArchScript,
	windowsInstallScript,
	windowsProbeScript,
	windowsStartScript,
} from "./platform-shell";

/**
 * 面板上的「安装并启动」到底做了什么：
 *
 * 1. 找一条能执行的 shell：`sh`（macOS / Linux）或 `powershell`（Windows）；
 * 2. 探二进制：POSIX 是 `$HOME/.local/bin/magpie`，Windows 是
 *    `%LOCALAPPDATA%\magpie\bin\magpie.exe`，两者都退到 PATH；
 * 3. 没有就去官网发布接口要清单，挑本平台的 `magpie-cli-*`，下载并复核 sha256，装到上面那个位置；
 * 4. 用宿主的 spawn 跑 `magpie serve`（子进程、独立进程组、随插件卸载与 App 退出被回收），
 *    端口跟面板里的地址一致（`MAGPIE_ADDR`）。
 *
 * 0.1.3 只走第 1 步的 `sh`，所以在 Windows 上整条流程在第一步就死了；
 * 现在的失败只会在「两条 shell 都不存在」或「平台真的没有官方构建」时出现。
 *
 * 边界：不 sudo / 不要管理员、不写系统目录、不改用户 PATH、不装开机服务。长期常驻是上游
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
	/** 下载进度（字节）；只在下载/校验阶段有值。 */
	progress?: { downloaded: number; total: number };
	/** 安装子步骤：`verifying` = 字节已下完，正在核对 sha256。 */
	installStep?: "downloading" | "verifying";
	/** 当前阶段开始时刻（毫秒）：面板据此走秒、估算剩余。 */
	phaseStartedAt?: number;
	/** 清单里当前发布版本，用于「装的是不是最新」。 */
	releaseVersion?: string;
	/** 用户希望它运行（落盘），下次加载时据此自动拉起。 */
	desiredRunning: boolean;
	/** 实际在用的执行面（`sh` / `powershell`）；两条都没有时 undefined。诊断里会显示它。 */
	shell?: ShellKind;
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
	/** 解一次、记住：每次操作都重试 `sh` 会白白付一次 ENOENT 与一个错帧。 */
	private shell: ShellRunner | null = null;
	private shellResolved = false;
	private shellAttempt = "";
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

	/**
	 * 找一条能执行的 shell，并把结果记到状态里。
	 *
	 * 顺序：`sh` 先（macOS/Linux 一条就成）。宿主报 ENOENT 就换下一个；报其它错（权限门、
	 * 命令未声明）也继续试，但记下原文——最后会有“两条都不行”时的 detail 可看。
	 */
	private async resolveShell(): Promise<ShellRunner | null> {
		if (this.shellResolved) return this.shell;
		const failures: string[] = [];
		for (const candidate of SHELL_CANDIDATES) {
			try {
				await this.deps.command.run(candidate.command, candidate.args(shellHandshakeScript(candidate.kind)), {
					timeoutMs: 10_000,
				});
				this.shell = candidate;
				this.shellResolved = true;
				this.set({ shell: candidate.kind });
				return candidate;
			} catch (error) {
				const raw = error instanceof Error ? error.message : String(error);
				failures.push(`${candidate.command}: ${lastLine(raw) ?? raw}`);
				// `sh` 不存在是正常的（Windows），不需要特别处理；继续试下一个。
				void shellMissing(error);
			}
		}
		this.shell = null;
		this.shellResolved = true;
		this.shellAttempt = failures.join(" | ");
		return null;
	}

	/** 两条 shell 都没有：把试过什么写进 detail，而不是谎称“平台没有构建”。 */
	private shellFailureDetail(): string {
		return (
			this.shellAttempt ||
			`no shell among ${SHELL_CANDIDATES.map((candidate) => describeShell(candidate)).join(", ")}`
		);
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

	/** 只看二进制在不在：没有 shell 时把原因说清，不假装「没装」。 */
	async probeBinary(options: { keepPhase?: boolean } = {}): Promise<boolean> {
		// keepPhase：安装流程内部的那一探只想知道「在不在」，
		// 不能把相位从「正在下载」打回「还没有 magpie」——面板就凭它显示进度。
		const keepPhase = options.keepPhase === true;
		const idlePhase = (fallback: RuntimePhase): RuntimePhase =>
			this.state.phase === "running" ? "running" : fallback;
		if (!keepPhase) this.set({ phase: idlePhase("checking"), messageKey: undefined });
		const shell = await this.resolveShell();
		if (!shell) {
			this.set({ phase: "failed", messageKey: "runtime.noShell", detail: this.shellFailureDetail() });
			return false;
		}
		try {
			const script = shell.kind === "windows" ? windowsProbeScript() : probeScript();
			const result = await this.deps.command.run(shell.command, shell.args(script), { timeoutMs: PROBE_BUDGET_MS });
			const probe = parseProbe(result.stdout, result.exitCode);
			if (!probe.installed) {
				this.set(
					keepPhase
						? { binPath: undefined, version: undefined }
						: { phase: idlePhase("absent"), binPath: undefined, version: undefined },
				);
				return false;
			}
			this.set(
				keepPhase
					? { binPath: probe.path, version: probe.version }
					: { phase: idlePhase("stopped"), binPath: probe.path, version: probe.version },
			);
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
	private async resolveAsset(shell: ShellRunner): Promise<ReleaseAsset | null> {
		let target: HostTarget | null = null;
		try {
			if (shell.kind === "windows") {
				// Windows 上没有 uname：处理器架构从环境变量读，系统直接就是 windows。
				const arch = await this.deps.command.run(shell.command, shell.args(windowsArchScript()), {
					timeoutMs: PROBE_BUDGET_MS,
				});
				const raw = arch.stdout.trim().toUpperCase();
				const mapped = raw === "AMD64" || raw === "X86_64" ? "amd64" : raw === "ARM64" ? "arm64" : null;
				target = mapped ? { os: "windows", arch: mapped } : null;
			} else {
				const uname = await this.deps.command.run(shell.command, shell.args("uname -s; uname -m"), {
					timeoutMs: PROBE_BUDGET_MS,
				});
				target = parseHostTarget(uname.stdout);
			}
		} catch (error) {
			const denial = classifyCommandError(error);
			const raw = error instanceof Error ? error.message : String(error);
			this.set({
				phase: "failed",
				messageKey: denial === "denied" ? "runtime.denied" : "runtime.failed",
				detail: lastLine(raw),
			});
			return null;
		}
		if (!target) {
			// 真正的「平台未支持」：有 shell、能执行，但认不出架构（不再把「没有 sh」误报成它）
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
		this.set({
			phase: "downloading",
			messageKey: undefined,
			detail: undefined,
			progress: undefined,
			installStep: "downloading",
			phaseStartedAt: Date.now(),
		});
		try {
			// 不改相位：这一探只是「要不要装」，不该把面板从「正在下载」打回「还没有 magpie」
			if (await this.probeBinary({ keepPhase: true })) {
				this.set({ phase: "stopped", progress: undefined, installStep: undefined });
				return true;
			}
			const shell = await this.resolveShell();
			if (!shell) {
				this.set({
					phase: "failed",
					messageKey: "runtime.noShell",
					detail: this.shellFailureDetail(),
					progress: undefined,
					installStep: undefined,
				});
				return false;
			}
			const asset = await this.resolveAsset(shell);
			if (!asset) return false;
			const script = shell.kind === "windows" ? windowsInstallScript(asset) : installScript(asset);
			const handle = await this.deps.command.spawn(shell.command, shell.args(script));
			const outcome = await this.waitForExit(handle, INSTALL_BUDGET_MS, (output) => this.reportInstall(output));
			if (outcome.exitCode !== 0) {
				this.set({
					phase: "failed",
					messageKey: "runtime.installFailed",
					detail: lastLine(outcome.output) ?? (outcome.exitCode === null ? "timeout" : `exit ${outcome.exitCode}`),
					progress: undefined,
					installStep: undefined,
				});
				return false;
			}
			const installed = await this.probeBinary({ keepPhase: true });
			this.set({ progress: undefined, installStep: undefined });
			if (!installed) {
				this.set({ phase: "failed", messageKey: "runtime.installFailed" });
				return false;
			}
			this.set({ phase: "stopped", releaseVersion: asset.version });
			return true;
		} catch (error) {
			const denial = classifyCommandError(error);
			this.set({
				phase: "failed",
				messageKey: denial === "denied" ? "runtime.denied" : "runtime.installFailed",
				detail: lastLine(error instanceof Error ? error.message : String(error)),
				progress: undefined,
				installStep: undefined,
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
		this.set({ phase: "starting", messageKey: undefined, detail: undefined, phaseStartedAt: Date.now() });
		try {
			const address = loopbackAddress(this.deps.endpoint());
			const shell = await this.resolveShell();
			if (!shell) {
				this.set({ phase: "failed", messageKey: "runtime.noShell", detail: this.shellFailureDetail() });
				return false;
			}
			// 用探针读到的路径：用户在 ~/bin 或 LOCALAPPDATA 里已有的那份也能启，不必只认插件安装位。
			const script = shell.kind === "windows" ? windowsStartScript(this.state.binPath) : startScript(this.state.binPath);
			const handle = await this.deps.command.spawn(shell.command, shell.args(script), {
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
		this.set({
			phase: "stopped",
			pid: undefined,
			desiredRunning: false,
			messageKey: undefined,
			detail: undefined,
			progress: undefined,
			installStep: undefined,
		});
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
		onTick?: (output: string) => void,
	): Promise<{ exitCode: number | null; output: string }> {
		const deadline = Date.now() + budgetMs;
		let output = "";
		while (Date.now() < deadline) {
			const status = await handle.status().catch(() => null);
			if (status) {
				output = status.recentOutput || output;
				// lastLine 已经滤掉 `progress …`，这里只剩「真正的一句话」
				const line = lastLine(output);
				if (line) this.set({ detail: line });
				if (onTick) onTick(output);
				if (!status.running) return { exitCode: status.exit?.exitCode ?? null, output };
			}
			await sleep(POLL_INTERVAL_MS);
		}
		await handle.stop().catch(() => undefined);
		return { exitCode: null, output };
	}

	/**
	 * 把安装脚本自己报的字节数搬进状态：没有这一条，一次 70 MB 的下载在面板上
	 * 就是一行不动的日志。只有数字真的变了才通知 UI，避免每秒空转重渲染。
	 */
	private reportInstall(output: string): void {
		const parsed = parseInstallProgress(output);
		const patch: Partial<RuntimeState> = {};
		if (parsed.downloaded !== undefined && parsed.total !== undefined) {
			const current = this.state.progress;
			const changed = !current || current.downloaded !== parsed.downloaded || current.total !== parsed.total;
			if (changed) patch.progress = { downloaded: parsed.downloaded, total: parsed.total };
		}
		const step = parsed.verifying ? "verifying" : "downloading";
		if (this.state.installStep !== step) patch.installStep = step;
		if (Object.keys(patch).length > 0) this.set(patch);
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
