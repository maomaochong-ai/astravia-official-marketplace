import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractStrings } from "../../../domain/strings";
import { entropyProfile, type EntropyBucket } from "../../../domain/entropy";
import { stringKind, type StringKind } from "../../../domain/string-kinds";
import { formatBytes, renderMarkdown, reportToJson, type TriageReport } from "../../../domain/report/report";
import { scopeForSample } from "../../../domain/sample-scope";
import { readNativeFacts } from "../../../domain/native/detect";
import { addressMapFor } from "../../../domain/native/image";
import type { TriageSample } from "../../../domain/triage";
import { subscribePanel } from "../../../runtime/panel-channel";
import type { WorkbenchBridge } from "../bridge";
import { buildPrompt, type PromptAction, type PromptContext } from "../prompts";
import type { SampleFailure } from "../sample-error";
import { classifySampleFailure } from "../sample-error";
import type { LibraryEntry, PageId, WorkbenchSettings } from "../state";
import { useChat, type ChatModel } from "./use-chat";
import { useDisasm, type DisasmModel } from "./use-disasm";
import { useDocs, type DocsModel } from "./use-docs";
import { useLab, type LabModel } from "./use-lab";
import { setAgentPage } from "../../../runtime/panel-channel";
import { useLibrary } from "./use-library";
import { useActivity, type ActivityModel } from "./use-activity";
import { useTaskStream, type TaskStreamModel } from "./use-task-stream";
import { usePromptLibrary, type PromptLibraryModel } from "./use-prompt-library";


const SAMPLE_EXTENSIONS = [".apk", ".aab", ".ipa", ".jar", ".zip", ".dex", ".so", ".dll", ".exe", ".dylib", ".elf", ".bin", ".node", ".wasm", ".app"];

const MAX_LISTED = 120;

export type WorkbenchPhase = "idle" | "loading" | "ready" | "error";

export interface StringHit {
	value: string;
	offset: number;
	kind: StringKind;
}

export interface WorkbenchModel {
	cwd: string | null;
	page: PageId;
	go(page: PageId): void;

	files: PluginFsEntry[];
	filesLoading: boolean;
	refreshFiles(): void;

	pathInput: string;
	setPathInput(value: string): void;

	selectedPath: string | null;
	phase: WorkbenchPhase;
	report: TriageReport | null;
	error: SampleFailure | null;
	/** 当前报告来自对话里的 Agent，而不是面板自己的分析。 */
	fromAgent: boolean;

	analyse(path: string): void;
	reanalyse(): void;
	reset(): void;

	settings: WorkbenchSettings;
	updateSettings(patch: Partial<WorkbenchSettings>): void;
	persisted: boolean;

	entries: LibraryEntry[];
	reports: Record<string, TriageReport>;
	openEntry(id: string): void;
	clearLibrary(): void;

	compareA: string | null;
	compareB: string | null;
	setCompare(slot: "a" | "b", id: string | null): void;

	chat: ChatModel;
	lab: LabModel;
	activity: ActivityModel;
	stream: TaskStreamModel;

	promptLibrary: PromptLibraryModel["library"];
	promptBackups: PromptLibraryModel["backups"];
	createPrompt: PromptLibraryModel["createPrompt"];
	updatePrompt: PromptLibraryModel["updatePrompt"];
	deletePrompt: PromptLibraryModel["deletePrompt"];
	activatePrompt: PromptLibraryModel["activatePrompt"];
	deactivatePrompt: PromptLibraryModel["deactivatePrompt"];
	restorePromptFromBackup: PromptLibraryModel["restorePromptFromBackup"];
	deleteBackup: PromptLibraryModel["deleteBackup"];


	strings: StringHit[] | null;
	entropy: EntropyBucket[] | null;
	disasm: DisasmModel;
	docs: DocsModel;

	exportReport(format: "markdown" | "json"): void;
	copyReport(format: "markdown" | "json"): void;
	handOff(): void;
	ask(action: PromptAction, extra?: Partial<PromptContext>): void;
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

export function useWorkbench(bridge: WorkbenchBridge, cwd: string | null, options: { active?: boolean } = {}): WorkbenchModel {
	const { t } = useTranslation();
	const active = options.active !== false;
	const library = useLibrary(bridge);
	const chat = useChat(bridge, cwd, active);
	const lab = useLab(bridge);
	const promptLib = usePromptLibrary(bridge);

	const [page, setPage] = useState<PageId>("overview");
	const [files, setFiles] = useState<PluginFsEntry[]>([]);
	const [filesLoading, setFilesLoading] = useState(false);
	const [pathInput, setPathInput] = useState("");
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [phase, setPhase] = useState<WorkbenchPhase>("idle");
	const [report, setReport] = useState<TriageReport | null>(null);
	const [sample, setSample] = useState<TriageSample | null>(null);
	const [error, setError] = useState<SampleFailure | null>(null);
	const [fromAgent, setFromAgent] = useState(false);
	const [compareA, setCompareA] = useState<string | null>(null);
	const [compareB, setCompareB] = useState<string | null>(null);

	const requestId = useRef(0);
	const { settings, remember } = library;
	const activity = useActivity(bridge, active);
	const stream = useTaskStream(bridge, active);

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
		(nextSample: TriageSample) => {
			const current = (requestId.current += 1);
			setPhase("loading");
			setError(null);
			setFromAgent(false);
			bridge
				.analyse(nextSample, { mode: settings.mode, disabledRules: settings.disabledRules })
				.then(result => {
					if (current !== requestId.current) return;
					setReport(result);
					setSample(nextSample);
					setPhase("ready");
					remember(result);
				})
				.catch((failure: unknown) => {
					if (current !== requestId.current) return;
					setReport(null);
					setPhase("error");
					setError({ kind: "other", detail: failure instanceof Error ? failure.message : String(failure) });
				});
		},
		[bridge, remember, settings.disabledRules, settings.mode],
	);

	const analyse = useCallback(
		(path: string) => {
			const trimmed = path.trim();
			if (trimmed.length === 0) return;
			setSelectedPath(trimmed);
			setPathInput(trimmed);
			const current = (requestId.current += 1);
			// 宿主只授权项目根目录，越界路径必然抛被包住的 CapabilityError；先判一次，
			// 免得用户等一轮 IPC 才看到一句无法照做的英文报错。
			setPage("overview");
			if (scopeForSample(trimmed, cwd, null) === "outside-project") {
				setSample(null);
				setReport(null);
				setPhase("error");
				setError({ kind: "outside-project", detail: trimmed });
				return;
			}
			setPhase("loading");
			setError(null);
			// 先 stat 再读：宿主的读取上限是硬性的，超限时不必把整次 IPC 读一遍才失败。
			bridge
				.stat(trimmed, cwd)
				.catch(() => null)
				.then(entry => {
					if (current !== requestId.current) return null;
					if (entry && scopeForSample(trimmed, cwd, entry.size) === "too-large") {
						setSample(null);
						setReport(null);
						setPhase("error");
						setError({ kind: "too-large", detail: trimmed, size: entry.size });
						return null;
					}
					return bridge.loadSample(trimmed, cwd);
				})
				.then(loaded => {
					if (!loaded || current !== requestId.current) return;
					run(loaded);
				})
				.catch((failure: unknown) => {
					if (current !== requestId.current) return;
					const message = failure instanceof Error ? failure.message : String(failure);
					setSample(null);
					setReport(null);
					setPhase("error");
					setError({ kind: classifySampleFailure(message), detail: message });
				});
		},
		[bridge, cwd, run],
	);

	const reanalyse = useCallback(() => {
		const target = sample ?? null;
		if (target) {
			run(target);
			return;
		}
		if (selectedPath) analyse(selectedPath);
	}, [analyse, run, sample, selectedPath]);

	const reset = useCallback(() => {
		requestId.current += 1;
		setPhase("idle");
		setReport(null);
		setSample(null);
		setError(null);
		setFromAgent(false);
		setSelectedPath(null);
	}, []);

	// 对话里的 Agent 跑完 triage_binary 后把报告推回面板：样本库与当前视图都跟着更新。
	useEffect(() => {
		// 与活动流同一个开关：面板不在前台时不收事件，让它们留在 channel 的积压里，
		// 切回前台时一次性重放。这样「聊天在跑、面板关着」时插件侧零渲染。
		if (!active) return;
		return subscribePanel(event => {
			if (event.type !== "report") return;
			requestId.current += 1;
			setReport(event.report);
			setSample(null);
			setSelectedPath(event.report.target.path);
			setPathInput(event.report.target.path);
			setError(null);
			setPhase("ready");
			setFromAgent(true);
			remember(event.report);
			setPage("overview");
		});
	}, [active, remember]);


	const openEntry = useCallback(
		(id: string) => {
			const stored = library.reports[id];
			if (!stored) {
				bridge.notify(t("library.sessionOnly"), "info");
				return;
			}
			requestId.current += 1;
			setReport(stored);
			setSample(null);
			setSelectedPath(stored.target.path);
			setPhase("ready");
			setError(null);
			setFromAgent(false);
			setPage("overview");
		},
		[bridge, library.reports, t],
	);

	const strings = useMemo<StringHit[] | null>(() => {
		if (!sample) return null;
		return extractStrings(sample.bytes, {
			minLength: settings.stringsMinLength,
			maxResults: settings.stringsLimit,
			encodings: ["ascii", "utf16le"],
		}).map(hit => ({ value: hit.value, offset: hit.offset, kind: stringKind(hit.value) }));
	}, [sample, settings.stringsLimit, settings.stringsMinLength]);

	// 原生事实与地址映射是深层反汇编的输入：一次解析，字符串/入口/节区共用。
	const native = useMemo(() => (sample ? readNativeFacts(sample.bytes) : null), [sample]);
	const nativeFacts = native?.value ?? null;
	const nativeMap = useMemo(() => (nativeFacts ? addressMapFor(nativeFacts) : null), [nativeFacts]);
	const disasm = useDisasm({ bytes: sample?.bytes ?? null, facts: nativeFacts, map: nativeMap, bridge, enabled: page === "disasm" });
	const docs = useDocs(bridge, page === "docs");

	const entropy = useMemo<EntropyBucket[] | null>(() => {
		if (!sample) return null;
		return entropyProfile(sample.bytes, settings.entropyBuckets);
	}, [sample, settings.entropyBuckets]);

	const promptTarget = useMemo(() => {
		if (!report) return undefined;
		return {
			name: report.target.name,
			path: report.target.path,
			format: report.target.format,
			score: report.risk.score,
			grade: report.risk.grade,
			findings: report.findings.length,
		};
	}, [report]);

	const ask = useCallback(
		(action: PromptAction, extra: Partial<PromptContext> = {}) => {
			chat.ask(buildPrompt(action, { target: promptTarget, ...extra }));
		},
		[chat, promptTarget],
	);

	const copyReport = useCallback(
		(format: "markdown" | "json") => {
			if (!report) return;
			const text = format === "json" ? reportToJson(report) : renderMarkdown(report, { mode: settings.mode });
			navigator.clipboard?.writeText(text).then(
				() => bridge.notify(t("panel.action.copied"), "success"),
				() => bridge.notify(t("panel.action.copyFailed"), "error"),
			);
		},
		[bridge, report, settings.mode, t],
	);

	const exportReport = useCallback(
		(format: "markdown" | "json") => {
			if (!report) return;
			bridge
				.saveReport(report, settings.mode, format)
				.then(saved => {
					bridge.notify(saved ? t("panel.action.saved", { path: saved }) : t("panel.action.exportCancelled"), saved ? "success" : "info");
				})
				.catch((failure: unknown) => {
					bridge.notify(t("panel.action.exportFailed", { message: failure instanceof Error ? failure.message : String(failure) }), "error");
				});
		},
		[bridge, report, settings.mode, t],
	);

	/** 引擎读不到的样本：把「为什么」和「接着查什么」一并交给对话里的 Agent。 */
	const handOff = useCallback(() => {
		if (!error) return;
		const reason = t(error.kind === "too-large" ? "panel.blocked.reason.tooLarge" : "panel.blocked.reason.outside");
		const size = error.size ? formatBytes(error.size) : undefined;
		chat.ask(t("panel.handoff.prompt", { path: error.detail, reason, size: size ?? "" }));
	}, [chat, error, t]);

	const updateSettings = useCallback(
		(patch: Partial<WorkbenchSettings>) => {
			library.updateSettings(patch);
		},
		[library],
	);

	/** 扫码模式 / 规则开关变化后，已有样本要重跑一次，否则界面和设置不一致。 */
	const previousSettings = useRef(settings);
	useEffect(() => {
		const before = previousSettings.current;
		previousSettings.current = settings;
		if (before === settings) return;
		const changed = before.mode !== settings.mode || before.disabledRules !== settings.disabledRules;
		if (changed && sample && phase === "ready") run(sample);
	}, [phase, run, sample, settings]);

	const setCompare = useCallback((slot: "a" | "b", id: string | null) => {
		if (slot === "a") setCompareA(id);
		else setCompareB(id);
	}, []);

	const go = useCallback(
		(next: PageId) => {
			setPage(next);
			// 页面信号给动态提示块用：模型据此知道用户在看哪一块，而不是猜。
			setAgentPage(next);
		},
		[],
	);

	return {
		cwd,
		page,
		go,
		files,
		filesLoading,
		refreshFiles,
		pathInput,
		setPathInput,
		selectedPath,
		phase,
		report,
		error,
		fromAgent,
		analyse,
		reanalyse,
		reset,
		settings,
		updateSettings,
		persisted: library.persisted,
		entries: library.entries,
		reports: library.reports,
		openEntry,
		clearLibrary: library.clearLibrary,
		compareA,
		compareB,
		setCompare,
		chat,
		lab,
		activity,
		stream,
		promptLibrary: promptLib.library,
		promptBackups: promptLib.backups,
		createPrompt: promptLib.createPrompt,
		updatePrompt: promptLib.updatePrompt,
		deletePrompt: promptLib.deletePrompt,
		activatePrompt: promptLib.activatePrompt,
		deactivatePrompt: promptLib.deactivatePrompt,
		restorePromptFromBackup: promptLib.restorePromptFromBackup,
		deleteBackup: promptLib.deleteBackup,
		strings,
		entropy,
		disasm,
		docs,
		exportReport,
		copyReport,
		handOff,
		ask,
	};
}
