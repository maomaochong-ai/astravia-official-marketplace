import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { registerExplainFindingTool } from "./explain-finding";
import { registerExportReportTool } from "./export-triage-report";
import { registerScanStringsTool } from "./scan-strings";
import { registerTriageBinaryTool } from "./triage-binary";

/**
 * 工具注册总入口。每个工具单独 try：
 * 缺少 agent.tools.register / agent.toolHandler.execute 时只跳过该工具，
 * 不影响活动面板和其它工具。
 */
export function registerTools(ctx: PluginContext): Disposable[] {
	const disposables: Disposable[] = [];
	for (const register of [registerTriageBinaryTool, registerScanStringsTool, registerExplainFindingTool, registerExportReportTool]) {
		try {
			disposables.push(register(ctx));
		} catch (error) {
			console.error("[frostbreak] tool registration failed", error);
		}
	}
	return disposables;
}
