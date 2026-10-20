import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import type { ReportMode, TriageReport } from "../../domain/report/report";
import type { TriageSample } from "../../domain/triage";

export type NotifyVariant = "info" | "success" | "warning" | "error";

/** 把样本交给宿主 Agent 之后发生的事，用来给用户一句不同的反馈。 */
export type HandoffOutcome = "sent" | "opened";

/**
 * 面板需要的宿主能力。装配层（index.tsx）用 PluginContext 实现它，
 * 组件只依赖这个接口，测试里换成假实现即可，不需要 import SDK。
 */
export interface TriageBridge {
	listFiles(directory: string): Promise<PluginFsEntry[]>;
	/** 只取元信息，用来在读取之前判断大小是否超过宿主上限。 */
	stat(path: string, cwd: string | null): Promise<{ size: number } | null>;
	loadSample(path: string, cwd: string | null): Promise<TriageSample>;
	analyse(sample: TriageSample, mode: ReportMode): Promise<TriageReport>;
	notify(message: string, variant?: NotifyVariant): void;
	saveReport(report: TriageReport, mode: ReportMode, format: "markdown" | "json"): Promise<string | null>;
	/** 本地引擎读不了的样本交给对话里的 Agent：有活跃会话就直接发，没有就新开一个。 */
	handOff(prompt: string, cwd: string | null): Promise<HandoffOutcome>;
}
