import { definePlugin } from "@astravia-org/plugin-sdk";
import { StudioService } from "./application/studio-service.js";
import { EntitlementGate } from "./entitlement/entitlement-gate.js";
import { attachFeedPersistence, hydrateFeed } from "./application/live-feed/feed-persistence.js";
import { registerLiveFeedHooks } from "./features/workbench/hooks/register-live-feed.js";
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

		// 唯一入口（ADR 0025 补注三）：工作台就是一枚标签。宿主里「已在栏上」与「在可添加池」
		// 互斥，两处都注册会让人在菜单里找不到同一个界面，所以工作区视图不再注册。
		// 未激活时同一枚标签显示激活页，因此凭证过期不会让它消失。
		const tab = registerStudioTab(ctx);

		// 运行台的活动流（ADR 0027 §1 修订版）：先把上次落盘的事件灌回内存，再订阅后续写入。
		// 灌历史放在注册 hook 之前：hook 一旦先到，这一轮的真事件就不该被旧记录压在后面。
		await hydrateFeed(ctx.storage);
		const detachFeed = attachFeedPersistence(ctx.storage);
		const unhook = registerLiveFeedHooks(ctx);

		return () => {
			tab.dispose();
			unhook.dispose();
			detachFeed();
			setStudioRuntime(null);
		};
	},
});
