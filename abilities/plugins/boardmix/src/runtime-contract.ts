import type { PluginContext } from "@astravia-org/plugin-sdk";

/**
 * 装配入口与深层组件之间的契约：只有 `src/index.tsx` 写、只有工具与 hook 读。
 * 组件不直接拿 ctx，工具不自己去找宿主。
 */
let runtime: PluginContext | null = null;

export function setRuntime(ctx: PluginContext | null): void {
	runtime = ctx;
}

export function getRuntime(): PluginContext | null {
	return runtime;
}
