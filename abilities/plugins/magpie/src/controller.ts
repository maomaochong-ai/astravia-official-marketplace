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
import { RuntimeManager, type RuntimeState } from "./runtime-manager";

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
	/**
	 * 网关还有更多模型没一次返回（`has_more`）。面板要说不说：目录不完整时
	 * 「已发布 N 个」是真的，但不是全部。
	 */
	catalogPartial?: boolean;
	/**
	 * 网关这一次到底回了多少条（解析前）。`rows.length === 0 && catalogRawCount > 0`
	 * = 网关有模型但一条都没认出来，面板必须区分「网关没模型」和「我们解析失败」。
	 */
	catalogRawCount?: number;
	/** 失败原文（宿主/网关给的那一句）；非空就原样显示，不藏在 toast 里。 */
	detail?: string;
	/** 已成功但有让步的说明（例如只写入了最小字段）。正常色，不是错误。 */
	notice?: string;
	/** 本机 magpie 二进制的安装/运行状态（面板上的「安装并启动」）。 */
	runtime: RuntimeState;
	busy: boolean;
}

export type MagpieStateListener = (state: MagpieState) => void;

const EMPTY_SUMMARY: CatalogSummary = { total: 0, providers: [], imageCount: 0, reasoningCount: 0 };

/**
 * 这个控制器做四件事：探网关、读目录、把目录按用户点击写进宿主模型注册表，
 * 以及托管本机 magpie 二进制的安装与启动（runtime）。
 * 它不替用户改 PATH、不装开机服务、不动系统目录 —— 见 runtime-manager 的头注释。
 */
export class GatewayController {
	private readonly ctx: PluginContext;
	private readonly runtime: RuntimeManager;
	private readonly listeners = new Set<MagpieStateListener>();
	private settings: MagpieSettings = { ...DEFAULT_SETTINGS };
	private state: MagpieState = {
		phase: "idle",
		endpoint: DEFAULT_SETTINGS.baseUrl,
		rows: [],
		summary: EMPTY_SUMMARY,
		runtime: { phase: "unknown", desiredRunning: false },
		busy: false,
	};
	/** 进行中的探测：并发调用共享同一次（面板轮询 + 用户点按钮）。 */
	private pending: Promise<void> | null = null;
	/** 写注册表的互斥：同一时刻只发一次。 */
	private writing = false;
	private disposed = false;

	constructor(ctx: PluginContext) {
		this.ctx = ctx;
		this.runtime = new RuntimeManager({
			command: ctx.command,
			network: ctx.network,
			storage: ctx.storage,
			endpoint: () => this.settings.baseUrl,
			onChanged: (runtime) => this.setState({ runtime }),
		});
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

	/** activate 时调用：读设置、看二进制在不在、立刻探一次；用户上次让它跑就拉起来。 */
	async hydrate(): Promise<void> {
		if (this.disposed) return;
		this.settings = await loadSettings(this.ctx.storage).catch(() => ({ ...DEFAULT_SETTINGS }));
		this.setState({ endpoint: this.settings.baseUrl });
		await this.runtime.hydrate();
		await this.refresh();
		await this.runtime.autostartIfWanted(this.state.phase === "offline");
		if (this.state.phase === "offline" && this.runtime.getState().phase === "running") await this.refresh();
	}

	/**
	 * 探网关 + 读目录。任何一步失败都只把原因写进 state，不抛给调用方。
	 *
	 * 单飞：探测可能同时来自面板轮询、「重新检测」、发布前的核对。并发调用共享同一次
	 * 请求 —— 以前后来的那个直接 return，调用方以为「目录已经读完了」，实际拿到的是
	 * 上一轮的旧快照。
	 */
	async refresh(): Promise<void> {
		if (this.disposed) return;
		if (this.pending) return this.pending;
		this.pending = this.runRefresh().finally(() => {
			this.pending = null;
		});
		return this.pending;
	}

	private async runRefresh(): Promise<void> {
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
				catalogPartial: list.hasMore,
				catalogRawCount: list.rawCount,
				rows: list.rows,
				summary: summarizeCatalog(list.rows),
			});
		} finally {
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

/**
	 * 当前目录能写成的 provider 配置；空目录返回 null（不写空表，防误删）。
	 *
	 * `minimal` 只保留宿主契约里最稳的三个字段（id / name / api）：宿主因某个可选字段
	 * 拒写时的退路。代价是丢掉上下文长度、推理档位这类信息，所以只在出错后才用它。
	 */
	private providerConfig(displayName: string, minimal = false): PluginModelProviderConfig | null {
		const models = toModelDefinitions(this.state.rows, minimal);
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
	 *
	 * 为什么发布前要核对一次目录：面板里的 rows 是**上一次探测的快照**。网关刚起来、
	 * 或用户刚在 magpie 里加完提供方，快照就是空的 —— 直接拿它判「目录为空」会把
	 * 「还没刷新」说成「没有模型」，用户点了发布只收到一句莫名其妙的空目录。
	 * 所以只在结果不可信时才重探（离线 / 上次读目录失败 / 目录为空），正常路径不额外请求。
	 */
	async publish(): Promise<boolean> {
		if (this.disposed || this.writing) return false;
		this.writing = true;
		this.setState({ busy: true });
		try {
			if (this.state.phase !== "online" || this.state.failure !== undefined || this.state.rows.length === 0) {
				await this.refresh();
			}
			// 离线、或目录读失败：messageKey 已经是对症原因（连不上 / 超时 / 不是 magpie /
			// HTTP 错误）。不能盖成「目录为空」——那是「网关活着但没有模型」，两回事。
			if (this.state.phase !== "online" || this.state.failure !== undefined) return false;
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
			// 先按完整字段写；宿主如果因为某个**可选**字段（推理档位、上下文长度…）
			// 拒了整张表，就退一步只写 id/name/api —— 宁可少一层元数据，也不要让用户
			// 的模型一个都发不出去。哪一步成了会写进 notice，不假装什么都没发生。
			try {
				await this.ctx.models.replaceOwnedProviders({ [PROVIDER_ID]: config });
			} catch (error) {
				const minimal = this.providerConfig(displayName, true);
				if (!minimal) throw error;
				await this.ctx.models.replaceOwnedProviders({ [PROVIDER_ID]: minimal });
				const first = error instanceof Error ? error.message.trim().slice(0, 160) : String(error);
				this.setState({
					messageKey: undefined,
					publishedCount: minimal.models?.length ?? 0,
					publishedAt: Date.now(),
					notice: this.ctx.i18n.t("status.publishedMinimal", { reason: first }),
				});
				return true;
			}
			this.setState({
				messageKey: undefined,
				notice: undefined,
				publishedCount: config.models?.length ?? 0,
				publishedAt: Date.now(),
			});
			return true;
		} catch (error) {
			// 把宿主/网关的原文留在界面上：只说「发布失败」等于什么都没说，
			// 而这类失败通常就是一句话的区别（权限、校验、写盘）。
			this.failPublish(error);
			return false;
		} finally {
			this.writing = false;
			this.setState({ busy: false });
		}
	}

	/** 从 Astravia 摘掉本插件写过的 provider；宿主按 id 删除。 */
	async disconnect(): Promise<boolean> {
		if (this.disposed || this.writing) return false;
		this.writing = true;
		this.setState({ busy: true });
		try {
			await this.ctx.models.replaceOwnedProviders({});
			this.setState({ publishedCount: undefined, publishedAt: undefined, messageKey: undefined });
			return true;
		} catch (error) {
			this.failPublish(error);
			return false;
		} finally {
			this.writing = false;
			this.setState({ busy: false });
		}
	}

	/** 面板上的「安装并启动」：下官方二进制（校验 sha256）→ 装到 ~/.local/bin → 起 magpie serve。 */
	async installAndStart(): Promise<void> {
		if (this.disposed) return;
		const started = await this.runtime.installAndStart();
		if (!started) return;
		await this.runtime.waitForGateway(() => this.gatewayReachable());
		await this.refresh();
	}

	/** 「启动」：二进制已装好时直接起网关。 */
	async startRuntime(): Promise<void> {
		if (this.disposed) return;
		const started = await this.runtime.start();
		if (!started) return;
		await this.runtime.waitForGateway(() => this.gatewayReachable());
		await this.refresh();
	}

	/** 「停止」：停掉插件拉起的那个网关子进程。 */
	async stopRuntime(): Promise<void> {
		await this.runtime.stop();
		await this.refresh();
	}

	/** 给「启动后等网关自答」用的轻探针：只问活，不读目录。 */
	async gatewayReachable(): Promise<boolean> {
		const probe = await probeGateway(this.ctx.network, this.settings).catch(() => null);
		return Boolean(probe?.ok);
	}

	/** 打开 magpie 自己的页面（登录提供方、加 key、看用量都在那边）。 */
	async openConsole(): Promise<void> {
		await this.ctx.ui.openExternal(consoleUrl(this.settings.baseUrl));
	}

	/**
	 * 写注册表失败：把原文留下（界面 + 存储），再发一条尽力而为的通知。
	 *
	 * 宿主拒绝写时会给一句很短的原因（权限、校验、凭据），只丢一个「操作失败」的
	 * toast 等于把唯一的线索丢了。`detail` 就是那一句，面板直接显示。
	 */
	private failPublish(error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		const detail = message.trim().slice(0, 400) || "(宿主没有给出原因)";
		this.setState({ messageKey: "error.syncFailed", detail, notice: undefined });
		// 同时落盘：用户在别处反馈时，这一句能直接从磁盘取回。
		void this.ctx.storage
			.writeFile("last-publish-error.json", JSON.stringify({ at: Date.now(), detail }, null, 2), "utf8")
			.catch(() => undefined);
		void this.notifyError(error);
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
		await this.runtime.dispose();
	}
}
