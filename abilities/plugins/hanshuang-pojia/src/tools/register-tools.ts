import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { registerDecompileFunctionTool } from "./decompile-function";
import { registerDiffBinariesTool } from "./diff-binaries";
import { registerDiffFunctionsTool } from "./diff-functions";
import { registerDisassembleRangeTool } from "./disassemble-range";
import { registerSearchDocsTool } from "./search-docs";
import { registerExplainFindingTool } from "./explain-finding";
import { registerExportReportTool } from "./export-triage-report";
import { registerListCodeSymbolsTool } from "./list-code-symbols";
import { registerScanStringsTool } from "./scan-strings";
import { registerReadDocTool } from "./read-doc";
import { registerGenerateHookTool } from "./generate-hook";
import { registerSearchDexSymbolsTool } from "./search-dex-symbols";
import { registerTriageDirectoryTool } from "./triage-directory";
import { registerTriageBinaryTool } from "./triage-binary";
import { registerProbeEnvironmentTool } from "./probe-environment";
import { registerRunRadareTool } from "./run-radare";
import { registerDecompileAndroidTool } from "./decompile-android";
import { registerInitTaskTool } from "./init-task";
import { registerWriteAssessmentTool } from "./write-assessment-report";
import { registerInstallToolchainTool } from "./install-toolchain";

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
		registerDecompileFunctionTool,
		registerDiffFunctionsTool,
		registerGenerateHookTool,
		registerTriageDirectoryTool,
		registerSearchDocsTool,
		registerReadDocTool,
		registerProbeEnvironmentTool,
		registerRunRadareTool,
		registerDecompileAndroidTool,
		registerInitTaskTool,
		registerWriteAssessmentTool,
		registerInstallToolchainTool,
	]) {
		try {
			disposables.push(register(ctx));
		} catch (error) {
			console.error("[hanshuang-pojia] tool registration failed", error);
		}
	}
	return disposables;
}
