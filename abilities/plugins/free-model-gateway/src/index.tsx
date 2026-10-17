import { definePlugin } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { GatewayController, VIEW_ID } from "./controller";
import { GatewayView } from "./components/GatewayView";
import "./style.css";

/**
 * Free Model Gateway：把本地免费模型服务接入 Astravia，装完即用。
 *
 * 设计边界（自包含外置插件）：
 * - 服务器运行时（上游 standalone 树）随插件包分发，由宿主以托管 Node 拉起
 *   （providers.services → host-node），端口与数据目录由宿主注入；
 * - 插件只做三件事：安装/启停服务、把 /v1/models 同步进宿主模型注册表、
 *   展示状态与日志；
 * - 用户无需克隆仓库、无需配置路径、无需手填密钥：服务密钥由服务自己写入
 *   数据目录，插件经 ctx.services.readDataFile 读取；
 * - 上游复用厂商免费通道的合规风险由使用者承担，页面内置风险声明。
 *
 * 注册为工作区视图：这是一个跨会话的服务控制台，不属于任何一次对话。
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
			icon: "icon-[solar--server-square-cloud-linear]",
			description: "%view.description%",
			badge: { kind: "beta" },
			component: function GatewayWorkspaceView(): JSX.Element {
				return <GatewayView controller={controller} />;
			},
		});

		// 挂载即回填状态；autoStart 默认开启，激活后自动安装/拉起服务并同步模型。
		void controller.ensureLoaded();

		// 逐 activation 清理：宿主停用本 activation 时调用，只释放本 controller。
		return () => {
			void controller.dispose();
			if (activeController === controller) activeController = null;
		};
	},
	// 空实现是刻意的：见文件头「生命周期」说明。真正的清理由 activate 返回的
	// cleanup 逐 activation 负责；宿主停用时两者都会被调用（cleanup 先行）。
	deactivate() {},
});
