import { definePlugin } from "@astravia-org/plugin-sdk";
import { StudioService } from "./application/studio-service.js";
import { EntitlementGate } from "./entitlement/entitlement-gate.js";
import { setStudioRuntime } from "./plugin-context.js";
import { ManuscriptRepository } from "./repository/manuscript-repository.js";
import { registerStudioSurfaces } from "./studio-surfaces.js";
import { registerStudioTab } from "./studio-tab.js";
import { registerNovelTools } from "./tools/novel-tools.js";
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

		// 标签页而非侧边栏入口（ADR 0025 §2）：默认直接上栏，不把入口押在
		// 活动面板条件化的「+」池上（见 studio-tab.ts 与 ADR 0025 末尾补注）。
		// 未激活时同一枚标签显示激活面板，所以凭证过期不会让它消失。
		const tab = registerStudioTab(ctx);

		return () => {
			tab.dispose();
			surfaces.dispose();
			setStudioRuntime(null);
		};
	},
});
