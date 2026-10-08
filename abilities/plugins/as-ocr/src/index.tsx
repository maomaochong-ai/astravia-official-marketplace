/**
 * as-ocr：代码审查插件——桥接 alibaba/open-code-review（44k★，Apache-2.0）。
 *
 * 形态（刻意最轻）：不起服务进程。ocr CLI 是单二进制 + delegate 模式，
 * 插件做三件事：
 *   1. agent 工具 `code_review`（ctx.agent.registerTool）：跑 ocr review
 *      --format json，结构化发现注入会话——agent 直接讨论/修复；
 *   2. 活动面板「审查」标签（ctx.ui.registerActivityTab）：运行历史按
 *      严重度分组展示；
 *   3. CLI 就绪性：ocr 不在 PATH 时返回安装指引（不自动装）。
 */

import { definePlugin } from "@astravia-org/plugin-sdk";
import { ReviewPanel } from "./panel/ReviewPanel";
import { ReviewStore } from "./review/store";
import { registerReviewTool } from "./review/tool";

let store: ReviewStore | null = null;

export default definePlugin({
	activate(ctx) {
		store?.dispose();
		store = new ReviewStore(ctx);

		registerReviewTool(ctx, store);

		ctx.ui.registerActivityTab({
			id: "as-ocr.reviews",
			label: ctx.i18n.t("tab.reviews"),
			order: 22,
			scope_use: ["conversation", "project"],
			component: () => <ReviewPanel store={store} />,
		});
	},
	deactivate() {
		store?.dispose();
		store = null;
	},
});
