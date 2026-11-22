import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginFsEntry } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractStrings } from "../../../domain/strings";
import { entropyProfile, type EntropyBucket } from "../../../domain/entropy";
import { stringKind, type StringKind } from "../../../domain/string-kinds";
import { renderMarkdown, reportToJson, type TriageReport } from "../../../domain/report/report";
import { scopeForSample } from "../../../domain/sample-scope";
import {
	EMPTY_PROFILE,
	PROBE_PROFILE_PATH,
	type HostModelSnapshot,
	type ProbeProfile,
	type ProbeRecord,
} from "../../../domain/refusal-probe";
import type { ReportFile } from "../bridge";
import { resolveSamplePath } from "../../../domain/sample-path";
import { readNativeFacts } from "../../../domain/native/detect";
import { addressMapFor } from "../../../domain/native/image";
import type { TriageSample } from "../../../domain/triage";
import { subscribePanel } from "../../../runtime/panel-channel";
import type { NotifyVariant, WorkbenchBridge } from "../bridge";
import { buildPrompt, type PromptAction, type PromptContext } from "../prompts";
import type { MyCasesModel } from "./use-my-cases";
import { useMyCases } from "./use-my-cases";
import { chunkCount, IMPORT_DIRECTORY, importRelativePath, readChunkAsBase64 } from "../services/import-file";
import type { LibraryEntry, PageId, WorkbenchSettings } from "../state";
import { pathsToClear, storageEntries, type StorageScope } from "../../../domain/storage-layout";
import { useChat, type ChatModel } from "./use-chat";
import type { SampleFailure } from "../sample-error";
import type { HandoffReason, HandoffTarget } from "../services/sample-handoff";
import { classifySampleFailure } from "../sample-error";
import { useDisasm, type DisasmModel } from "./use-disasm";
import { useDocs, type DocsModel } from "./use-docs";
import { useCases, type CasesModel } from "./use-cases";
import { useCaseDocs, type CaseDocsModel } from "./use-case-docs";
import { useLab, type LabModel } from "./use-lab";
import { setAgentPage } from "../../../runtime/panel-channel";
import { useLibrary } from "./use-library";
import { useActivity, type ActivityModel } from "./use-activity";
import { buildTimeline, type Timeline } from "../timeline";
import { useTaskStream, type TaskStreamModel } from "./use-task-stream";
import { usePromptLibrary, type PromptLibraryModel } from "./use-prompt-library";


const SAMPLE_EXTENSIONS = [".apk", ".aab", ".ipa", ".jar", ".zip", ".dex", ".so", ".dll", ".exe", ".dylib", ".elf", ".bin", ".node", ".wasm", ".app"];

const MAX_LISTED = 120;

export type WorkbenchPhase = "idle" | "loading" | "ready" | "error";

/** 设置页一行数据占用。`unavailable` 表示存储没授权，不是「零字节」。 */
export interface StorageUsageRow {
	key: string;
	scope: string;
	path: string;
	files: number;
	bytes: number;
	unavailable: boolean;
}

export interface StringHit {
	value: string;
	offset: number;
	kind: StringKind;
}

/** 静态详情的三张视图。与页面内的三段内容一一对应。 */
export type StaticView = "manifest" | "entropy" | "signature";

/** 知识侧栏的阅读位置。`group` / `topic` / `slug` 为 null 表示没筛、没选。 */
export interface KnowledgeState {
	view: "docs" | "cases";
	/** 语料组（第一级筛选）。 */
	group: string | null;
	/** 子目录（第二级筛选）；只在选了组时有意义。 */
	topic: string | null;
	/** 正在读的随包先例。 */
	slug: string | null;
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
	/** 本机文件先复制进工作区再分析；宿主的读取通道不认项目外路径。 */
	importFile(file: File): void;
	reanalyse(): void;
	reset(): void;

	settings: WorkbenchSettings;
	updateSettings(patch: Partial<WorkbenchSettings>): void;
	persisted: boolean;

	entries: LibraryEntry[];
	reports: Record<string, TriageReport>;
	openEntry(id: string): void;
	clearLibrary(): void;
	/** 清掉当前评估（只清面板状态；reports/ 里的文件是交付物，不动）。 */
	clearReport(): void;

	compareA: string | null;
	compareB: string | null;
	setCompare(slot: "a" | "b", id: string | null): void;

	chat: ChatModel;
	lab: LabModel;
	activity: ActivityModel;
	stream: TaskStreamModel;
	/**
	 * 会话时间线：由 `stream.entries` 派生，一次算好三处共用（侧栏徽标、活动页、发现页观测）。
	 * 三处各算一遍不仅浪费，更危险的是任意一处改了判据就会与另两处说出不同的话。
	 */
	timeline: Timeline;

	promptLibrary: PromptLibraryModel["library"];
	promptBackups: PromptLibraryModel["backups"];
	createPrompt: PromptLibraryModel["createPrompt"];
	importPrompts: PromptLibraryModel["importPrompts"];
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
	/**
	 * 知识侧栏的阅读位置：看文档还是先例、筛的是哪个语料组、正在读哪份先例。
	 *
	 * 放在 model 而不是页面里，是因为切换视图会卸载子页；放本地 state 就会在
	 * 「从先例跳到战例研究，再回到案例」这条路上丢掉正在读的那一份。
	 */
	knowledge: KnowledgeState;
	patchKnowledge(patch: Partial<KnowledgeState>): void;
	/**
	 * 静态详情当前看哪一张视图（清单 / 熵 / 签名）。
	 *
	 * 与知识页的 `knowledge.view` 同理：存在 model 里，切到别的页再回来不会又回到第一张。
	 */
	staticView: StaticView;
	setStaticView(view: StaticView): void;
	cases: CasesModel;
	caseDocs: CaseDocsModel;
	/** 面板自己沉淀的案例库：按工作区隔离，与 cases/ 扫描结果并列展示。 */
	myCases: MyCasesModel;
	/** 上一次 `probe_refusal` 的落盘记录（工具写、面板读）。 */
	probe: {
		record: ProbeRecord | null;
		refresh(): void;
		/** 要测谁：端点 / 模型 / 风格 / 语言 / 档数。非机密，插件作用域持久化。 */
		profile: ProbeProfile;
		patchProfile(patch: Partial<ProbeProfile>): void;
		/** 宿主当前模型（provider / id / api 风格）；null = 还没读到。 */
		hostModel: HostModelSnapshot | null;
	};
	/** 把注入/卸载脚本落到工作区 `.hanshuang/inject/`；返回相对路径或 null。 */
	saveInjectScript(name: string, content: string): Promise<string | null>;
	/** 工作区 reports/ 下的报告（对话里产出的）。 */
	listReports(): Promise<ReportFile[]>;
	readReport(path: string): Promise<string | null>;
	/** 当前会话 id；存储的会话作用域靠它分区，null = 还没有活跃会话。 */
	sessionId: string | null;

	exportReport(format: "markdown" | "json"): void;
	copyReport(format: "markdown" | "json"): void;
	/** 用当前样本或读取失败开「交给宿主 Agent」确认框；提示词可改。 */
	handOff(): void;
	/** 指定路径开确认框；样本页/选择器用它。 */
	openHandoff(path: string, size?: number | null, reason?: HandoffReason): void;
	closeHandoff(): void;
	sendHandoff(prompt: string): void;
	handoff: { open: boolean; target: HandoffTarget | null };
	/** 导入进度 0–1；null 表示没在导入。 */
	importProgress: number | null;
	ask(action: PromptAction, extra?: Partial<PromptContext>): void;
	/** 把一句已经拼好的话直接送进去：发送前编辑过的文本走这里。 */
	askText(text: string): void;
	/** 同一句的预兑文本：对话框先用它填初值，用户改完再 askText。 */
	previewPrompt(action: PromptAction, extra?: Partial<PromptContext>): string;
	/** 清理插件自己写的文件；返回是否全部删成。 */
	clearStorage(scope: StorageScope | "all"): Promise<boolean>;
	/**
	 * 按路径清理：勾选式删除用。
	 *
	 * 与 `clearStorage` 分开而不是让它收一个路径数组：范围式清理要经过
	 * `pathsToClear` 补旧位置，勾选式清理的路径已经由调用方展开好了 —— 混成一个函数
	 * 就分不清「谁负责补 legacy」。
	 */
	clearPaths(paths: readonly string[]): Promise<boolean>;
	/** 每个作用域真实占了多少：文件数与字节数，来自宿主的 list + 快照，不是估算。 */
	storageUsage(): Promise<StorageUsageRow[]>;
	/** 把一段草稿存进我的案例：用户显式沉淀，不是自动搬运。 */
	recordDraft(prompt: string, tags?: readonly string[]): void;
	/** 面板气泡提示；下发给需要自报结果的子组件（注入块复制等）。 */
	notify(message: string, variant?: NotifyVariant): void;
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
	const chat = useChat(bridge, cwd, active);
	// 所有会话作用域的存储都以它分区：宿主 replay 的 conversation-changed 一到达就有值。
	const sessionId = chat.state.sessionId;
	// 报告按会话分文件，所以它在 chat 之后：会话 id 来自 chat 的状态。
	const library = useLibrary(bridge, cwd, sessionId);
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
	// 知识侧栏的阅读位置。
	//
	// 为什么不留在页面组件里：知识页用三元渲染切换文档/案例，子页会被整棵卸载，
	// 局部 state 随之清零 —— 后果是「正在读的先例」没了，而从先例跳到「战例研究」
	// 再回来时再也找不到那一份。三个字段一起提到 model，切页、切视图都不丢。
	const [knowledge, setKnowledge] = useState<KnowledgeState>({ view: "docs", group: null, topic: null, slug: null });
	const [staticView, setStaticView] = useState<StaticView>("manifest");
	const patchKnowledge = useCallback((patch: Partial<KnowledgeState>) => {
		setKnowledge(previous => ({ ...previous, ...patch }));
	}, []);
	const requestId = useRef(0);
	const { settings, remember } = library;
	const activity = useActivity(bridge, active);
	const stream = useTaskStream(bridge, active);
	const timeline = useMemo(() => buildTimeline(stream.entries), [stream.entries]);

	const refreshFiles = useCallback(() => {
		if (!cwd) {
			setFiles([]);
			return;
		}
		setFilesLoading(true);
		// 导入的本机样本落在工作区子目录里，而目录列举只给一层，所以两边形各列一次再合起来。
		Promise.all([
			bridge.listFiles(cwd).catch(() => [] as PluginFsEntry[]),
			bridge
				.listFiles(resolveSamplePath(cwd, IMPORT_DIRECTORY))
				.catch(() => [] as PluginFsEntry[]),
		])
			.then(([root, imported]) => {
				const byPath = new Map([...imported, ...root].map(entry => [entry.path, entry] as const));
				setFiles(toSamples([...byPath.values()]));
			})
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
	const docs = useDocs(bridge, page === "knowledge");
	const cases = useCases(bridge, cwd, page === "knowledge");
	// 面板自己的案例库：不随页面开关，因为分析完成后不管停在哪一页都要沉淀。
	const myCases = useMyCases(bridge, cwd);

	// 探测记录：工具跑完就落盘，面板进提示词页时读一次；不轮询。
	const [probeRecord, setProbeRecord] = useState<ProbeRecord | null>(null);
	/**
	 * 探测档案：端点与模型这类**非机密**信息。
	 *
	 * 存在插件作用域（不跟会话、不跟工作区）：同一个端点在不同会话里要测的还是同一个。
	 * 密钥不在这里 —— 见 domain/refusal-probe.ts 的 PROBE_PROFILE_PATH 注释。
	 */
	const [probeProfile, setProbeProfile] = useState<ProbeProfile>(EMPTY_PROFILE);
	const probeProfileLoaded = useRef(false);
	useEffect(() => {
		let alive = true;
		void bridge
			.readState<ProbeProfile>(PROBE_PROFILE_PATH)
			.then(stored => {
				if (!alive) return;
				if (stored && typeof stored === "object") {
					// 只合并已知字段：旧版本多写的键不该被带进表单。
					setProbeProfile({
						baseUrl: typeof stored.baseUrl === "string" ? stored.baseUrl : "",
						model: typeof stored.model === "string" ? stored.model : "",
						apiStyle: stored.apiStyle === "anthropic" ? "anthropic" : "openai",
						authHeader: typeof stored.authHeader === "string" ? stored.authHeader : "Authorization",
						lang: stored.lang === "en" ? "en" : "zh",
						level: typeof stored.level === "number" ? stored.level : 4,
					});
				}
			})
			.catch(() => undefined)
			.finally(() => {
				probeProfileLoaded.current = true;
			});
		return () => {
			alive = false;
		};
	}, [bridge]);

	// 宿主模型快照：运行时每轮写、这里进提示词页时读一次。
	const [hostModel, setHostModel] = useState<HostModelSnapshot | null>(null);
	useEffect(() => {
		if (page !== "prompts") return;
		let alive = true;
		void bridge.hostModel(sessionId).then(snapshot => {
			if (alive) setHostModel(snapshot);
		});
		return () => {
			alive = false;
		};
	}, [bridge, page]);

	const patchProfile = useCallback((patch: Partial<ProbeProfile>) => {
		setProbeProfile(previous => ({ ...previous, ...patch }));
	}, []);

	// 写回：只在读过之后写，否则首次挂载会用空档案覆盖已存的端点。
	useEffect(() => {
		if (!probeProfileLoaded.current) return;
		void bridge.writeState(PROBE_PROFILE_PATH, probeProfile).catch(() => undefined);
	}, [bridge, probeProfile]);
	const refreshProbe = useCallback(() => {
		void bridge.probeRecord(sessionId).then(setProbeRecord);
	}, [bridge]);
	useEffect(() => {
		if (page === "prompts") refreshProbe();
	}, [page, refreshProbe]);

	// 沉淀时机：一份报告出现就记一条。
	// 用 effect 而不是塞进 run()：run 在 myCases 之前定义，且面板从 agent 工具收到报告时
	// 不走 run——两条路径都应该落到同一处。按 sha+size+时间 去重，同一份报告只记一次。
	const recordedReport = useRef<string | null>(null);
	useEffect(() => {
		if (!report) return;
		const stamp = `${report.target.sha256}-${report.target.size}-${report.target.generatedAt}`;
		if (recordedReport.current === stamp) return;
		recordedReport.current = stamp;
		// 溯源：报告来自对话还是面板自分析，决定了 hostPrompt 有没有意义。
		myCases.record(report, {
			intent: fromAgent ? "host" : "triage",
			hostPrompt: fromAgent ? (chat.lastPrompt ?? "") : "",
			artifactRef: report.target.path,
			tags: [report.target.format],
		});
	}, [chat.lastPrompt, fromAgent, myCases, report]);
	// 案例正文只在案例页读：选中的案例一变就重新列目录，切走再回来不影响已选的案例。
	const caseDocs = useCaseDocs(bridge, cases.selected?.path ?? null);

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

	// 发送前编辑：先算出同一段文本给对话框当初值，用户改完再原样送进去。
	// 两者共用 buildPrompt，所以“预览的内容”就是“不编辑时发的内容”。
	const previewPrompt = useCallback(
		(action: PromptAction, extra: Partial<PromptContext> = {}) => buildPrompt(action, { target: promptTarget, ...extra }),
		[promptTarget],
	);

	const askText = useCallback((text: string) => chat.ask(text), [chat]);

	/**
	 * 会话隔离。
	 *
	 * 宿主的「新建会话」会推来新的 sessionId，但面板是同一个组件实例：内存里的
	 * report / sample / phase 不会自己清。结果是新会话里第一屏还挂着上一个会话的样本与评分
	 * —— 用户以为那是新会话扫出来的。
	 *
	 * 复位边界按存储作用域划，和 storage-layout 一一对应：
	 *   · 会话级（drafts）        → 随会话走，天然隔离；
	 *   · 工作区级（library/cases）→ 保留：同一目录下的历史不该因为换会话就消失；
	 *   · 插件级（settings/lab/prompts/probe profile）→ 保留：它们是「这台机器怎么配的」。
	 * 内存里只有 report 这一族属于「这一次分析」，所以只清它。
	 */
	const lastSession = useRef<string | null | undefined>(undefined);
	useEffect(() => {
		// 首帧不动作：挂载时 sessionId 常是 null，之后才被 replay 补上；
		// 那不是「切了会话」，清一次等于把刚恢复的报告抹掉。
		if (lastSession.current === undefined) {
			lastSession.current = sessionId;
			return;
		}
		if (lastSession.current === sessionId) return;
		lastSession.current = sessionId;
		setReport(null);
		setSample(null);
		setSelectedPath(null);
		setPhase("idle");
		setError(null);
		setFromAgent(false);
	}, [sessionId]);

	// 清理：只删插件自己写的文件，路径由 storage-layout 统一给出（含旧位置）。
	const clearPaths = useCallback((paths: readonly string[]) => bridge.removeState([...paths]), [bridge]);

	const clearStorage = useCallback(
		// 会话作用域必须带上当前 sessionId，否则会去清一个不存在的分区。
		(scope: StorageScope | "all") => bridge.removeState(pathsToClear(cwd, scope, sessionId)),
		[bridge, cwd, sessionId],
	);

	// 真实占用：逐项去问宿主，不估算。旧位置也算进去，否则用户会看到「清了但没少」。
	const storageUsage = useCallback(async (): Promise<StorageUsageRow[]> => {
		const rows: StorageUsageRow[] = [];
		for (const entry of storageEntries(cwd, sessionId)) {
			const primary = await bridge.stateUsage(entry.path);
			const legacy = entry.legacyPath ? await bridge.stateUsage(entry.legacyPath) : { files: 0, bytes: 0 };
			const unavailable = primary === null && legacy === null;
			rows.push({
				key: entry.key,
				scope: entry.scope,
				path: entry.path,
				files: (primary?.files ?? 0) + (legacy?.files ?? 0),
				bytes: (primary?.bytes ?? 0) + (legacy?.bytes ?? 0),
				unavailable,
			});
		}
		return rows;
	}, [bridge, cwd, sessionId]);

	// 用户显式沉淀一段草稿：这是会话草稿跨会话可见的唯一途径。
	const recordDraft = useCallback(
		(prompt: string, tags?: readonly string[]) => {
			myCases.recordDraft({ prompt, tags, model: null });
		},
		[myCases],
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

	const [handoffTarget, setHandoffTarget] = useState<HandoffTarget | null>(null);
	const [importProgress, setImportProgress] = useState<number | null>(null);

	const openHandoff = useCallback(
		(path: string, size: number | null = null, reason: HandoffReason = null) => {
			if (path.trim().length === 0) {
				bridge.notify(t("handoff.noPath"), "warning");
				return;
			}
			setHandoffTarget({ path, size, reason });
		},
		[bridge, t],
	);

	/** 引擎读不到的样本：把「为什么」先写进提示词，用户改完再交给对话里的 Agent。 */
	const handOff = useCallback(() => {
		if (error) {
			const reason: HandoffReason =
				error.kind === "too-large" ? "too-large" : error.kind === "outside-project" || error.kind === "host-blocked" ? "outside-project" : "other";
			openHandoff(error.detail, error.size ?? null, reason);
			return;
		}
		const path = report?.target.path ?? selectedPath;
		if (path) openHandoff(path, report?.target.size ?? null, "other");
	}, [error, openHandoff, report, selectedPath]);

	const closeHandoff = useCallback(() => setHandoffTarget(null), []);

	const sendHandoff = useCallback(
		(prompt: string) => {
			setHandoffTarget(null);
			chat.ask(prompt);
		},
		[chat],
	);

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

	const importFile = useCallback(
		(file: File) => {
			if (!cwd) {
				setPhase("error");
				setError({ kind: "other", detail: "No workspace folder is attached to this panel." });
				return;
			}
			const current = (requestId.current += 1);
			setPage("overview");
			setPhase("loading");
			setError(null);
			setFromAgent(false);
			setImportProgress(0);

			// 导入不设大小上限：文件来自用户自己的磁盘。分块只压低单次 IPC 体积，
			// 插件侧攒完最后一次写盘（宿主 fs 没有 append）。
			const total = chunkCount(file.size);
			let written: string | null = null;
			const upload = async () => {
				for (let index = 0; index < total; index += 1) {
					if (current !== requestId.current) return false;
					const base64 = await readChunkAsBase64(file, index);
					if (current !== requestId.current) return false;
					const target = await bridge.importSample({ name: file.name, base64, index, last: index === total - 1 }, cwd);
					if (index === total - 1) written = target;
					setImportProgress((index + 1) / total);
				}
				return true;
			};

			upload()
				.then(done => {
					if (!done || current !== requestId.current) return;
					// 落盘名由主进程净化，路径以它返回的为准；复制完就当成工作区里的普通样本读。
					analyse(written ?? resolveSamplePath(cwd, importRelativePath(file.name)));
					refreshFiles();
				})
				.catch((failure: unknown) => {
					if (current !== requestId.current) return;
					setSample(null);
					setReport(null);
					setPhase("error");
					setError({ kind: "other", detail: failure instanceof Error ? failure.message : String(failure) });
				})
				.finally(() => {
					if (current === requestId.current) setImportProgress(null);
				});
		},
		[analyse, bridge, cwd, refreshFiles],
	);

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
		sessionId,
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
		importFile,
		reanalyse,
		reset,
		settings,
		updateSettings,
		persisted: library.persisted,
		entries: library.entries,
		reports: library.reports,
		openEntry,
		clearLibrary: library.clearLibrary,
		clearReport: () => setReport(null),
		compareA,
		compareB,
		setCompare,
		chat,
		lab,
		activity,
		stream,
		timeline,
		promptLibrary: promptLib.library,
		promptBackups: promptLib.backups,
		createPrompt: promptLib.createPrompt,
		importPrompts: promptLib.importPrompts,
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
		cases,
		knowledge,
		staticView,
		setStaticView,
		patchKnowledge,
		myCases,
		probe: { record: probeRecord, refresh: refreshProbe, profile: probeProfile, patchProfile, hostModel },
		saveInjectScript: (name, content) => bridge.saveInjectScript(name, content),
		listReports: () => bridge.listReports(),
		readReport: path => bridge.readReport(path),
		caseDocs,
		exportReport,
		copyReport,
		handOff,
		openHandoff,
		closeHandoff,
		sendHandoff,
		handoff: { open: handoffTarget !== null, target: handoffTarget },
		importProgress,
		ask,
		askText,
		previewPrompt,
		clearStorage,
		clearPaths,
		storageUsage,
		recordDraft,
		notify: bridge.notify,
	};
}
