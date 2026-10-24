/**
 * 受管服务生命周期适配。
 *
 * 只处理服务安装、启动、停止、健康状态和宿主服务 API 适配。
 * 画布业务逻辑（MCP 工具）在 server/boot.mjs 中实现。
 */
import type { PluginContext, PluginServiceStatus } from "./runtime-contract";
import { SERVICE_ID } from "./runtime-contract";

export type CanvasPhase = "idle" | "installing" | "starting" | "running" | "stopping" | "error";

export interface CanvasState {
  phase: CanvasPhase;
  baseUrl?: string;
  messageKey?: string;
  busy: boolean;
}

export type CanvasStateListener = (state: CanvasState) => void;

const READY_TIMEOUT_MS = 130_000;
const READY_POLL_INTERVAL_MS = 500;

/**
 * 包内服务工件：plugin.json#providers.services[].runtime.platforms 里登记的同一份 shim。
 * 构建脚本把 server/boot.mjs 拷成 public/assets/boot.mjs，vite 再原样挪进
 * dist/assets/，打包器从那里取。所以包内路径是 dist/assets/boot.mjs ——
 * 改成 dist/ 根下会被 .astraviapkg 的白名单漏掉。
 */
const ARTIFACT_PATH = "dist/assets/boot.mjs";
/** 与 runtime.platforms[].artifacts[].destination 一致（archive: "file" 时是文件路径）。 */
const ARTIFACT_DESTINATION = "server/boot.mjs";

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

export class CanvasController {
  private readonly ctx: PluginContext;
  private readonly listeners = new Set<CanvasStateListener>();
  private state: CanvasState = { phase: "idle", busy: false };
  private statusDisposable: { dispose(): void } | undefined;
  private subscribed = false;
  private pendingNotify = false;
  private operationInFlight = false;
  private installAttempted = false;
  private disposed = false;

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

  private fail(messageKey: string): void {
    this.setState({ phase: "error", messageKey, busy: false });
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
    const status = await this.ctx.services.getStatus(SERVICE_ID).catch(() => undefined);
    if (status) {
      const phase = phaseFromServiceStatus(status);
      if (phase === "running") {
        this.applyReady();
      } else {
        this.setState({
          phase,
          messageKey: status.phase === "failed" ? "error.serviceFailed" : undefined,
        });
      }
    }
  }

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

  private applyReady(): void {
    if (this.disposed) return;
    this.setState({ phase: "running", messageKey: undefined, busy: false });
  }

  async ensureRunning(): Promise<void> {
    if (this.disposed || this.operationInFlight) return;
    this.operationInFlight = true;
    this.setState({ busy: true });
    try {
      let status = await this.ctx.services.getStatus(SERVICE_ID);
      if (status.phase === "ready" && status.installed !== false) {
        this.applyReady();
        // 服务已就绪时点「启动」也直接进画布，避免按钮看着没反应。
        void this.openInBrowser().catch(() => undefined);
        return;
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
        this.setState({ phase: "starting" });
        await this.ctx.services.start(SERVICE_ID);
      }
      status = await this.waitForReady();
      if (status.phase !== "ready") {
        this.fail("error.startFailed");
        return;
      }
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

  async openInBrowser(): Promise<boolean> {
    const connection = await this.ctx.services.connection(SERVICE_ID).catch(() => undefined);
    if (!connection) return false;
    await this.ctx.ui.openExternal(`${connection.baseUrl.replace(/\/+$/, "")}/`);
    return true;
  }

  getBaseUrl(): string | undefined {
    return this.state.baseUrl;
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
    this.statusDisposable?.dispose();
    this.statusDisposable = undefined;
    this.listeners.clear();
  }
}
