import { definePlugin } from "@astravia-org/plugin-sdk";
import { StudioService } from "./application/studio-service.js";
import { attachConsoleLogStorage, hydrateConsoleLog } from "./application/console-log/console-log-storage.js";
import { EntitlementGate } from "./entitlement/entitlement-gate.js";
import { registerConsoleFeedHooks } from "./features/workbench/hooks/register-console-feed.js";
import { setStudioRuntime } from "./plugin-context.js";
import { ManuscriptRepository } from "./repository/manuscript-repository.js";
import { registerStudioTab } from "./studio-tab.js";
import { registerStudioTurnCard } from "./studio-turn-card.js";
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

		// 只有一张界面、一个宿主入口：活动面板里的「麻花小说网」标签页。
		// 从前还注册过一个 workspace view，目的是让用户能把它带到整页路由上；那条路做不到
		// 「只有插件」——宿主把它渲染在应用外壳里，侧栏与页头都在。现在铺满整窗改由界面
		// 自己的全屏键完成（见 `WorkbenchSurface`），那枚注册连同它带来的侧栏重复入口一起删了。
		// 未激活时同一界面显示激活页，凭证过期不会让入口消失。
		const tab = registerStudioTab(ctx);
		const turnCard = registerStudioTurnCard(ctx);

		// 运行台的活动流（ADR 0027 §1 修订版）：先把上次落盘的事件灌回内存，再订阅后续写入。
		// 灌历史放在注册 hook 之前：hook 一旦先到，这一轮的真事件就不该被旧记录压在后面。
		await hydrateConsoleLog(ctx.storage);
		const detachConsoleLog = attachConsoleLogStorage(ctx.storage);
		const unhook = registerConsoleFeedHooks(ctx);

		return () => {
			turnCard.dispose();
			tab.dispose();
			unhook.dispose();
			detachConsoleLog();
			setStudioRuntime(null);
		};
	},
});
