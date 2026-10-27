import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { registerDecompileFunctionTool } from "./native/decompile-function";
import { registerDiffBinariesTool } from "./native/diff-binaries";
import { registerDiffFunctionsTool } from "./native/diff-functions";
import { registerDisassembleRangeTool } from "./native/disassemble-range";
import { registerSearchDocsTool } from "./knowledge/search-docs";
import { registerExplainFindingTool } from "./knowledge/explain-finding";
import { registerExportReportTool } from "./report/export-triage-report";
import { registerListCodeSymbolsTool } from "./native/list-code-symbols";
import { registerScanStringsTool } from "./native/scan-strings";
import { registerReadDocTool } from "./knowledge/read-doc";
import { registerGenerateHookTool } from "./apk/generate-hook";
import { registerSearchDexSymbolsTool } from "./apk/search-dex-symbols";
import { registerTriageDirectoryTool } from "./native/triage-directory";
import { registerTriageBinaryTool } from "./native/triage-binary";
import { registerProbeEnvironmentTool } from "./env/probe-environment";
import { registerRunRadareTool } from "./native/run-radare";
import { registerDecompileAndroidTool } from "./apk/decompile-android";
import { registerInitTaskTool } from "./case/init-task";
import { registerWriteAssessmentTool } from "./report/write-assessment-report";
import { registerInstallToolchainTool } from "./env/install-toolchain";
import { registerKbChecklistTool } from "./knowledge/kb-checklist";
import { registerKbPayloadsTool } from "./knowledge/kb-payloads";
import { registerIdaStatusTool } from "./env/ida-status";
import { registerVerifySignatureTool } from "./apk/verify-signature";
import { registerGenerateArtifactTool } from "./native/generate-artifact";
import { registerInstallAstraviaTool } from "./env/install-astravia";
import { registerFridaDumpTool } from "./apk/frida-dump";
import { registerDisassembleDexMethodTool } from "./apk/disassemble-dex-method";
import { registerSearchCasesTool } from "./case/search-cases";
import { registerRecordCaseNoteTool } from "./case/record-case-note";
import { registerScaffoldCaseTool } from "./case/scaffold-case";

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
		registerKbChecklistTool,
		registerKbPayloadsTool,
		registerIdaStatusTool,
		registerVerifySignatureTool,
		registerGenerateArtifactTool,
		registerInstallAstraviaTool,
		registerFridaDumpTool,
		registerDisassembleDexMethodTool,
		registerSearchCasesTool,
		registerRecordCaseNoteTool,
		registerScaffoldCaseTool,
	]) {
		try {
			disposables.push(register(ctx));
		} catch (error) {
			console.error("[hanshuang-pojia] tool registration failed", error);
		}
	}
	return disposables;
}
