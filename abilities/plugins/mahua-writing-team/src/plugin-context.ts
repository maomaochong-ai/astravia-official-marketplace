import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { StudioService } from "./application/studio-service.js";
import type { EntitlementGate } from "./entitlement/entitlement-gate.js";

/**
 * activate() 建立的运行时对象。组件是零 props 的，拿不到 ctx，又不能写进模块顶层
 * ——MF 的共享依赖是异步填充的，顶层求值会拿到半成品。
 */
export interface StudioRuntime {
	ctx: PluginContext;
	service: StudioService;
	gate: EntitlementGate;
}

let runtime: StudioRuntime | null = null;

export function setStudioRuntime(next: StudioRuntime | null): void {
	runtime = next;
}

export function getStudioRuntime(): StudioRuntime {
	if (!runtime) throw new Error("mahua-writing-team: studio runtime is not ready");
	return runtime;
}
