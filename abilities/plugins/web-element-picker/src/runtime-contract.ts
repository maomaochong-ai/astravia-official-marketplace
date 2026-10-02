/**
 * 宿主运行时契约 — 持有 PluginContext + 跨 MF 插槽意图通道。
 *
 * activate() 时 setRuntime(ctx)；面板组件通过 getRuntime() 获取宿主能力。
 * picker intent 通道让输入栏 Action slot 和活动 Tab slot 之间传状态
 * （两者是同一 MF 模块实例的不同插槽，用模块级状态交换意图）。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

let pluginCtx: PluginContext | null = null;

export function setRuntime(ctx: PluginContext): void { pluginCtx = ctx; }
export function getRuntime(): PluginContext | null { return pluginCtx; }

// ─── 输入栏 toggle 意图通道 ───

export type PickerIntent = "start-select" | "stop-select";

let pendingIntent: PickerIntent | null = null;
let intentListener: ((intent: PickerIntent) => void) | null = null;

export function pushPickerIntent(intent: PickerIntent): void {
	if (intentListener) intentListener(intent);
	else pendingIntent = intent;
}

/** 面板挂载时消费暂存的意图（一次性）。 */
export function consumePickerIntent(): PickerIntent | null {
	const intent = pendingIntent;
	pendingIntent = null;
	return intent;
}

/** 面板运行中订阅新意图。返回取消订阅函数。 */
export function onPickerIntent(listener: (intent: PickerIntent) => void): () => void {
	intentListener = listener;
	return () => { if (intentListener === listener) intentListener = null; };
}
