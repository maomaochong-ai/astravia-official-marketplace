import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import { getStudioRuntime } from "../../../plugin-context.js";
import { STUDIO_VIEW_ID } from "../../../view-ids.js";
import { ActivationPanel } from "../../shared/components/ActivationPanel.js";
import { BookDetail } from "../../library/components/BookDetail.js";
import { LibraryCatalog } from "../../library/components/LibraryCatalog.js";
import { LibraryShelf } from "../../library/components/LibraryShelf.js";
import { ReaderPane } from "../../library/components/ReaderPane.js";
import { useLibraryRoute } from "../../library/hooks/use-library-route.js";
import { useAgentHandoff } from "../hooks/use-agent-handoff.js";
import { instructionOf, useStudioState } from "../hooks/use-studio-state.js";

/**
 * 侧栏视图 = 路由壳（ADR 0013 §2.1）：凭证判断 → 书架 / 书页 / 阅读页三层分派。
 *
 * 三层共用一个 `useStudioState()`，所以「架子上看到的进度」「书页上的下一步」「阅读页的正文」
 * 不会各读一套。插件里仍然没有对话输入框：干预走宿主的对话页（ADR 0011 §2.4）。
 */
export function StudioWorkspaceView() {
	const runtime = getStudioRuntime();
	const { t } = useTranslation();
	const state = useStudioState();
	const { book, copyManuscript } = state;
	const { route, openShelf, openCatalog, openBook, openChapter, backToBook } = useLibraryRoute();
	const [credentialOpen, setCredentialOpen] = useState(false);

	const {
		busy: handoffBusy,
		start: startHandoff,
		invite: inviteMember,
	} = useAgentHandoff(book);

	// 页头随所在层变化：架子写插件名，书页与阅读页写书名（宿主页头是导航，不承载详情）。
	const atShelfOrCatalog = route.surface === "shelf" || route.surface === "catalog";
	const headerTitle =
		atShelfOrCatalog || book === null
			? t("studio.title")
			: t("studio.header.title", { title: book.title });

	useEffect(() => {
		runtime.ctx.ui.setWorkspaceViewHeader(STUDIO_VIEW_ID, {
			title: headerTitle,
			right:
				atShelfOrCatalog || book === null ? null : (
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<button
							type="button"
							onClick={() => void copyManuscript()}
							className="rounded-md border border-border/60 px-2 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{t("action.copyManuscript")}
						</button>
						<span className="rounded-md bg-accent px-2 py-0.5 text-accent-foreground">
							{t(`phase.${book.phase}`)}
						</span>
					</div>
				),
		});
		return () => runtime.ctx.ui.setWorkspaceViewHeader(STUDIO_VIEW_ID, null);
	}, [atShelfOrCatalog, book, copyManuscript, headerTitle, runtime.ctx, t]);

	// 凭证失效（过期/换机）时退回激活页；凭证面板从成员条的最右一格打开。
	if (state.entitlement.status !== "active" || credentialOpen) {
		return (
			<div className="mahua-root relative h-full overflow-y-auto">
				{credentialOpen ? (
					<div className="mx-auto flex w-full max-w-lg justify-start px-6 pt-4">
						<button
							type="button"
							onClick={() => setCredentialOpen(false)}
							className="rounded-md border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
						>
							{t("roster.credentialBack")}
						</button>
					</div>
				) : null}
				<ActivationPanel
					entitlement={state.entitlement}
					keyIds={state.trustedKeys().map((key) => key.keyId)}
					onActivate={state.activate}
				/>
			</div>
		);
	}

	const selectBook = (id: string) => {
		state.selectBook(id);
		openBook(id);
	};

	const readChapter = (id: string, chapter: number) => {
		state.selectChapter(chapter);
		openChapter(id, chapter);
	};

	return (
		<div className="mahua-root relative flex h-full min-h-0 flex-col">
			{state.error ? (
				<div
					role="alert"
					className="mx-4 mt-3 rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive"
				>
					{state.error}
				</div>
			) : null}

			{state.loading && state.books.length === 0 ? (
				<p className="p-6 text-sm text-muted-foreground">{t("studio.loading")}</p>
			) : route.surface === "shelf" ? (
				<LibraryShelf
					books={state.books}
					creating={state.loading}
					onOpen={selectBook}
					onOpenCatalog={openCatalog}
					onContinue={(id, chapter) => {
						state.selectBook(id);
						readChapter(id, chapter);
					}}
					onCreate={state.createBook}
				/>
			) : route.surface === "catalog" ? (
				<LibraryCatalog books={state.books} onOpen={selectBook} onBack={openShelf} />
			) : book === null ? (
				<p className="p-6 text-sm text-muted-foreground">{t("studio.loading")}</p>
			) : route.surface === "reader" ? (
				<ReaderPane
					book={book}
					chapter={state.selectedChapter}
					text={state.chapterText}
					review={state.review}
					loading={state.loading}
					onBack={backToBook}
					onOpenChapter={(chapter) => readChapter(book.id, chapter)}
				/>
			) : (
				<BookDetail
					book={book}
					instruction={instructionOf(book)}
					entitlement={state.entitlement}
					selectedChapter={state.selectedChapter}
					busy={state.loading}
					handoffBusy={handoffBusy}
					onBack={openShelf}
					onContinue={() => void startHandoff()}
					onOpenChapter={(chapter) => readChapter(book.id, chapter)}
					onInvite={(member) => void inviteMember(member)}
					onOpenCredential={() => setCredentialOpen(true)}
					onAcceptBrief={() => void state.acceptBrief()}
					onStartDrafting={() => void state.startDrafting()}
					onCommit={(chapter) => void state.commitChapter(chapter)}
					onCloseArc={() => void state.closeArc()}
					onFinalize={() => void state.finalize()}
				/>
			)}
		</div>
	);
}
