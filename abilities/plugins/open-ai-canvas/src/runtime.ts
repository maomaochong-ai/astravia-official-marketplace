/**
 * 受管服务生命周期适配。
 *
 * 只处理服务安装、启动、停止、健康状态和宿主服务 API 适配。
 * 画布业务逻辑（MCP 工具）在 server/boot.mjs 中实现。
 */
import type { PluginContext, PluginServiceStatus } from "./runtime-contract";
import { SERVICE_ID } from "./runtime-contract";
import { BridgeExecutor } from "./features/canvas-workspace/bridge-executor";
import {
  BridgeChannelError,
  exportCanvasChannelsToHost,
  provisionBridgeChannel,
} from "./features/canvas-workspace/bridge-channel";

export type CanvasPhase = "idle" | "installing" | "starting" | "running" | "stopping" | "error";

export interface CanvasState {
  phase: CanvasPhase;
  baseUrl?: string;
  messageKey?: string;
  /** 具体到这台机器的补充信息：当前平台 / 已发布平台、下载进度、后端报错原文。 */
  detail?: string;
  busy: boolean;
  bridge: BridgeState;
  workflow?: WorkflowState;
}

/** shim 记下的「最近一次 apply_workflow」（ADR-0007 决策 5）。 */
export interface WorkflowState {
  at: number;
  canvasId: string;
  revision: number;
  nodes: number;
  edges: number;
  operations: number;
  generationCount: number;
  /** true 表示这次没有新建节点，只是按 key 改了已有节点。 */
  idempotent: boolean;
}

export interface BridgeState {
  /** 执行器在跑，画布发来的 chat 请求才会真正被宿住模型处理。 */
  executorOnline: boolean;
  /** 宿住推给 shim 的文本模型数。0 表示还不能接。 */
  models: number;
  busy: boolean;
  noticeKey?: string;
  detail?: string;
}

export type CanvasStateListener = (state: CanvasState) => void;

const READY_TIMEOUT_MS = 130_000;
const READY_POLL_INTERVAL_MS = 500;
/** 单次状态探测的超时。端口没监听时 fetch 会立刻失败，这个值只兜住半开连接。 */
const PROBE_TIMEOUT_MS = 2_500;

/**
 * 包内服务工件：plugin.json#providers.services[].runtime.platforms 里登记的同一份 shim。
 * 构建脚本把 server/boot.mjs 拷成 public/assets/boot.mjs，vite 再原样挪进
 * dist/assets/，打包器从那里取。所以包内路径是 dist/assets/boot.mjs ——
 * 改成 dist/ 根下会被 .astraviapkg 的白名单漏掉。
 */
const ARTIFACT_PATH = "dist/assets/boot.mjs";
/** 与 runtime.platforms[].artifacts[].destination 一致（archive: "file" 时是文件路径）。 */
const ARTIFACT_DESTINATION = "server/boot.mjs";
/**
 * shim 自述状态端点（ADR-0004 决策 2）。
 *
 * 宿主的 /api/health/ready 恒 200（ADR-0003 决策 5：非 200 会被宿主 SIGKILL 并连锁重试），
 * 所以它只能回答「进程通不通」，不能回答「画布能不能用」。真正的就绪判据在这里。
 */
const STATE_PATH = "/__canvas/state";

/**
 * plugin.json 里 runtime.platforms 的键集，由 vite.config.ts 在构建期注入。
 *
 * 为什么需要它：宿主的 install() 用 `${process.platform}-${process.arch}` 取
 * runtime.platforms[tag]，取不到就抛 "Service runtime does not support platform …"，
 * 插件只能落到 error.installFailed，用户看不到平台名，也猜不到该换机器。
 * 所以在调用 install 之前先自己比对一次，不把宿主的英文异常当作诊断结论。
 *
 * 为空表示注入缺失（例如直接跑未打包源码），此时不拦，退回宿主行为。
 */
declare const __SUPPORTED_PLATFORMS__: string[] | undefined;
const SUPPORTED_PLATFORMS: string[] =
  typeof __SUPPORTED_PLATFORMS__ === "undefined" ? [] : __SUPPORTED_PLATFORMS__;

/** shim 的 GET /__canvas/state 响应（字段见 server/boot.mjs 的 stateSnapshot）。 */
interface ServiceProbe {
  phase?: string;
  code?: string | null;
  error?: string | null;
  stage?: string;
  message?: string;
  percent?: number;
  platform?: string;
  supported?: string[];
  ready?: boolean;
  backend?: boolean;
  bridge?: { executorOnline?: boolean; models?: number };
  workflow?: WorkflowState | null;
}

/** 失败码 → i18n key。文案会变，code 不变，不要靠中文子串匹配。 */
const FAILURE_MESSAGE_KEYS: Record<string, string> = {
  "platform-unsupported": "error.platformUnsupported",
  "payload-unreachable": "error.payloadUnreachable",
  "payload-checksum-mismatch": "error.payloadCorrupt",
  "payload-extract-failed": "error.payloadExtract",
  "backend-spawn-failed": "error.backendFailed",
  "backend-exited": "error.backendFailed",
};

/** 宿主 install() 的载荷格式是 base64 字符串；分块拼接，避开 fromCharCode 的参数上限。 */
function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }
  return btoa(parts.join(""));
}

function phaseFromServiceStatus(status: PluginServiceStatus): CanvasPhase {
  switch (status.phase as string) {
    case "ready":
      return "running";
    case "installing":
      return "installing";
    case "starting":
      return "starting";
    case "stopping":
      return "stopping";
    case "failed":
      return "error";
    default:
      return "idle";
  }
}

/** 把探针里的进度压成一行给界面看：阶段 · 43% · 或「本机平台不在已发布列表里」。 */
function progressDetail(probe: ServiceProbe): string | undefined {
  const parts: string[] = [];
  const supported = probe.supported ?? [];
  if (probe.platform && supported.length > 0 && !supported.includes(probe.platform)) {
    parts.push(`${probe.platform} → ${supported.join(" / ")}`);
  }
  if (probe.stage) parts.push(probe.stage);
  const percent = typeof probe.percent === "number" ? probe.percent : 0;
  if (percent > 0 && percent < 100) parts.push(`${Math.round(percent)}%`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export class CanvasController {
  private readonly ctx: PluginContext;
  private readonly listeners = new Set<CanvasStateListener>();
  private state: CanvasState = {
    phase: "idle",
    busy: false,
    bridge: { executorOnline: false, models: 0, busy: false },
  };
  private bridgeExecutor: BridgeExecutor | undefined;
  private statusDisposable: { dispose(): void } | undefined;
  private subscribed = false;
  private pendingNotify = false;
  private operationInFlight = false;
  private installAttempted = false;
  private disposed = false;
  /** 服务基址随宿主分配的端口变化，每次启动都重新解析。 */
  private baseUrl: string | undefined;

  constructor(ctx: PluginContext) {
    this.ctx = ctx;
  }

  getState(): CanvasState {
    return this.state;
  }

  subscribe(listener: CanvasStateListener): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  /**
   * 状态只推进不抖动。宿主每次服务状态变化都会回调进来，而 setState 以前无条件新建
   * 对象并同步通知，视图着就会重渲染——同一个 phase 反复到达时尤其明显。
   * 现在：值没变就不通知；同一微任务里的多次 patch 合并成一次广播。
   */
  private setState(patch: Partial<CanvasState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof CanvasState>) {
      if (this.state[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.scheduleNotify();
  }

  private scheduleNotify(): void {
    if (this.pendingNotify || this.disposed) return;
    this.pendingNotify = true;
    queueMicrotask(() => {
      this.pendingNotify = false;
      if (this.disposed) return;
      const snapshot = this.state;
      for (const listener of Array.from(this.listeners)) listener(snapshot);
    });
  }

  /**
   * 桥的字段全是标量，逐项比一次再决定要不要广播。直接 setState 会因为换了对象
   * 而每次都通知，视图跟着每轮轮询重渲染。
   */
  private patchWorkflow(workflow: WorkflowState | null): void {
    const current = this.state.workflow ?? null;
    // 同一份记录每次探测都会回来，引用不同但内容相同，没必要重渲染。
    const same =
      (workflow === null && current === null) ||
      (workflow !== null && current !== null && JSON.stringify(workflow) === JSON.stringify(current));
    if (same) return;
    this.setState({ workflow: workflow ?? undefined });
  }

  private patchBridge(patch: Partial<BridgeState>): void {
    const next = { ...this.state.bridge, ...patch };
    const keys = Object.keys(next) as Array<keyof BridgeState>;
    if (keys.every((key) => next[key] === this.state.bridge[key])) return;
    this.setState({ bridge: next });
  }

  private fail(messageKey: string, detail?: string): void {
    this.setState({ phase: "error", messageKey, detail, busy: false });
  }

  /** 按 shim 报的 code 选文案，并把后端原文一并带上——「装失败了请重装」会把人带偏。 */
  private failFromProbe(probe: ServiceProbe): void {
    const code = typeof probe.code === "string" ? probe.code : "";
    this.fail(FAILURE_MESSAGE_KEYS[code] ?? "error.startFailed", probe.error ?? progressDetail(probe));
  }

  /**
   * 未发布的平台返回一句可复制的原因，已发布返回 undefined。
   *
   * 问不到平台（SDK 旧版 / 调用失败）时返回 undefined：宁可照旧走宿主流程，
   * 也不要拿一个猜出来的平台名去否定用户的机器。
   */
  private async unsupportedPlatform(): Promise<string | undefined> {
    if (SUPPORTED_PLATFORMS.length === 0) return undefined;
    // 旧宿主没有 getPlatform 时是同步 TypeError，.catch 接不住，所以先包成 Promise。
    const platform = await Promise.resolve()
      .then(() => this.ctx.services.getPlatform())
      .catch(() => undefined);
    const tag = platform?.tag;
    if (!tag || SUPPORTED_PLATFORMS.includes(tag)) return undefined;
    return `当前平台 ${tag} 暂无可用的画布运行时（已发布：${SUPPORTED_PLATFORMS.join("、")}）。`;
  }

  /** 解析当前服务基址；宿主换端口后要能重新取到。 */
  private async resolveBaseUrl(): Promise<string | undefined> {
    if (this.baseUrl) return this.baseUrl;
    const connection = await this.ctx.services.connection(SERVICE_ID).catch(() => undefined);
    if (!connection?.baseUrl) return undefined;
    this.baseUrl = connection.baseUrl.replace(/\/+$/, "");
    return this.baseUrl;
  }

  /**
   * 读 shim 自述状态。返回 undefined 表示「问不到」：端口还没监听、shim 是旧版本、
   * 或者宿主没给连接信息。调用方在这种情况退回宿主状态判定，不要当成失败。
   */
  private async probeState(): Promise<ServiceProbe | undefined> {
    const baseUrl = await this.resolveBaseUrl();
    if (!baseUrl) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}${STATE_PATH}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return undefined;
      const data = (await response.json()) as ServiceProbe;
      if (data?.workflow !== undefined) {
        this.patchWorkflow(data.workflow);
      }
      if (data?.bridge) {
        this.patchBridge({
          executorOnline: Boolean(data.bridge.executorOnline),
          models: typeof data.bridge.models === "number" ? data.bridge.models : 0,
        });
      }
      return data && typeof data.phase === "string" ? data : undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 宿主说 ready 只代表 shim 的端口通了；画布可用与否问 shim 自己。 */
  private async confirmReady(): Promise<void> {
    const probe = await this.probeState();
    if (!probe) {
      this.applyReady();
      return;
    }
    if (probe.phase === "ready") {
      this.applyReady();
      return;
    }
    if (probe.phase === "failed") {
      this.failFromProbe(probe);
      return;
    }
    this.setState({ phase: "starting", messageKey: undefined, detail: progressDetail(probe), busy: true });
  }

  async ensureLoaded(): Promise<void> {
    if (this.disposed) return;
    // 订阅只建一次：以前每次激活都卸了重建，旧句柄不清就会叠加回调。
    if (!this.subscribed) {
      this.subscribed = true;
      this.statusDisposable = this.ctx.services.onStatusChange((status) => {
        void this.handleStatusChange(status);
      });
    }
    // 先于宿主状态：未发布平台的宿主状态永远是 failed，它解释不了原因。
    const unsupported = await this.unsupportedPlatform();
    if (unsupported) {
      if (this.state.messageKey !== "error.platformUnsupported") {
        this.fail("error.platformUnsupported", unsupported);
      }
      return;
    }
    const status = await this.ctx.services.getStatus(SERVICE_ID).catch(() => undefined);
    if (!status) return;
    const phase = phaseFromServiceStatus(status);
    if (phase === "running") {
      // 不再直接 applyReady()：宿主 ready 是「端口通了」，准备失败时它也是 ready。
      await this.confirmReady();
      return;
    }
    this.setState({
      phase,
      messageKey: status.phase === "failed" ? "error.serviceFailed" : undefined,
    });
  }

  private async handleStatusChange(status: { serviceId: string; phase: string; message?: string }): Promise<void> {
    if (this.disposed || status.serviceId !== SERVICE_ID) return;
    const phase = phaseFromServiceStatus(status as never);
    if (phase === "running") {
      await this.confirmReady();
      return;
    }
    if (phase === "error") {
      const probe = await this.probeState();
      if (probe?.phase === "failed") {
        this.failFromProbe(probe);
        return;
      }
      this.setState({ phase, messageKey: "error.serviceFailed", busy: false });
      return;
    }
    this.setState({ phase, busy: phase === "installing" || phase === "starting" || phase === "stopping" });
  }

  private applyReady(): void {
    if (this.disposed) return;
    this.setState({ phase: "running", messageKey: undefined, detail: undefined, busy: false });
  }

  async ensureRunning(): Promise<void> {
    if (this.disposed || this.operationInFlight) return;
    this.operationInFlight = true;
    // 端口可能已经变了：每次启动都重新解析基址。
    this.baseUrl = undefined;
    this.setState({ busy: true });
    try {
      // 必须在 install() 之前：宿主在那里抛英文异常，用户只会看到「安装失败」。
      const unsupported = await this.unsupportedPlatform();
      if (unsupported) {
        this.fail("error.platformUnsupported", unsupported);
        return;
      }
      let status = await this.ctx.services.getStatus(SERVICE_ID);
      if (status.phase === "ready" && status.installed !== false) {
        const probe = await this.probeState();
        if (!probe || probe.phase === "ready") {
          this.applyReady();
          // 服务已就绪时点「启动」也直接进画布，避免按钮看着没反应。
          void this.openInBrowser().catch(() => undefined);
          return;
        }
        if (probe.phase === "failed") {
          this.failFromProbe(probe);
          return;
        }
      }
      if (!status.installed) {
        // 一次会话只装一次：装好后宿主缺的只是 start()，而 install 失败时反复重试
        // 只会让按钮一直转圈。真装坏了让用户重装插件，而不是无限循环。
        if (this.installAttempted) {
          throw new Error("服务运行时安装失败，请重装插件后再试");
        }
        this.installAttempted = true;
        // 宿主拒绝在子进程存活时替换运行时；stop() 幂等，兼做旧实例清理。
        this.setState({ phase: "stopping" });
        await this.ctx.services.stop(SERVICE_ID).catch(() => undefined);
        this.setState({ phase: "installing" });
        const data = await this.fetchArtifactBase64();
        status = await this.ctx.services.install(SERVICE_ID, [
          { destination: ARTIFACT_DESTINATION, data },
        ]);
      }
      if (status.phase !== "ready") {
        this.setState({ phase: "starting", messageKey: undefined, detail: undefined });
        await this.ctx.services.start(SERVICE_ID);
      }
      // waitForReady 自己负责落失败文案（按 code），所以这里只看结论。
      if ((await this.waitForReady()) !== "ready") return;
      this.applyReady();
      // 与开源桌面壳一致：后端就绪即进入画布，不再要求用户回头再点一次「打开浏览器」。
      // 打开动作失败（例如宿主未授予 shell.openExternal）不影响服务已就绪的事实。
      void this.openInBrowser().catch(() => undefined);
    } catch (error) {
      this.fail("error.installFailed");
      void this.notifyError(error);
    } finally {
      this.operationInFlight = false;
      this.setState({ busy: false });
    }
  }

  /**
   * 轮询 shim 自述状态直到 ready / failed / 超时。
   *
   * 以前这里读的是宿主 getStatus()，而宿主靠 /api/health/ready 的 200 判就绪——
   * 准备期与永久失败都是 200，于是界面先显示「运行中」，再跳到「运行时准备失败」。
   */
  private async waitForReady(): Promise<"ready" | "failed" | "timeout"> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    for (;;) {
      const probe = await this.probeState();
      if (probe) {
        if (probe.phase === "ready") return "ready";
        if (probe.phase === "failed") {
          this.failFromProbe(probe);
          return "failed";
        }
        this.setState({ detail: progressDetail(probe) });
      } else {
        // 探针不可达（旧 shim / 端口尚未监听）：退回宿主状态，保持旧行为可用。
        const status = await this.ctx.services.getStatus(SERVICE_ID).catch(() => undefined);
        if (status?.phase === "ready") return "ready";
        if (status?.phase === "failed") {
          this.fail("error.serviceFailed");
          return "failed";
        }
        if (status?.phase === "stopped") {
          this.fail("error.startFailed");
          return "failed";
        }
      }
      if (Date.now() >= deadline) {
        this.fail("error.startFailed", this.state.detail);
        return "timeout";
      }
      await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
    }
  }

  /** 读取包内服务工件并转 base64——宿主 install() 要求与 platform.artifacts 一一对应。 */
  private async fetchArtifactBase64(): Promise<string> {
    const plugin = this.ctx.plugin;
    const url = `astravia-plugin://${plugin.id}/versions/${plugin.version}/${ARTIFACT_PATH}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load bundled service runtime: ${response.status} ${response.statusText}`);
    }
    return toBase64(new Uint8Array(await response.arrayBuffer()));
  }

  async stop(): Promise<void> {
    if (this.disposed || this.operationInFlight) return;
    this.operationInFlight = true;
    this.baseUrl = undefined;
    this.setState({ phase: "stopping", busy: true });
    try {
      await this.ctx.services.stop(SERVICE_ID);
      this.setState({ phase: "idle", messageKey: undefined, detail: undefined, busy: false });
    } catch (error) {
      this.fail("error.stopFailed");
      void this.notifyError(error);
    } finally {
      this.operationInFlight = false;
      this.setState({ busy: false });
    }
  }

  async openInBrowser(): Promise<boolean> {
    const baseUrl = await this.resolveBaseUrl();
    if (!baseUrl) return false;
    await this.ctx.ui.openExternal(`${baseUrl}/`);
    return true;
  }

  getBaseUrl(): string | undefined {
    return this.baseUrl;
  }

  /**
   * 启动模型桥的执行侧（ADR-0006 决策 1）。它只负责长轮询取任务，不关心画布是否
   * 已经启动——shim 不在时自然重试，宿主也不会因此报错。
   */
  startBridge(): void {
    if (this.bridgeExecutor || this.disposed) return;
    this.bridgeExecutor = new BridgeExecutor(this.ctx);
    this.bridgeExecutor.start();
  }

  /** 把宿主的文本模型写成画布里的一个渠道（ADR-0006 决策 2）。 */
  async connectHostModelsToCanvas(): Promise<void> {
    await this.runBridgeAction(async () => {
      const baseUrl = await this.resolveBaseUrl();
      const result = await provisionBridgeChannel(this.ctx, baseUrl);
      this.patchBridge({
        noticeKey: result.created ? "bridge.channelCreated" : "bridge.channelUpdated",
        detail: `${result.channelId} · ${result.models.length} models`,
      });
    });
  }

  /** 把画布里已配好的自定义渠道登记成宿主的模型来源（ADR-0006 决策 3）。 */
  async publishCanvasChannelsToHost(): Promise<void> {
    await this.runBridgeAction(async () => {
      const result = await exportCanvasChannelsToHost(this.ctx);
      const exported = result.exported.length;
      this.patchBridge({
        noticeKey: exported > 0 ? "bridge.exported" : "bridge.exportedNone",
        detail:
          result.skipped > 0
            ? `exported ${exported}, skipped ${result.skipped}（画布未下发密钥）`
            : `exported ${exported}`,
      });
    });
  }

  private async runBridgeAction(action: () => Promise<void>): Promise<void> {
    if (this.state.bridge.busy) return;
    this.patchBridge({ busy: true, noticeKey: undefined, detail: undefined });
    try {
      await action();
    } catch (error) {
      const code = error instanceof BridgeChannelError ? error.code : "canvas-channel-write-failed";
      this.patchBridge({ noticeKey: `bridge.error.${code}`, detail: error instanceof Error ? error.message : undefined });
      void this.notifyError(error);
    } finally {
      this.patchBridge({ busy: false });
    }
  }

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
    this.pendingNotify = false;
    this.subscribed = false;
    this.bridgeExecutor?.stop();
    this.bridgeExecutor = undefined;
    this.statusDisposable?.dispose();
    this.statusDisposable = undefined;
    this.listeners.clear();
  }
}
