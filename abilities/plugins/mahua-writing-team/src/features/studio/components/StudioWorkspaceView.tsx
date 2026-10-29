import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import { ActivationPanel } from "../../shared/components/ActivationPanel.js";
import { BookDetail } from "../../library/components/BookDetail.js";
import { LibraryCatalog } from "../../library/components/LibraryCatalog.js";
import { LibraryShelf } from "../../library/components/LibraryShelf.js";
import { ReaderPane } from "../../library/components/ReaderPane.js";
import { ThreadLedger } from "../../library/components/ThreadLedger.js";
import { useLibraryRoute } from "../../library/hooks/use-library-route.js";
import { useAgentHandoff } from "../hooks/use-agent-handoff.js";
import { instructionOf, useStudioState } from "../hooks/use-studio-state.js";
import { StudioStrip } from "./StudioStrip.js";

/**
 * 工作台标签（ADR 0025 §2）= 路由壳（ADR 0013 §2.1 / 0026 §1）：
 * 凭证判断 → 书架 / 书库 / 书页 / 阅读页 / 伏笔账本五层分派。
 *
 * 它现在是**活动面板里的一枚标签**，所以不再向宿主页头写标题：页头属于整页路由，标签没有它。
 * 五层共用一个 `useStudioState()`，所以「架子上看到的进度」「书页上的下一步」「阅读页的正文」
 * 不会各读一套。插件里仍然没有对话输入框：干预走宿主的对话页（ADR 0011 §2.4）。
 *
 * 版面按 `ui-mock/mahua-novel-studio` 重排，但只借它的层级关系，不借它的像素：
 * 设计帧是 1440×900 的整窗，标签页实宽 400–1000px，固定宽栏一律带断点降级（ADR 0026 §2）。
 */
export function StudioWorkspaceView() {
	const { t } = useTranslation();
	const state = useStudioState();
	const { book, copyManuscript } = state;
	const { route, openShelf, openCatalog, openBook, openChapter, openLedger, backToBook } = useLibraryRoute();
	const [credentialOpen, setCredentialOpen] = useState(false);

	const {
		busy: handoffBusy,
		start: startHandoff,
		invite: inviteMember,
	} = useAgentHandoff(book);

	// 凭证失效（过期/换机）时退回激活页；凭证面板从成员条的最右一格打开。
	if (state.entitlement.status !== "active" || credentialOpen) {
		return (
			<div className="mahua-root relative h-full overflow-y-auto bg-background text-foreground">
				{credentialOpen ? (
					<div className="mx-auto flex w-full max-w-lg justify-start px-6 pt-4">
						<button
							type="button"
							onClick={() => setCredentialOpen(false)}
							className="rounded-lg border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							{t("roster.credentialBack")}
						</button>
					</div>
				) : null}
				<ActivationPanel
					entitlement={state.entitlement}
					keyIds={state.trustedKeys().map((key) => key.keyId)}
					rejected={state.rejectedCredential}
					source={state.credentialSource}
					onActivate={state.activate}
					onClear={state.clearCredential}
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
		<div className="mahua-root relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
			{state.credentialSource === "bundled" && state.rejectedCredential ? (
				<div className="mx-4 mt-3 shrink-0 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs leading-relaxed">
					<p className="font-medium">{t("activation.fallbackTitle")}</p>
					<p className="mt-1 text-muted-foreground">{t("activation.fallbackInline")}</p>
				</div>
			) : null}

			{state.error ? (
				<div
					role="alert"
					className="mx-4 mt-3 shrink-0 rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive [overflow-wrap:anywhere]"
				>
					{state.error}
				</div>
			) : null}

			{/* 同步带只说「这一页是上一次落盘的样子」；它挂在有书的三层上，书架与书库没有主语。 */}
			{book && (route.surface === "book" || route.surface === "ledger") ? (
				<StudioStrip book={book} />
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
			) : route.surface === "ledger" ? (
				<ThreadLedger book={book} onBack={backToBook} />
			) : (
				<BookDetail
					book={book}
					instruction={instructionOf(book)}
					entitlement={state.entitlement}
					onCopyManuscript={() => void copyManuscript()}
					selectedChapter={state.selectedChapter}
					busy={state.loading}
					handoffBusy={handoffBusy}
					onBack={openShelf}
					onContinue={() => void startHandoff()}
					onOpenChapter={(chapter) => readChapter(book.id, chapter)}
					onOpenLedger={() => openLedger(book.id)}
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
