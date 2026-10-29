import { useCallback, useEffect, useState } from "react";
import type { StudioService } from "../../../application/studio-service.js";
import type { ServiceResult } from "../../../application/studio-service.js";
import type { NovelBook, ReviewReport } from "../../../domain/novel-types.js";
import { routeNovel } from "../../../domain/novel-flow.js";
import type { TrustedKey } from "../../../entitlement/verify-entitlement.js";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";
import type { CredentialSource } from "../../../entitlement/entitlement-gate.js";
import { getStudioRuntime } from "../../../plugin-context.js";
import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";

export interface StudioState {
	loading: boolean;
	error: string | null;
	books: BookIndexEntry[];
	book: NovelBook | null;
	review: ReviewReport | null;
	chapterText: string;
	selectedChapter: number | null;
	entitlement: EntitlementState;
	/** 生效凭证从哪来：自己填的还是随包的。 */
	credentialSource: CredentialSource;
	/** 自己那份被拒时的结果，用于说清「为什么我填的没用」。 */
	rejectedCredential: EntitlementState | null;
	selectBook(id: string): void;
	selectChapter(n: number): void;
	refresh(): void;
	acceptBrief(): Promise<boolean>;
	startDrafting(): Promise<boolean>;
	commitChapter(n: number): Promise<boolean>;
	closeArc(): Promise<boolean>;
	finalize(): Promise<boolean>;
	createBook(input: {
		title: string;
		genre: string;
		premise: string;
		targetChapters: number;
	}): Promise<boolean>;
	copyManuscript(): Promise<boolean>;
	activate(token: string): Promise<EntitlementState>;
	/** 丢掉自己那份，回到随包社区凭证。 */
	clearCredential(): Promise<EntitlementState>;
	trustedKeys(): readonly TrustedKey[];
}

/**
 * 视图唯一的读取入口：列表、当前作品、当前章正文、评审。
 * 每次写操作后自增 `version` 触发重读，避免界面显示陈旧的阶段徽章。
 */
export function useStudioState(): StudioState {
	const runtime = getStudioRuntime();
	const service: StudioService = runtime.service;

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
	const [books, setBooks] = useState<BookIndexEntry[]>([]);
	const [book, setBook] = useState<NovelBook | null>(null);
	const [review, setReview] = useState<ReviewReport | null>(null);
	const [chapterText, setChapterText] = useState("");
	const [entitlement, setEntitlement] = useState<EntitlementState>(runtime.service.entitlementState);
	const [credentialSource, setCredentialSource] = useState<CredentialSource>(runtime.service.credentialSource);
	const [rejectedCredential, setRejectedCredential] = useState<EntitlementState | null>(
		runtime.service.rejectedCredential,
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState(0);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await service.listBooks();
			const nextBooks = list.ok ? list.data : [];
			setBooks(nextBooks);

			const targetId = selectedId ?? nextBooks[0]?.id ?? null;
			const nextBook = targetId
				? await service.resolveBook(targetId)
				: await service.resolveBook();
			setBook(nextBook);

			const targetChapter = selectedChapter ?? nextBook?.progress.currentChapter ?? null;
			setSelectedChapter(targetChapter);

			if (nextBook && targetChapter) {
				const chapter = await service.readChapter(targetChapter, nextBook.id);
				setChapterText(chapter.ok ? chapter.data.text : "");
				const storedReview = await service.readReview(targetChapter, nextBook.id);
				setReview(storedReview.ok ? storedReview.data : null);
			} else {
				setChapterText("");
				setReview(null);
			}
			setEntitlement(service.entitlementState);
			setCredentialSource(service.credentialSource);
			setRejectedCredential(service.rejectedCredential);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setLoading(false);
		}
	}, [selectedChapter, selectedId, service]);

	useEffect(() => {
		void reload();
	}, [reload, version]);

	const mutate = useCallback(
		async (action: () => Promise<ServiceResult<unknown>>): Promise<boolean> => {
			setError(null);
			const result = await action();
			if (!result.ok) {
				setError(result.detail ?? result.error);
				setVersion((value) => value + 1);
				return false;
			}
			setVersion((value) => value + 1);
			return true;
		},
		[],
	);

	const copyManuscript = useCallback(async (): Promise<boolean> => {
		if (!book) return false;
		const exported = await service.exportManuscript(book.id);
		if (!exported.ok) {
			setError(exported.detail ?? exported.error);
			return false;
		}
		try {
			await navigator.clipboard.writeText(exported.data.text);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			return false;
		}
		runtime.ctx.ui.notify({
			message: runtime.ctx.i18n.t("studio.copied", { count: exported.data.chapters }),
			variant: "success",
		});
		return true;
	}, [book, runtime.ctx, service]);

	return {
		loading,
		error,
		books,
		book,
		review,
		chapterText,
		selectedChapter,
		entitlement,
		selectBook: (id) => {
			setSelectedId(id);
			setSelectedChapter(null);
			setVersion((value) => value + 1);
		},
		selectChapter: (n) => {
			setSelectedChapter(n);
			setVersion((value) => value + 1);
		},
		refresh: () => setVersion((value) => value + 1),
		acceptBrief: () => mutate(() => service.acceptBrief(book?.id)),
		startDrafting: () => mutate(() => service.startDrafting(book?.id)),
		commitChapter: (n) => mutate(() => service.commitChapter(n, book?.id)),
		closeArc: () => mutate(() => service.closeArc(book?.id)),
		finalize: () => mutate(() => service.finalize(book?.id)),
		createBook: (input) => mutate(() => service.createBook(input)),
		copyManuscript,
		credentialSource,
		rejectedCredential,
		activate: async (token) => {
			const next = await service.activate(token);
			// 激活成功或失败都会改变来源/拒绝原因：失败时要立刻能说清「你填的那份为什么没用」。
			setEntitlement(next);
			setCredentialSource(service.credentialSource);
			setRejectedCredential(service.rejectedCredential);
			setVersion((value) => value + 1);
			return next;
		},
		clearCredential: async () => {
			const next = await service.clearCredential();
			setEntitlement(next);
			setCredentialSource(service.credentialSource);
			setRejectedCredential(service.rejectedCredential);
			setVersion((value) => value + 1);
			return next;
		},
		trustedKeys: () => service.trustedKeys(),
	};
}

/** 视图与工具共用同一个路由结果：界面上显示的"下一步"必须是模型会看到的那一条。 */
export function instructionOf(book: NovelBook | null) {
	return book ? routeNovel(book) : null;
}
