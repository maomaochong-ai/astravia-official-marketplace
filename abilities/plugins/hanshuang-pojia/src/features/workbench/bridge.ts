import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import type { ReportMode, TriageReport } from "../../domain/report/report";
import type { TriageSample } from "../../domain/triage";
import type { ChatOutcome, ChatState, LibraryEntry, WorkbenchSettings } from "./state";

export type NotifyVariant = "info" | "success" | "warning" | "error";

/**
 * 面板需要的宿主能力。装配层（index.tsx）用 PluginContext 实现，
 * 组件与 hooks 只依赖这个接口，测试里换成假实现即可，不需要 import SDK。
 */
export interface WorkbenchBridge {
	listFiles(directory: string): Promise<PluginFsEntry[]>;
	/** 只取元信息，用来在读取之前判断大小是否超过宿主上限。 */
	stat(path: string, cwd: string | null): Promise<{ size: number } | null>;
	loadSample(path: string, cwd: string | null): Promise<TriageSample>;
	analyse(sample: TriageSample, options: { mode: ReportMode; disabledRules: readonly string[] }): Promise<TriageReport>;
	notify(message: string, variant?: NotifyVariant): void;
	saveReport(report: TriageReport, mode: ReportMode, format: "markdown" | "json"): Promise<string | null>;
	/** 把一句英文指令送进对话：有活跃会话就直接发，没有就新开一个。 */
	chat(prompt: string, cwd: string | null): Promise<ChatOutcome>;
	/** 订阅宿主对话状态；返回退订函数。 */
	subscribeChat(listener: (state: ChatState) => void): () => void;
	/** 宿主私有存储；没有 storage 权限时全部返回 null / false，面板退回会话内状态。 */
	readState<T>(path: string): Promise<T | null>;
	writeState(path: string, value: unknown): Promise<boolean>;
	settings(): Promise<WorkbenchSettings | null>;
	saveSettings(settings: WorkbenchSettings): Promise<boolean>;
	library(): Promise<LibraryEntry[] | null>;
	saveLibrary(entries: readonly LibraryEntry[]): Promise<boolean>;
}
