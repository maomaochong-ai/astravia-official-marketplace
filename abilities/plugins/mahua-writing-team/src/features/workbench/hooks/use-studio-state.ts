import { useCallback, useEffect, useState } from "react";
import type { ServiceResult, StudioService } from "../../../application/studio-service.js";
import type {
	ArbitrationRecord,
	Finding,
	NovelBook,
	ReviewReport,
	StoryThread,
} from "../../../domain/novel-types.js";
import type { CredentialSource } from "../../../entitlement/entitlement-gate.js";
import type { EntitlementState, TrustedKey } from "../../../entitlement/verify-entitlement.js";
import { getStudioRuntime } from "../../../plugin-context.js";
import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";

/**
 * 工作台读到的全部事实，一次取齐。
 *
 * 写操作只有两个，且都不在这里发明规则：激活页的凭证（`activate` / `clearCredential`）
 * 和书页的删除（`deleteBook`）。七帧里没有一处派活、提交或体检按钮——那些是模型的活，
 * 界面只读它们的产物。
 *
 * 同步只有一个方向：侧栏里的团队把文件落盘 → `refresh()` 重新读 → 界面自己变。
 */
export interface StudioState {
	loading: boolean;
	error: string | null;
	books: BookIndexEntry[];
	book: NovelBook | null;
	review: ReviewReport | null;
	chapterText: string;
	selectedChapter: number | null;
	threads: StoryThread[];
	decisions: ArbitrationRecord[];
	findings: Finding[];
	entitlement: EntitlementState;
	credentialSource: CredentialSource;
	rejectedCredential: EntitlementState | null;
	selectBook: (bookId: string) => void;
	selectChapter: (chapter: number) => void;
	refresh: () => void;
	activate: (token: string) => Promise<EntitlementState>;
	clearCredential: () => Promise<EntitlementState>;
	deleteBook: (bookId: string) => Promise<ServiceResult<{ id: string }>>;
	trustedKeys: () => readonly TrustedKey[];
}

interface Selected {
	bookId: string | null;
	chapter: number | null;
}

interface Snapshot {
	books: BookIndexEntry[];
	book: NovelBook | null;
	review: ReviewReport | null;
	chapterText: string;
	selectedChapter: number | null;
	threads: StoryThread[];
	decisions: ArbitrationRecord[];
	findings: Finding[];
}

async function readChapterOf(
	service: StudioService,
	book: NovelBook | null,
	selected: Selected,
): Promise<{ text: string; chapter: number | null }> {
	if (!book) return { text: "", chapter: null };
	const target = selected.chapter ?? book.progress.currentChapter;
	const result = await service.readChapter(target, book.id);
	if (!result.ok) return { text: "", chapter: null };
	return { text: result.data.text, chapter: result.data.n };
}

async function readReviewOf(
	service: StudioService,
	book: NovelBook | null,
	chapter: number | null,
): Promise<ReviewReport | null> {
	if (!book || chapter === null) return null;
	const result = await service.readReview(chapter, book.id);
	return result.ok ? result.data : null;
}

/**
 * 选中的书与章记在模块里：全屏是覆盖层，切进切出会重新挂载整棵工作台，
 * 跟着组件走的选择会在展开的一瞬被清掉——读者正读到第 26 章，不该因此回到默认章节。
 */
let memorySelection: Selected = { bookId: null, chapter: null };

function rememberSelection(next: Selected): Selected {
	memorySelection = next;
	return next;
}

/**
 * 上一次读到的内容也记在模块里，用途不同：重新挂载时**不闪**。
 *
 * 宿主会在几种时候把这张工作台整个拆掉再装上（切走标签页、重载插件、面板被收起）。
 * 每次从 `loading: true` 开始，读者看到的是骨架屏再跑一遍，哪怕磁盘上什么都没变。
 * 带着上次读到的事实起跑，第一帧就和离开时一样，随后那一趟读再把差异补上——数据只有
 * 一个来源，所以补上的过程本身就是对的。
 */
let memorySnapshot: Snapshot | null = null;

/**
 * 盘上最后一次读到的指纹。
 *
 * 宿主没给插件存储的变更事件（SDK 只有目录 watch，且看不到 `commit()`），所以模型刚写完
 * 的那几秒里，界面会停在旧事实上——“书写好了但工作台还说在简介阶段”就是这么来的。
 * 用一次只读书文件的原子读当心跳，比重新挂载才能看到结果实用。
 */
let memorySignature = "";

/** 心跳间隔：比活动流（1.2 秒）慢，比人察觉“界面卡住”快。 */
const WATCH_MS = 2500;

export function useStudioState(): StudioState {
	const { service } = getStudioRuntime();
	const [version, setVersion] = useState(0);
	const [selected, setSelected] = useState<Selected>(() => memorySelection);
	const [loading, setLoading] = useState(() => memorySnapshot === null);
	const [error, setError] = useState<string | null>(null);

	const [books, setBooks] = useState<BookIndexEntry[]>(() => memorySnapshot?.books ?? []);
	const [book, setBook] = useState<NovelBook | null>(() => memorySnapshot?.book ?? null);
	const [review, setReview] = useState<ReviewReport | null>(() => memorySnapshot?.review ?? null);
	const [chapterText, setChapterText] = useState(() => memorySnapshot?.chapterText ?? "");
	const [selectedChapter, setSelectedChapter] = useState<number | null>(
		() => memorySnapshot?.selectedChapter ?? null,
	);
	const [threads, setThreads] = useState<StoryThread[]>(() => memorySnapshot?.threads ?? []);
	const [decisions, setDecisions] = useState<ArbitrationRecord[]>(() => memorySnapshot?.decisions ?? []);
	const [findings, setFindings] = useState<Finding[]>(() => memorySnapshot?.findings ?? []);

	const [entitlement, setEntitlement] = useState<EntitlementState>(service.entitlementState);
	const [credentialSource, setCredentialSource] = useState<CredentialSource>(service.credentialSource);
	const [rejectedCredential, setRejectedCredential] = useState<EntitlementState | null>(service.rejectedCredential);

	const refresh = useCallback(() => {
		setEntitlement(service.entitlementState);
		setCredentialSource(service.credentialSource);
		setRejectedCredential(service.rejectedCredential);
		setVersion((value) => value + 1);
	}, [service]);

	useEffect(() => {
		let live = true;

		const load = async (): Promise<void> => {
			const index = await service.listBooks();
			if (!live) return;
			const nextBooks = index.ok ? index.data : [];
			setBooks(nextBooks);

			const next = selected.bookId ? await service.resolveBook(selected.bookId) : await service.loadLatestBook();
			if (!live) return;
			setBook(next);

			const chapter = await readChapterOf(service, next, selected);
			if (!live) return;
			setChapterText(chapter.text);
			setSelectedChapter(chapter.chapter);

			const report = await readReviewOf(service, next, chapter.chapter);
			if (!live) return;
			setReview(report);

			const threadResult = await service.threads(next?.id);
			if (!live) return;
			const nextThreads = threadResult.ok ? threadResult.data : [];
			setThreads(nextThreads);

			const decisionResult = await service.decisions(next?.id);
			if (!live) return;
			const nextDecisions = decisionResult.ok ? decisionResult.data : [];
			setDecisions(nextDecisions);

			const consistency = await service.checkConsistency(next?.id);
			if (!live) return;
			const nextFindings = consistency.ok ? consistency.data.findings : [];
			setFindings(nextFindings);

			memorySnapshot = {
				books: nextBooks,
				book: next,
				review: report,
				chapterText: chapter.text,
				selectedChapter: chapter.chapter,
				threads: nextThreads,
				decisions: nextDecisions,
				findings: nextFindings,
			};
			if (!live) return;
			// 读完顺手记下指纹：这一趟看到的盘面就是“已知”的盘面，心跳不该为它再刷一次。
			// 写在存活检查之后：卸载中的旧读取不能把它算出来的指纹盖到新基线上。
			memorySignature = await service.shelfSignature(next?.id);
			if (!live) return;
			setLoading(false);
		};

		void load().catch((cause: unknown) => {
			if (!live) return;
			setError(cause instanceof Error ? cause.message : String(cause));
			setLoading(false);
		});

		return () => {
			live = false;
		};
	}, [service, selected, version]);

	/*
	 * 心跳：模型在对话里把书改了，宿主不会告诉这张面板。只比指纹，不重读整本书，
	 * 也不看宿主 revision（活动流每 1.2 秒就会推它一遍）。
	 */
	const watchId = book?.id ?? selected.bookId ?? undefined;

	useEffect(() => {
		let live = true;
		const timer = setInterval(() => {
			void service
				.shelfSignature(watchId)
				.then((signature) => {
					if (!live || signature === memorySignature) return;
					// 先认下这个指纹再重读：重读若失败（宿主正在写、凭证被清），下一跳不该又刷一次，
					// 否则面板会以心跳频率无休止地空转。真正的下一次变更会再推进指纹。
					memorySignature = signature;
					refresh();
				})
				.catch(() => {
					/* 读失败不该让工作台停摆：下一跳再试。 */
				});
		}, WATCH_MS);
		return () => {
			live = false;
			clearInterval(timer);
		};
	}, [service, watchId, refresh]);

	const selectBook = useCallback((bookId: string) => {
		setSelected(rememberSelection({ bookId, chapter: null }));
	}, []);

	const selectChapter = useCallback((chapter: number) => {
		setSelected((current) => rememberSelection({ bookId: current.bookId, chapter }));
	}, []);

	const activate = useCallback(
		async (token: string) => {
			const next = await service.activate(token);
			refresh();
			return next;
		},
		[service, refresh],
	);

	const clearCredential = useCallback(async () => {
		const next = await service.clearCredential();
		refresh();
		return next;
	}, [service, refresh]);

	const deleteBook = useCallback(
		async (bookId: string) => {
			const result = await service.deleteBook(bookId);
			if (!result.ok) return result;

			// 缓存里那一行已经作废；下一次挂载老实重读，别把删掉的书端回来。
			memorySnapshot = null;
			if (memorySelection.bookId === bookId) {
				// 清掉选择，读数据的那一趟会自己回落到最新的一本（或一本都没有）。
				setSelected(rememberSelection({ bookId: null, chapter: null }));
			} else {
				refresh();
			}
			return result;
		},
		[service, refresh],
	);

	return {
		loading,
		error,
		books,
		book,
		review,
		chapterText,
		selectedChapter,
		threads,
		decisions,
		findings,
		entitlement,
		credentialSource,
		rejectedCredential,
		selectBook,
		selectChapter,
		refresh,
		activate,
		clearCredential,
		deleteBook,
		trustedKeys: () => service.trustedKeys(),
	};
}
