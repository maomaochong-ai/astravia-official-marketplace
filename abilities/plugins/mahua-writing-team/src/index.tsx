import { definePlugin } from "@astravia-org/plugin-sdk";
import { StudioService } from "./application/studio-service.js";
import { EntitlementGate } from "./entitlement/entitlement-gate.js";
import { ActivationWorkspaceView } from "./features/settings/components/ActivationWorkspaceView.js";
import { setStudioRuntime } from "./plugin-context.js";
import { ManuscriptRepository } from "./repository/manuscript-repository.js";
import { disposeStudioView, ensureStudioView } from "./studio-view-registration.js";
import { registerStudioSurfaces } from "./studio-surfaces.js";
import { registerNovelTools } from "./tools/novel-tools.js";
import { ACTIVATION_VIEW_ID } from "./view-ids.js";
import "./style.css";

const nowOf = () => new Date();

export default definePlugin({
	async activate(ctx) {
		const gate = new EntitlementGate(ctx.storage, nowOf);
		const repository = new ManuscriptRepository(ctx.storage, () => nowOf().toISOString());
		const service = new StudioService(repository, gate, nowOf);
		setStudioRuntime({ ctx, service, gate });

		// 先验签再决定要不要占侧边栏那一格：无效凭证不应留下一个点开就报错的入口。
		await gate.load();

		registerNovelTools(ctx, service);
		// 对话侧的两块界面（ADR 0011）：工具行内渲染与新会话上下文区。
		// 它们不依赖工作台视图，所以未激活、或用户只想要对话时依然存在。
		const surfaces = registerStudioSurfaces(ctx);

		// 未激活时激活页必须**自己出现在侧边栏**：否则它 sidebar: false 且 studio 未注册，
		// 用户没有任何入口能打开它（凭证过期后整个插件等于消失）。激活后沉到设置里，让出导航位。
		const activationView = ctx.ui.registerWorkspaceView({
			id: ACTIVATION_VIEW_ID,
			label: "%view.activation.label%",
			description: "%view.activation.description%",
			component: ActivationWorkspaceView,
			sidebar: !gate.active,
		});

		if (gate.active) ensureStudioView(ctx);

		return () => {
			activationView.dispose();
			surfaces.dispose();
			disposeStudioView();
			setStudioRuntime(null);
		};
	},
});
