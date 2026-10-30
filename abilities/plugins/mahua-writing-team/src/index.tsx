import { definePlugin } from "@astravia-org/plugin-sdk";
import { StudioService } from "./application/studio-service.js";
import { EntitlementGate } from "./entitlement/entitlement-gate.js";
import { attachFeedPersistence, hydrateFeed } from "./features/studio/live-feed/feed-persistence.js";
import { registerLiveFeedHooks } from "./live-feed-hooks.js";
import { setStudioRuntime } from "./plugin-context.js";
import { ManuscriptRepository } from "./repository/manuscript-repository.js";
import { registerStudioSurfaces } from "./studio-surfaces.js";
import { registerStudioTab } from "./studio-tab.js";
import { registerStudioWorkspaceView } from "./studio-workspace-view.js";
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
		// 对话侧的两块界面（ADR 0011）：工具行内渲染与新会话上下文区。
		// 它们不依赖工作台标签，所以未激活、或用户只想要对话时依然存在。
		const surfaces = registerStudioSurfaces(ctx);

		// 两个入口（ADR 0025 末尾补注）：活动面板的标签挨着当前对话，工作区视图给整页写作。
		// 宿主里「已在栏上」与「在 + 可添加池」互斥，只注册标签会让用户在菜单里找不到它。
		// 未激活时同一枚标签显示激活面板，所以凭证过期不会让它消失。
		const tab = registerStudioTab(ctx);
		const view = registerStudioWorkspaceView(ctx);

		// 运行台的活动流（ADR 0027 §1 修订版）：先把上次落盘的事件灌回内存，再订阅后续写入。
		// 灌历史放在注册 hook 之前：hook 一旦先到，这一轮的真事件就不该被旧记录压在后面。
		await hydrateFeed(ctx.storage);
		const detachFeed = attachFeedPersistence(ctx.storage);
		const unhook = registerLiveFeedHooks(ctx);

		return () => {
			tab.dispose();
			view.dispose();
			unhook.dispose();
			detachFeed();
			surfaces.dispose();
			setStudioRuntime(null);
		};
	},
});
