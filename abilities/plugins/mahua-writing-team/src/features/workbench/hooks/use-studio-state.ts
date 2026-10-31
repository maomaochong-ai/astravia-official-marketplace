import { useCallback, useEffect, useState } from "react";
import type { StudioService } from "../../../application/studio-service.js";
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
 * 这里**没有写操作**：七帧里没有一处派活、提交或体检按钮（设计稿四条边界之一）。
 * 唯一会改状态的是激活页的凭证，它走 `activate` / `clearCredential` 两个入口。
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
	trustedKeys: () => readonly TrustedKey[];
}

interface Selected {
	bookId: string | null;
	chapter: number | null;
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

export function useStudioState(): StudioState {
	const { service } = getStudioRuntime();
	const [version, setVersion] = useState(0);
	const [selected, setSelected] = useState<Selected>(() => memorySelection);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [books, setBooks] = useState<BookIndexEntry[]>([]);
	const [book, setBook] = useState<NovelBook | null>(null);
	const [review, setReview] = useState<ReviewReport | null>(null);
	const [chapterText, setChapterText] = useState("");
	const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
	const [threads, setThreads] = useState<StoryThread[]>([]);
	const [decisions, setDecisions] = useState<ArbitrationRecord[]>([]);
	const [findings, setFindings] = useState<Finding[]>([]);

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
			setBooks(index.ok ? index.data : []);

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
			setThreads(threadResult.ok ? threadResult.data : []);

			const decisionResult = await service.decisions(next?.id);
			if (!live) return;
			setDecisions(decisionResult.ok ? decisionResult.data : []);

			const consistency = await service.checkConsistency(next?.id);
			if (!live) return;
			setFindings(consistency.ok ? consistency.data.findings : []);
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
		trustedKeys: () => service.trustedKeys(),
	};
}
