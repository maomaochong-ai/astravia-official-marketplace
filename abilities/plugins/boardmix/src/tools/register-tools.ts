import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { registerAiPromptTool } from "./boardmix-ai-prompt-tools";
import { registerAutomationTool } from "./boardmix-automation-tools";
import { registerDestinationTools } from "./boardmix-destination-tools";
import { registerDiagramTool } from "./boardmix-diagram-tools";
import { registerNavigationTools } from "./boardmix-navigation-tools";
import { registerSurfaceTools } from "./boardmix-surface-tools";

/**
 * 十二个工具的唯一注册点。没有 `agent.tools.register` 就整体不注册——少一个能力，
 * 而不是留一个调不通的工具在目录里。
 *
 * 分工按「它靠什么工作」划，而不是按页面划：
 *   导航 3 个 —— 把面板送到该在的地方（execution 里只有地址和落点）
 *   自动化 1 个 —— 一串有顺序的步骤，带回每一步的真实状态
 *   页面 3 个 —— 读 DOM、拍像素、发真实输入（.boardmix 的眼睛和手）
 *   语义 2 个 —— 把文本交给产品自己的能力：Mermaid 转换（ADR bm-0002）、页内 AI（ADR bm-0003）
 */
export function registerTools(ctx: PluginContext): Disposable[] {
	if (!ctx.permissions.has("agent.tools.register")) return [];
	return [
		...registerNavigationTools(ctx),
		...registerDestinationTools(ctx),
		...registerAutomationTool(ctx),
		...registerSurfaceTools(ctx),
		...registerDiagramTool(ctx),
		...registerAiPromptTool(ctx),
	];
}
