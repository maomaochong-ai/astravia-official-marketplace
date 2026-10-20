/**
 * 宿主运行时契约。activate() 里调用 setRuntime(ctx)，面板在装配层
 * （index.tsx）读取它，把宿主能力包成 bridge 传给组件——组件本身不碰 ctx。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

let pluginCtx: PluginContext | null = null;

export function setRuntime(ctx: PluginContext): void {
	pluginCtx = ctx;
}

export function getRuntime(): PluginContext | null {
	return pluginCtx;
}
