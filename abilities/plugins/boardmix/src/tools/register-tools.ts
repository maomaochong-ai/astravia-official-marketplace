import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { registerAutomationTool } from "./boardmix-automation-tools";
import { registerDestinationTools } from "./boardmix-destination-tools";
import { registerNavigationTools } from "./boardmix-navigation-tools";
import { registerSurfaceTools } from "./boardmix-surface-tools";

/**
 * 十个工具的唯一注册点。没有 `agent.tools.register` 就整体不注册——
 * 少一个能力，而不是留一个调不通的工具在目录里。
 */
export function registerTools(ctx: PluginContext): Disposable[] {
	if (!ctx.permissions.has("agent.tools.register")) return [];
	return [
		...registerNavigationTools(ctx),
		...registerDestinationTools(ctx),
		...registerAutomationTool(ctx),
		...registerSurfaceTools(ctx),
	];
}
