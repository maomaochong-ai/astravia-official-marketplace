import { definePlugin } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { GatewayController } from "./controller";
import { GatewayView } from "./features/gateway-view/components/gateway-view";
import { VIEW_ID } from "./plugin-ids";
import { registerMagpieTools } from "./tools/magpie-tools";
import "./style.css";

/**
 * Magpie：把本机已经装好的 magpie 网关接进 Astravia。
 *
 * 设计边界（连接器，不做二进制的宿主）：
 * - magpie 是用户自己安装、自己启动的外部程序（Go 单二进制，五个平台各 15–25 MB，
 *   远超包体上限），因此插件包里不带任何二进制，也不托管它；
 * - 插件只做四件事：探 `/api/version` 判活、读 `/v1/models` 取目录、
 *   在用户点击时把目录写进宿主模型注册表、给出「打开 magpie 页面」的入口；
 * - 提供方的密钥留在 magpie 自己的配置里，插件不保管；
 * - 两个只读 Agent 工具（magpie_status / magpie_models）让模型能查真实目录，
 *   而不是凭记忆回答。
 *
 * 注册为工作区视图：这是跨会话的服务控制台，不属于任何一次对话。
 *
 * 生命周期（关键契约）：宿主 reload（重装/更新）是「先激活新 activation、
 * 后停用旧 activation」，且 Module Federation remote 同名复用——新旧两个
 * activation 共享同一个模块实例与模块级状态。因此：
 * - activate() 只清理上一个 controller（热重载防线），并返回只释放
 *   「本 activation 创建的 controller」的 cleanup；
 * - 模块级 deactivate() 必须保持空实现：它在 reload 场景下运行时，
 *   activeController 已指向新 activation 的 controller，触碰它就是误杀。
 */
let activeController: GatewayController | null = null;

export default definePlugin({
	activate(ctx) {
		void activeController?.dispose();
		const controller = new GatewayController(ctx);
		activeController = controller;

		ctx.ui.registerWorkspaceView({
			id: VIEW_ID,
			label: "%view.label%",
			icon: "icon-[solar--routing-2-linear]",
			description: "%view.description%",
			component: function MagpieWorkspaceView(): JSX.Element {
				return <GatewayView controller={controller} />;
			},
		});

		const tools = registerMagpieTools(ctx, controller);

		// 挂载即读设置并探一次网关；用户不需要先点「重新检测」。
		void controller.hydrate();

		// 逐 activation 清理：宿主停用本 activation 时调用，只释放本 controller。
		return () => {
			tools.dispose();
			void controller.dispose();
			if (activeController === controller) activeController = null;
		};
	},
	// 空实现是刻意的：见文件头「生命周期」说明。真正的清理由 activate 返回的
	// cleanup 逐 activation 负责；宿主停用时两者都会被调用（cleanup 先行）。
	deactivate() {},
});
