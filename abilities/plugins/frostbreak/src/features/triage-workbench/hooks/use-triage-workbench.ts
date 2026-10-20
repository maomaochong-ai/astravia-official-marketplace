import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportMode, TriageReport } from "../../../domain/report/report";
import type { TriageSample } from "../../../domain/triage";
import type { TriageBridge } from "../bridge";

/** 目录里优先列出的样本扩展名；其余文件仍可手动输入路径分析。 */
const SAMPLE_EXTENSIONS = [
	".apk",
	".aab",
	".ipa",
	".jar",
	".zip",
	".dex",
	".so",
	".dll",
	".exe",
	".dylib",
	".elf",
	".bin",
	".node",
	".wasm",
	".app",
];

const MAX_LISTED = 120;

export type WorkbenchPhase = "idle" | "loading" | "ready" | "error";

export interface TriageWorkbench {
	cwd: string | null;
	files: PluginFsEntry[];
	filesLoading: boolean;
	selectedPath: string | null;
	mode: ReportMode;
	phase: WorkbenchPhase;
	report: TriageReport | null;
	error: string | null;
	refreshFiles: () => void;
	analyse: (path: string) => void;
	selectMode: (mode: ReportMode) => void;
	reset: () => void;
	exportReport: (format: "markdown" | "json") => Promise<string | null>;
}

function isSampleName(name: string): boolean {
	const lower = name.toLowerCase();
	return SAMPLE_EXTENSIONS.some(extension => lower.endsWith(extension));
}

/** 只按大小排序，样本通常比源码文件更值得先看。 */
function toSamples(entries: PluginFsEntry[]): PluginFsEntry[] {
	return entries
		.filter(entry => !entry.isDirectory && isSampleName(entry.name))
		.sort((left, right) => right.size - left.size)
		.slice(0, MAX_LISTED);
}

export function useTriageWorkbench(bridge: TriageBridge, cwd: string | null): TriageWorkbench {
	const [files, setFiles] = useState<PluginFsEntry[]>([]);
	const [filesLoading, setFilesLoading] = useState(false);
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [mode, setMode] = useState<ReportMode>("summary");
	const [phase, setPhase] = useState<WorkbenchPhase>("idle");
	const [report, setReport] = useState<TriageReport | null>(null);
	const [error, setError] = useState<string | null>(null);
	const requestId = useRef(0);
	/** 最近读入内存的样本：切换 summary / full 时不必再从磁盘读一遍。 */
	const lastSample = useRef<TriageSample | null>(null);

	const refreshFiles = useCallback(() => {
		if (!cwd) {
			setFiles([]);
			return;
		}
		setFilesLoading(true);
		bridge
			.listFiles(cwd)
			.then(entries => setFiles(toSamples(entries)))
			.catch(() => setFiles([]))
			.finally(() => setFilesLoading(false));
	}, [bridge, cwd]);

	useEffect(() => {
		refreshFiles();
	}, [refreshFiles]);

	useEffect(
		() => () => {
			requestId.current += 1;
		},
		[],
	);

	const run = useCallback(
		(sample: TriageSample, nextMode: ReportMode) => {
			const current = (requestId.current += 1);
			setPhase("loading");
			setError(null);
			bridge
				.analyse(sample, nextMode)
				.then(result => {
					if (current !== requestId.current) return;
					setReport(result);
					setPhase("ready");
				})
				.catch((failure: unknown) => {
					if (current !== requestId.current) return;
					setReport(null);
					setPhase("error");
					setError(failure instanceof Error ? failure.message : String(failure));
				});
		},
		[bridge],
	);

	const analyse = useCallback(
		(path: string) => {
			const trimmed = path.trim();
			if (trimmed.length === 0) return;
			const current = (requestId.current += 1);
			setSelectedPath(trimmed);
			setPhase("loading");
			setError(null);
			bridge
				.loadSample(trimmed, cwd)
				.then(sample => {
					if (current !== requestId.current) return;
					lastSample.current = sample;
					run(sample, mode);
				})
				.catch((failure: unknown) => {
					if (current !== requestId.current) return;
					lastSample.current = null;
					setReport(null);
					setPhase("error");
					setError(failure instanceof Error ? failure.message : String(failure));
				});
		},
		[bridge, cwd, mode, run],
	);

	/** 切换详细程度时重跑同一份样本，否则界面上的内容会和开关不一致。 */
	const selectMode = useCallback(
		(next: ReportMode) => {
			if (next === mode) return;
			setMode(next);
			const sample = lastSample.current;
			if (sample) run(sample, next);
		},
		[mode, run],
	);

	const reset = useCallback(() => {
		requestId.current += 1;
		lastSample.current = null;
		setPhase("idle");
		setReport(null);
		setError(null);
	}, []);

	const exportReport = useCallback(
		(format: "markdown" | "json"): Promise<string | null> => (report ? bridge.saveReport(report, mode, format) : Promise.resolve(null)),
		[bridge, mode, report],
	);

	return {
		cwd,
		files,
		filesLoading,
		selectedPath,
		mode,
		phase,
		report,
		error,
		refreshFiles,
		analyse,
		selectMode,
		reset,
		exportReport,
	};
}
