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
  private operationInFlight = false;
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

  private setState(patch: Partial<CanvasState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  private fail(messageKey: string): void {
    this.setState({ phase: "error", messageKey, busy: false });
  }

  async ensureLoaded(): Promise<void> {
    if (this.disposed) return;
    this.statusDisposable?.dispose();
    this.statusDisposable = this.ctx.services.onStatusChange((status) => {
      void this.handleStatusChange(status);
    });
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
        return;
      }
      if (!status.installed) {
        this.setState({ phase: "installing" });
        await this.ctx.services.install(SERVICE_ID, []);
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
    this.statusDisposable?.dispose();
    this.statusDisposable = undefined;
    this.listeners.clear();
  }
}
