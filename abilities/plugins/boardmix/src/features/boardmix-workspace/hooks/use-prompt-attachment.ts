import { useEffect } from "react";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { boardmixAttachmentFor, type BoardmixPanelState } from "../../../domain/boardmix-attachment";

/**
 * 把"用户此刻在说的是这块白板"这件事，从两个来源合并成输入框下面的一条胶囊。
 *
 * 两个来源必须汇到一处再写：面板活着的时候由组件上报状态，用户点输入栏开关的时候组件可能
 * 还没挂上（甚至根本不想开面板）。谁后写谁赢的话，两边会互相把对方摘掉——所以这里只保留
 * 一个写入口 `apply()`，两份状态都放在模块里。
 *
 * `ui.slot.input-action` 是这条能力的门禁：宿主没给权限时 `setPromptAttachment` 会直接 throw，
 * 而 effect 里抛出来的错会被活动面板的错误边界接住——用户看到的是整块面板「渲染失败」。
 * 缺权限就静默退化成「不挂胶囊」。
 */

interface Store {
	engaged: boolean;
	panel: BoardmixPanelState;
	label: string;
}

const store: Store = { engaged: false, panel: { active: false, ready: false, landedUrl: null }, label: "" };
let owner: PluginContext | null = null;

/** 唯一的写入口：算一遍该挂什么，然后交给宿主（或摘掉）。 */
function apply(): void {
	const ctx = owner;
	if (!ctx || !ctx.permissions.has("ui.slot.input-action")) return;
	try {
		ctx.ui.setPromptAttachment(
			boardmixAttachmentFor({ engaged: store.engaged, panel: store.panel, label: store.label }),
		);
	} catch {
		// 宿主版本比声明新/旧都可能让形状对不上；胶囊的得失不该影响能不能看白板。
	}
}

/** 激活时绑一次：输入栏开关也要用它，所以上下文存在模块里而不是某个组件里。 */
export function bindBoardmixAttachment(ctx: PluginContext): void {
	owner = ctx;
	apply();
}

/** 用户点了输入栏上的白板开关。 */
export function setBoardmixEngaged(ctx: PluginContext, engaged: boolean): void {
	owner ??= ctx;
	store.engaged = engaged;
	apply();
}

/** 胶囊上的名字来自标签页标题；切语言时跟着变。 */
export function setBoardmixAttachmentLabel(label: string): void {
	if (store.label === label) return;
	store.label = label;
	apply();
}

/**
 * 面板上报自己的状态。组件卸载时传 null：面板没了，只要开关还开着，胶囊就该留着——
 * 用户仍然在说这块白板。
 */
export function setBoardmixPanel(panel: BoardmixPanelState | null): void {
	const next = panel ?? { active: false, ready: false, landedUrl: null };
	if (
		store.panel.active === next.active &&
		store.panel.ready === next.ready &&
		store.panel.landedUrl === next.landedUrl
	) {
		return;
	}
	store.panel = next;
	apply();
}

/** 组件用的薄封装：状态变了就上报，卸载时退回"面板不在"。 */
export function usePromptAttachment(input: BoardmixPanelState & { label: string }): void {
	const { active, ready, landedUrl, label } = input;

	useEffect(() => {
		setBoardmixAttachmentLabel(label);
	}, [label]);

	useEffect(() => {
		setBoardmixPanel({ active, ready, landedUrl });
	}, [active, ready, landedUrl]);

	useEffect(() => () => setBoardmixPanel(null), []);
}
