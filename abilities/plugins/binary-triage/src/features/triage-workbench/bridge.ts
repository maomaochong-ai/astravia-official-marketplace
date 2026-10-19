import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import type { ReportMode, TriageReport } from "../../domain/report/report";
import type { TriageSample } from "../../domain/triage";

export type NotifyVariant = "info" | "success" | "warning" | "error";

/**
 * 面板需要的宿主能力。装配层（index.tsx）用 PluginContext 实现它，
 * 组件只依赖这个接口，测试里换成假实现即可，不需要 import SDK。
 */
export interface TriageBridge {
	listFiles(directory: string): Promise<PluginFsEntry[]>;
	loadSample(path: string, cwd: string | null): Promise<TriageSample>;
	analyse(sample: TriageSample, mode: ReportMode): Promise<TriageReport>;
	notify(message: string, variant?: NotifyVariant): void;
	saveReport(report: TriageReport, mode: ReportMode, format: "markdown" | "json"): Promise<string | null>;
}
