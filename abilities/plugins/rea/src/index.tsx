/**
 * REA 插件入口 —— 一个 UI 槽位：
 *   1. activity-tab —— 6 阶段逆向工作流（顶部 provider 状态条 + 阶段条 + 阶段详情 + 控制器）
 *
 * CLI provider 状态通过 as-ocr 风格的桥接对象（closure over ctx）传入 tab 组件，
 * tab 内部 useEffect 订阅 onStatusChanged。
 * index.tsx 只做装配，不放业务组件。组件在 features/<feature>/components/。
 * 主题通过 src/style.css 的 @theme inline 跟随宿主。
 */

import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import {
	ReaWorkflowTab,
	type ReaProviderBridge,
} from "./features/rea-workflow";

const REA_PROVIDER_ID = "rea-agents";

function createProviderBridge(ctx: PluginContext): ReaProviderBridge {
	return {
		getStatus: () => ctx.cliProviders.getStatus(REA_PROVIDER_ID),
		onStatusChanged: (listener) => ctx.cliProviders.onStatusChanged((status) => {
			if (status.providerId === REA_PROVIDER_ID) listener(status);
		}),
		retry: () => ctx.cliProviders.retry(REA_PROVIDER_ID),
	};
}

export default definePlugin({
	async activate(ctx: PluginContext): Promise<Disposable> {
		const provider = createProviderBridge(ctx);

		const tabDisposable = ctx.ui.registerActivityTab({
			id: "rea.workflow",
			label: ctx.i18n.t("tab.label"),
			order: 22,
			scope_use: ["conversation", "project"],
			initiallyVisible: true,
			component: () => <ReaWorkflowTab provider={provider} />,
		});

		return {
			dispose(): void {
				tabDisposable.dispose();
			},
		};
	},
});
