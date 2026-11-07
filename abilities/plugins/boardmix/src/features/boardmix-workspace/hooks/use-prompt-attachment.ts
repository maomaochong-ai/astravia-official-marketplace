import { useEffect } from "react";
import { definePluginPromptContext, type PluginContext } from "@astravia-org/plugin-sdk";

export interface BoardmixAttachmentInput {
	/** Whether this tab is the one the user is looking at. */
	active: boolean;
	/** The panel has finished choosing a ladder and mounted the webview. */
	ready: boolean;
	/** The last address the webview itself reported landing on, if any. */
	landedUrl: string | null;
	/** What the chip under the composer should say. */
	label: string;
}

/**
 * 面板被选中时，把"你现在说的是这块白板"摆到输入框下面。
 *
 * 只有选中才算：这个标签以前是常驻上栏的，胶囊也就跟着常驻，用户切到别的会话
 * 输入框下面还挂着 Boardmix，看上去像上一轮没发出去。选中是对话开始关于这块白板
 * 的瞬间，离开是它停止的瞬间。
 *
 * payload 里 `canRead: false` 是写给模型看的一句实话：面板里装的是 boardmix 自己的
 * 网页，插件读不到画布内容。它不能因为输入框下面挂着这个名字就以为自己看见了白板——
 * 要看内容得调 boardmix_read / boardmix_shot。
 */
export function usePromptAttachment(ctx: PluginContext, input: BoardmixAttachmentInput): void {
	const { active, ready, landedUrl, label } = input;

	useEffect(() => {
		// 这条能力受 `ui.slot.input-action` 门禁：宿主没给这个权限时 `setPromptAttachment`
		// 会直接 throw，而 effect 里抛出的错会被活动面板的错误边界接住——用户看到的是整块
		// 面板「渲染失败」，而不是少了一个胶囊。缺权限就静默退化成「不挂附件」。
		if (!ctx.permissions.has("ui.slot.input-action")) return;
		try {
			if (!active) {
				ctx.ui.setPromptAttachment(null);
				return;
			}
			ctx.ui.setPromptAttachment({
				id: "boardmix:panel",
				label,
				lifecycle: "sticky",
				context: definePluginPromptContext({
					schema: "astravia.boardmix.panel-state",
					version: 1,
					payload: {
						panel: "boardmix",
						phase: ready ? "ready" : "loading",
						landedUrl,
						canRead: false,
					},
				}),
			});
		} catch {
			// 宿主版本比声明新/旧都可能让形状对不上；气泡功能得失不该影响能不能看白板。
		}
	}, [active, ready, landedUrl, label, ctx]);
}
