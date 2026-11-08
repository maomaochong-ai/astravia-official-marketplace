import type { PluginContext, PluginModelProviderConfig } from "@astravia-org/plugin-sdk";
import {
	consoleUrl,
	DEFAULT_SETTINGS,
	loadSettings,
	normalizeApiKey,
	normalizeBaseUrl,
	providerBaseUrl,
	saveSettings,
	type MagpieSettings,
} from "./gateway-endpoint";
import { FAILURE_KEYS, loadModels, probeGateway, type GatewayFailure } from "./gateway-client";
import { summarizeCatalog, toModelDefinitions, type CatalogSummary, type MagpieModelRow } from "./model-catalog";
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID, VIEW_ID } from "./plugin-ids";

/**
 * 相位：
 * - idle  还没检测过
 * - probing 正在探
 * - online  /api/version 答了 magpie
 * - offline 探不到（failure 说明原因）
 */
export type GatewayPhase = "idle" | "probing" | "online" | "offline";

export interface MagpieState {
	phase: GatewayPhase;
	endpoint: string;
	version?: string;
	rows: MagpieModelRow[];
	summary: CatalogSummary;
	failure?: GatewayFailure;
	/** 非空 = 视图要显示的错误文案 key。 */
	messageKey?: string;
	/** 已经写进宿主模型注册表的模型数；undefined = 没发布过（本次会话）。 */
	publishedCount?: number;
	publishedAt?: number;
	busy: boolean;
}

export type MagpieStateListener = (state: MagpieState) => void;

const EMPTY_SUMMARY: CatalogSummary = { total: 0, providers: [], imageCount: 0, reasoningCount: 0 };

/**
 * 这个控制器只做三件事：探网关、读目录、把目录按用户点击写进宿主模型注册表。
 * 它不启动、不停止、不安装 magpie —— 上游是用户已经装好的外部程序。
 */
export class GatewayController {
	private readonly ctx: PluginContext;
	private readonly listeners = new Set<MagpieStateListener>();
	private settings: MagpieSettings = { ...DEFAULT_SETTINGS };
	private state: MagpieState = {
		phase: "idle",
		endpoint: DEFAULT_SETTINGS.baseUrl,
		rows: [],
		summary: EMPTY_SUMMARY,
		busy: false,
	};
	private operationInFlight = false;
	private disposed = false;

	constructor(ctx: PluginContext) {
		this.ctx = ctx;
	}

	getState(): MagpieState {
		return this.state;
	}

	getSettings(): MagpieSettings {
		return this.settings;
	}

	subscribe(listener: MagpieStateListener): { dispose(): void } {
		this.listeners.add(listener);
		return {
			dispose: () => {
				this.listeners.delete(listener);
			},
		};
	}

	private setState(patch: Partial<MagpieState>): void {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.state);
		this.applyBadge();
	}

	/** 侧边栏徽标：在线一个点，探不到一个警示点，其余不挂。 */
	private applyBadge(): void {
		const badge =
			this.state.phase === "online"
				? ({ kind: "dot", tone: "accent" } as const)
				: this.state.phase === "offline"
					? ({ kind: "dot", tone: "danger" } as const)
					: null;
		try {
			this.ctx.ui.setWorkspaceViewBadge(VIEW_ID, badge);
		} catch {
			// 徽标是装饰，失败不改变任何业务结果
		}
	}

	/** activate 时调用：读设置、立刻探一次。 */
	async hydrate(): Promise<void> {
		if (this.disposed) return;
		this.settings = await loadSettings(this.ctx.storage).catch(() => ({ ...DEFAULT_SETTINGS }));
		this.setState({ endpoint: this.settings.baseUrl });
		await this.refresh();
	}

	/** 探网关 + 读目录。任何一步失败都只把原因写进 state，不抛给调用方。 */
	async refresh(): Promise<void> {
		if (this.disposed || this.operationInFlight) return;
		this.operationInFlight = true;
		this.setState({ phase: "probing", busy: true, messageKey: undefined, failure: undefined });
		try {
			const probe = await probeGateway(this.ctx.network, this.settings);
			if (!probe.ok) {
				this.setState({
					phase: "offline",
					failure: probe.failure,
					messageKey: FAILURE_KEYS[probe.failure],
					rows: [],
					summary: EMPTY_SUMMARY,
					version: undefined,
				});
				return;
			}
			const list = await loadModels(this.ctx.network, this.settings);
			if (!list.ok) {
				// 网关活着但目录读不出来：仍然算在线（探针答了），错误单独说明。
				this.setState({
					phase: "online",
					version: probe.version,
					failure: list.failure,
					messageKey: FAILURE_KEYS[list.failure],
					rows: [],
					summary: EMPTY_SUMMARY,
				});
				return;
			}
			this.setState({
				phase: "online",
				version: probe.version,
				failure: undefined,
				messageKey: undefined,
				rows: list.rows,
				summary: summarizeCatalog(list.rows),
			});
		} finally {
			this.operationInFlight = false;
			this.setState({ busy: false });
		}
	}

	/** 保存连接设置：规范化后落盘，再按新地址重探。 */
	async updateSettings(patch: Partial<MagpieSettings>): Promise<void> {
		this.settings = {
			baseUrl: normalizeBaseUrl(patch.baseUrl ?? this.settings.baseUrl),
			apiKey: normalizeApiKey(patch.apiKey ?? this.settings.apiKey),
		};
		await saveSettings(this.ctx.storage, this.settings).catch(() => undefined);
		this.setState({ endpoint: this.settings.baseUrl });
		await this.refresh();
	}

	/** 当前目录能写成的 provider 配置；空目录返回 null（不写空表，防误删）。 */
	private providerConfig(displayName: string): PluginModelProviderConfig | null {
		const models = toModelDefinitions(this.state.rows);
		if (models.length === 0) return null;
		return {
			baseUrl: providerBaseUrl(this.settings.baseUrl),
			apiKey: this.settings.apiKey,
			api: "openai-completions",
			displayName,
			models,
		};
	}

	/**
	 * 发布到 Astravia：先读回宿主当前持有的配置，再整表替换。
	 * 显示名沿用用户改过的那个（回读可能是用户自己改的名字），凭据永远写新值。
	 */
	async publish(): Promise<boolean> {
		if (this.disposed || this.operationInFlight) return false;
		this.operationInFlight = true;
		this.setState({ busy: true });
		try {
			if (this.state.rows.length === 0) {
				this.setState({ messageKey: "error.emptyModels" });
				return false;
			}
			const owned = await this.ctx.models
				.listOwnedProviders()
				.catch((): Record<string, PluginModelProviderConfig> => ({}));
			const existing = owned?.[PROVIDER_ID];
			const displayName = existing?.displayName?.trim() ? existing.displayName : PROVIDER_DISPLAY_NAME;
			const config = this.providerConfig(displayName);
			if (!config) {
				this.setState({ messageKey: "error.emptyModels" });
				return false;
			}
			await this.ctx.models.replaceOwnedProviders({ [PROVIDER_ID]: config });
			this.setState({
				messageKey: undefined,
				publishedCount: config.models?.length ?? 0,
				publishedAt: Date.now(),
			});
			return true;
		} catch (error) {
			this.setState({ messageKey: "error.syncFailed" });
			void this.notifyError(error);
			return false;
		} finally {
			this.operationInFlight = false;
			this.setState({ busy: false });
		}
	}

	/** 从 Astravia 摘掉本插件写过的 provider；宿主按 id 删除。 */
	async disconnect(): Promise<boolean> {
		if (this.disposed || this.operationInFlight) return false;
		this.operationInFlight = true;
		this.setState({ busy: true });
		try {
			await this.ctx.models.replaceOwnedProviders({});
			this.setState({ publishedCount: undefined, publishedAt: undefined, messageKey: undefined });
			return true;
		} catch (error) {
			this.setState({ messageKey: "error.syncFailed" });
			void this.notifyError(error);
			return false;
		} finally {
			this.operationInFlight = false;
			this.setState({ busy: false });
		}
	}

	/** 打开 magpie 自己的页面（登录提供方、加 key、看用量都在那边）。 */
	async openConsole(): Promise<void> {
		await this.ctx.ui.openExternal(consoleUrl(this.settings.baseUrl));
	}

	/** notify 是尽力而为的提示，失败不影响主流程结果。 */
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

	async dispose(): Promise<void> {
		this.disposed = true;
		this.listeners.clear();
	}
}
