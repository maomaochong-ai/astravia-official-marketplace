/**
 * as-ocr：代码审查插件——桥接 alibaba/open-code-review（44k★，Apache-2.0）。
 *
 * 形态（刻意最轻）：不起服务进程。ocr CLI 是单二进制 + delegate 模式，
 * 宿主按 plugin.json#providers.cli 把它当托管依赖（探测失败即自动 npm 全局安装）；
 * 插件做三件事：
 *   1. agent 工具 `code_review`（ctx.agent.registerTool）：跑 ocr review
 *      --format json，结构化发现注入会话——agent 直接讨论/修复；
 *   2. 活动面板「审查」标签（ctx.ui.registerActivityTab）：顶部状态条展示
 *      ocr 的探测/安装/就绪阶段与安装日志，运行历史按严重度分组展示；
 *   3. 安装进度播报：面板没打开时用 ctx.ui.notify 告知「正在装 / 装失败」。
 */

import type { Disposable } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import "./style.css";
import { ReviewPanel } from "./panel/ReviewPanel";
import { createOcrProviderBridge, watchOcrProvider } from "./review/provider.ts";
import { ReviewStore } from "./review/store";
import { registerReviewTool } from "./review/tool";

let store: ReviewStore | null = null;
let providerWatch: Disposable | null = null;

export default definePlugin({
	activate(ctx) {
		store?.dispose();
		store = new ReviewStore(ctx);

		registerReviewTool(ctx, store);
		providerWatch?.dispose();
		providerWatch = watchOcrProvider(ctx);
		const provider = createOcrProviderBridge(ctx);

		const activeStore = store;
		if (!activeStore) throw new Error("ReviewStore 未初始化");
		ctx.ui.registerActivityTab({
			id: "as-ocr.reviews",
			label: ctx.i18n.t("tab.reviews"),
			order: 22,
			scope_use: ["conversation", "project"],
			component: () => <ReviewPanel store={activeStore} provider={provider} />,
		});
	},
	deactivate() {
		providerWatch?.dispose();
		providerWatch = null;
		store?.dispose();
		store = null;
	},
});
