import { definePlugin } from "@astravia-org/plugin-sdk";
import { StudioService } from "./application/studio-service.js";
import { attachConsoleLogStorage, hydrateConsoleLog } from "./application/console-log/console-log-storage.js";
import { EntitlementGate } from "./entitlement/entitlement-gate.js";
import { registerConsoleFeedHooks } from "./features/workbench/hooks/register-console-feed.js";
import { setStudioRuntime } from "./plugin-context.js";
import { ManuscriptRepository } from "./repository/manuscript-repository.js";
import { registerStudioTab } from "./studio-tab.js";
import { registerNovelTools } from "./tools/register-novel-tools.js";
import "./style.css";

const nowOf = () => new Date();

export default definePlugin({
	async activate(ctx) {
		const gate = new EntitlementGate(ctx.storage, nowOf);
		const repository = new ManuscriptRepository(ctx.storage, () => nowOf().toISOString());
		const service = new StudioService(repository, gate, nowOf);
		setStudioRuntime({ ctx, service, gate });

		await gate.load();

		registerNovelTools(ctx, service);

		// 一个入口，一张界面：活动面板里的标签页。全屏是插件自带的覆盖层
		// （`WorkbenchSurface` 里的 `expanded`），不再注册宿主的 workspace view——
		// `sidebar: false` 的视图只会出现在「设置 → 更多」，那不是放大该去的地方。
		// 未激活时同一界面显示激活页，凭证过期不会让入口消失。
		const tab = registerStudioTab(ctx);

		// 运行台的活动流（ADR 0027 §1 修订版）：先把上次落盘的事件灌回内存，再订阅后续写入。
		// 灌历史放在注册 hook 之前：hook 一旦先到，这一轮的真事件就不该被旧记录压在后面。
		await hydrateConsoleLog(ctx.storage);
		const detachConsoleLog = attachConsoleLogStorage(ctx.storage);
		const unhook = registerConsoleFeedHooks(ctx);

		return () => {
			tab.dispose();
			unhook.dispose();
			detachConsoleLog();
			setStudioRuntime(null);
		};
	},
});
