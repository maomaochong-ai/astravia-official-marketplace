import type { PluginContext, PluginServiceStatus } from "@astravia-org/plugin-sdk";
import {
	ARTIFACT_DESTINATION,
	baseUrlForProvider,
	buildProviderConfig,
	GatewayPhase,
	parseForwardKey,
	parseModelRows,
	phaseFromServiceStatus,
	PROVIDER_ID,
	reconcileProviders,
	SERVICE_ID,
	SERVER_ZIP_PATH,
	toModelDefinitions,
} from "./service-adapter";
import { DEFAULT_GATEWAY_SETTINGS, GatewaySettings, loadGatewaySettings, saveGatewaySettings } from "./settings";

export { VIEW_ID } from "./view-id";

export interface GatewayState {
	phase: GatewayPhase;
	/** 服务真实地址（含端口），ready 后由 connection() 提供。 */
	baseUrl?: string;
	/** i18n key：安装/启动/同步失败的错误文案（phase=error 或同步失败时）。 */
	messageKey?: string;
	/** 最近一次成功同步的模型数。 */
	modelCount?: number;
	syncedAt?: number;
	/** 安装/启动/停止/同步操作进行中（按钮禁用依据）。 */
	busy: boolean;
}

export type GatewayStateListener = (state: GatewayState) => void;

/** 轮询等待服务 ready 的上限：宿主健康检查 45s + 安装后首启余量。 */
const READY_TIMEOUT_MS = 90_000;
const READY_POLL_INTERVAL_MS = 500;

export class GatewayController {
	private readonly ctx: PluginContext;
	private readonly listeners = new Set<GatewayStateListener>();
	private state: GatewayState = { phase: "idle", busy: false };
	private settings: GatewaySettings = { ...DEFAULT_GATEWAY_SETTINGS };
	private statusDisposable: { dispose(): void } | undefined;
	private operationInFlight = false;
	private syncInFlight = false;
	private lastSyncedBaseUrl: string | undefined;
	private disposed = false;

	constructor(ctx: PluginContext) {
		this.ctx = ctx;
	}

	getState(): GatewayState {
		return this.state;
	}

	subscribe(listener: GatewayStateListener): { dispose(): void } {
		this.listeners.add(listener);
		return {
			dispose: () => {
				this.listeners.delete(listener);
			},
		};
	}

	private setState(patch: Partial<GatewayState>): void {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.state);
	}

	private fail(messageKey: string): void {
		this.setState({ phase: "error", messageKey, busy: false });
	}

	/** activate 时调用：加载设置、订阅服务状态、按需自启。 */
	async ensureLoaded(): Promise<void> {
		if (this.disposed) return;
		this.settings = await loadGatewaySettings(this.ctx.storage).catch(() => ({ ...DEFAULT_GATEWAY_SETTINGS }));
		this.statusDisposable?.dispose();
		this.statusDisposable = this.ctx.services.onStatusChange((status) => {
			void this.handleStatusChange(status);
		});
		const status = await this.ctx.services.getStatus(SERVICE_ID).catch(() => undefined);
		if (status) {
			const phase = phaseFromServiceStatus(status);
			if (phase === "running") {
				// 激活时服务已 ready（如渲染层刷新重挂插件）：状态回填走 applyReady，
				// 顺带驱动一次模型同步——宿主重启后端口可能已变，注册表里的
				// baseUrl 需要重新对账。
				this.applyReady();
			} else {
				this.setState({
					phase,
					messageKey: status.phase === "failed" ? "error.serviceFailed" : undefined,
				});
			}
		}
		if (this.settings.autoStart && status && (status.phase === "stopped" || status.phase === "disabled")) {
			void this.ensureRunning();
		}
	}

	getSettings(): GatewaySettings {
		return this.settings;
	}

	async updateSettings(settings: GatewaySettings): Promise<void> {
		this.settings = { autoStart: settings.autoStart === true };
		await saveGatewaySettings(this.ctx.storage, this.settings).catch(() => undefined);
	}

	/** 服务状态是唯一相位权威；ready 时自动同步模型（覆盖宿主侧重启后端口变化）。 */
	private async handleStatusChange(status: { serviceId: string; phase: string; message?: string }): Promise<void> {
		if (this.disposed || status.serviceId !== SERVICE_ID) return;
		const phase = phaseFromServiceStatus(status as never);
		if (phase === "running") {
			this.applyReady();
			return;
		}
		if (phase === "error") {
			this.setState({ phase, messageKey: "error.serviceFailed", busy: false });
			return;
		}
		this.setState({ phase, busy: phase === "installing" || phase === "starting" || phase === "stopping" });
	}

	/**
	 * ready 的唯一落点：宿主状态推送与 ensureRunning 自身的返回都走这里。
	 * 不依赖推送时序——否则订阅晚于 start() 时视图会永远停在「启动中」。
	 */
	private applyReady(): void {
		if (this.disposed) return;
		this.setState({ phase: "running", messageKey: undefined, busy: false });
		if (!this.syncInFlight) void this.syncModels();
	}

	/** 安装（如需）→ 启动 → 等 ready。ready 后的模型同步由状态订阅驱动。 */
	async ensureRunning(): Promise<void> {
		if (this.disposed || this.operationInFlight) return;
		this.operationInFlight = true;
		this.setState({ busy: true });
		try {
			let status = await this.ctx.services.getStatus(SERVICE_ID);
			if (status.phase === "ready") {
				this.applyReady();
				return;
			}
			if (!status.installed) {
				this.setState({ phase: "installing" });
				const data = await this.fetchArtifactBase64();
				status = await this.ctx.services.install(SERVICE_ID, [
					{ destination: ARTIFACT_DESTINATION, data },
				]);
			}
			if (status.phase !== "ready") {
				this.setState({ phase: "starting" });
				status = await this.ctx.services.start(SERVICE_ID);
			}
			status = await this.waitForReady();
			if (status.phase !== "ready") {
				this.fail("error.startFailed");
				return;
			}
			this.applyReady();
		} catch (error) {
			this.fail("error.installFailed");
			void this.notifyError(error);
		} finally {
			this.operationInFlight = false;
			this.setState({ busy: false });
		}
	}

	private async waitForReady(): Promise<PluginServiceStatus> {
		const deadline = Date.now() + READY_TIMEOUT_MS;
		for (;;) {
			const status = await this.ctx.services.getStatus(SERVICE_ID);
			if (status.phase === "ready" || status.phase === "failed" || status.phase === "stopped") {
				return status;
			}
			if (Date.now() >= deadline) return status;
			await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
		}
	}

	/** 拉取包内 server zip 并转 base64（宿主 install() 的载荷格式）。 */
	private async fetchArtifactBase64(): Promise<string> {
		const url = `astravia-plugin://${this.ctx.plugin.id}/versions/${this.ctx.plugin.version}/${SERVER_ZIP_PATH}`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to load bundled server archive: ${response.status} ${response.statusText}`);
		}
		const buffer = new Uint8Array(await response.arrayBuffer());
		let binary = "";
		const chunkSize = 0x8000;
		for (let index = 0; index < buffer.length; index += chunkSize) {
			binary += String.fromCharCode(...buffer.subarray(index, index + chunkSize));
		}
		return btoa(binary);
	}

	/** ready → 读 forwardKey → 拉 /v1/models → 对账写宿主模型注册表。 */
	async syncModels(): Promise<boolean> {
		if (this.disposed || this.syncInFlight) return false;
		this.syncInFlight = true;
		try {
			const connection = await this.ctx.services.connection(SERVICE_ID);
			const raw = await this.ctx.services.readDataFile(SERVICE_ID, "settings.json", "utf8");
			const forwardKey = parseForwardKey(raw);
			if (!forwardKey) {
				this.setState({ messageKey: "error.noForwardKey" });
				return false;
			}
			const response = await this.ctx.services.request(SERVICE_ID, {
				path: "/v1/models",
				headers: { authorization: `Bearer ${forwardKey}` },
				responseType: "json",
			});
			if (!response.ok) {
				this.setState({ messageKey: "error.syncFailed" });
				return false;
			}
			const rows = parseModelRows(response.body);
			const next = buildProviderConfig({
				baseUrl: baseUrlForProvider(connection.baseUrl),
				apiKey: forwardKey,
				models: toModelDefinitions(rows),
			});
			const synced = await reconcileProviders(this.ctx.models, next);
			if (!synced) {
				this.setState({ messageKey: "error.emptyModels" });
				return false;
			}
			this.lastSyncedBaseUrl = connection.baseUrl;
			this.setState({
				phase: "running",
				baseUrl: connection.baseUrl,
				messageKey: undefined,
				modelCount: rows.length,
				syncedAt: Date.now(),
			});
			return true;
		} catch (error) {
			this.setState({ messageKey: "error.syncFailed" });
			void this.notifyError(error);
			return false;
		} finally {
			this.syncInFlight = false;
		}
	}

	async stop(): Promise<void> {
		if (this.disposed || this.operationInFlight) return;
		this.operationInFlight = true;
		this.setState({ phase: "stopping", busy: true });
		try {
			await this.ctx.services.stop(SERVICE_ID);
			this.setState({ phase: "idle", messageKey: undefined, busy: false });
		} catch (error) {
			this.fail("error.stopFailed");
			void this.notifyError(error);
		} finally {
			this.operationInFlight = false;
			this.setState({ busy: false });
		}
	}

	/** 打开上游管理 UI（浏览器登录通道、查看 Key 等）。仅 running 时有意义。 */
	async openManagement(): Promise<boolean> {
		const connection = await this.ctx.services.connection(SERVICE_ID).catch(() => undefined);
		if (!connection) return false;
		await this.ctx.ui.openExternal(`${connection.baseUrl.replace(/\/+$/, "")}/`);
		return true;
	}

	async recentOutput(): Promise<string> {
		const status = await this.ctx.services.getStatus(SERVICE_ID).catch(() => undefined);
		return status?.recentOutput ?? "";
	}

	/** notify 是尽力而为的提示（无权限门槛），失败不影响主流程结果。 */
	private async notifyError(error: unknown): Promise<void> {
		try {
			this.ctx.ui.notify({
				message: this.ctx.i18n.t("error.toast"),
				error: error instanceof Error ? error : new Error(String(error)),
			});
		} catch {
			// 通知失败不改变业务流程结果
		}
	}

	/** 侧边栏徽标：运行中/过渡态 accent 圆点，出错 danger 圆点。 */
	navBadge(): { kind: "accent" } | { kind: "danger" } | null {
		switch (this.state.phase) {
			case "running":
			case "installing":
			case "starting":
			case "stopping":
				return { kind: "accent" };
			case "error":
				return { kind: "danger" };
			default:
				return null;
		}
	}

	async dispose(): Promise<void> {
		this.disposed = true;
		this.statusDisposable?.dispose();
		this.statusDisposable = undefined;
		this.listeners.clear();
	}
}
