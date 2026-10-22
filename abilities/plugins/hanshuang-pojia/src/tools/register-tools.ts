import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { registerDiffBinariesTool } from "./diff-binaries";
import { registerDisassembleRangeTool } from "./disassemble-range";
import { registerSearchDocsTool } from "./search-docs";
import { registerExplainFindingTool } from "./explain-finding";
import { registerExportReportTool } from "./export-triage-report";
import { registerListCodeSymbolsTool } from "./list-code-symbols";
import { registerScanStringsTool } from "./scan-strings";
import { registerReadDocTool } from "./read-doc";
import { registerSearchDexSymbolsTool } from "./search-dex-symbols";
import { registerTriageBinaryTool } from "./triage-binary";

/**
 * 工具注册总入口。每个工具单独 try：
 * 缺少 agent.tools.register / agent.toolHandler.execute 时只跳过该工具，
 * 不影响活动面板和其它工具。
 */
export function registerTools(ctx: PluginContext): Disposable[] {
	const disposables: Disposable[] = [];
	for (const register of [
		registerTriageBinaryTool,
		registerScanStringsTool,
		registerExplainFindingTool,
		registerExportReportTool,
		registerListCodeSymbolsTool,
		registerDisassembleRangeTool,
		registerSearchDexSymbolsTool,
		registerDiffBinariesTool,
		registerSearchDocsTool,
		registerReadDocTool,
	]) {
		try {
			disposables.push(register(ctx));
		} catch (error) {
			console.error("[hanshuang-pojia] tool registration failed", error);
		}
	}
	return disposables;
}
