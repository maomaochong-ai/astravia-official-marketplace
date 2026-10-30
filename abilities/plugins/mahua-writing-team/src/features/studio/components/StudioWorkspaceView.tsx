import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import { BookDetail } from "../../library/components/BookDetail.js";
import { LibraryCatalog } from "../../library/components/LibraryCatalog.js";
import { LibraryShelf } from "../../library/components/LibraryShelf.js";
import { ReaderPane } from "../../library/components/ReaderPane.js";
import { ThreadLedger } from "../../library/components/ThreadLedger.js";
import { useLibraryRoute, type LibrarySurface } from "../../library/hooks/use-library-route.js";
import { ActivationPanel } from "../../shared/components/ActivationPanel.js";
import { StudioChrome } from "../../shared/components/StudioChrome.js";
import { useAgentHandoff } from "../hooks/use-agent-handoff.js";
import { instructionOf, useStudioState } from "../hooks/use-studio-state.js";
import { ConsolePane } from "./ConsolePane.js";
import { StudioRail, type StudioRailItem } from "./StudioRail.js";
import { StudioStrip } from "./StudioStrip.js";

/**
 * 工作台标签（ADR 0025 §2）= 路由壳（ADR 0013 §2.1 / 0026 §1 / 0027 §1）：
 * 凭证判断 → 面包屑 + 左侧导航 + 主纸区，主纸区里再分派
 * 书架 / 书库 / 书页 / 阅读页 / 伏笔账本 / 运行台六层。
 *
 * 它是**活动面板里的一枚标签**，所以不向宿主页头写标题：页头属于整页路由，标签没有它。
 * 六层共用一个 `useStudioState()`，所以「架子上看到的进度」「书页上的下一步」「阅读页的正文」
 * 不会各读一套。插件里仍然没有对话输入框：干预走宿主的对话页（ADR 0011 §2.4）。
 *
 * 版面按 `ui-mock/mahua-novel-studio` 重排，但只借它的层级关系，不借它的像素：
 * 设计帧是 1440×900 的整窗（左 208px 固定栏 + 主纸 + 右侧固定宽栏），标签页实宽 400–1000px，
 * 固定宽栏一律带断点降级（ADR 0026 §2 / 0027 §2）。红绿灯窗口控件不复刻——标签页没有窗口边框。
 */
export function StudioWorkspaceView() {
	const { t } = useTranslation();
	const state = useStudioState();
	const { book, copyManuscript } = state;
	const { route, openShelf, openCatalog, openBook, openChapter, openLedger, openConsole, backToBook } =
		useLibraryRoute();
	const [credentialOpen, setCredentialOpen] = useState(false);

	const { busy: handoffBusy, start: startHandoff, invite: inviteMember } = useAgentHandoff(book);

	// 凭证失效（过期/换机）时退回激活页；凭证面板从成员条的最右一格打开。
	if (state.entitlement.status !== "active" || credentialOpen) {
		return (
			<div className="mahua-root flex h-full min-h-0 flex-col overflow-hidden bg-muted/40 text-foreground">
				<StudioChrome
					crumb={[t("view.studio.label"), t("activation.title")]}
					right={
						<span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
							{t(
								state.entitlement.status === "active"
									? "activation.statusActive"
									: "activation.statusIdle",
							)}
						</span>
					}
				/>
				{credentialOpen ? (
					<div className="shrink-0 px-3 pt-2 sm:px-4">
						<button
							type="button"
							onClick={() => setCredentialOpen(false)}
							className="flex h-7 items-center gap-1.5 rounded-[9px] border border-border px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							<span className="icon-[solar--alt-arrow-left-linear] size-3" />
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

	// 导航要一个「当前这本书」的 id：书页/阅读/运行台/账本都挂在某本书下面。
	// 路由没带书号时依次回落到选中的书、索引里第一本；一本都没有就回书架。
	const activeId = route.bookId ?? book?.id ?? state.books[0]?.id ?? null;
	const openOwnBook = (surface: Exclude<LibrarySurface, "shelf" | "catalog">) => {
		if (activeId === null) {
			openShelf();
			return;
		}
		if (surface === "book") openBook(activeId);
		else if (surface === "ledger") openLedger(activeId);
		else if (surface === "console") openConsole(activeId);
		else readChapter(activeId, state.selectedChapter ?? book?.progress.currentChapter ?? 1);
	};

	const railItems: StudioRailItem[] = [
		{
			key: "shelf",
			label: t("nav.shelf"),
			icon: "icon-[solar--library-linear]",
			active: route.surface === "shelf",
			onSelect: openShelf,
			group: t("nav.works"),
		},
		{
			key: "catalog",
			label: t("nav.library"),
			icon: "icon-[solar--layers-minimalistic-linear]",
			active: route.surface === "catalog",
			onSelect: openCatalog,
		},
		{
			key: "book",
			label: t("nav.book"),
			icon: "icon-[solar--book-2-linear]",
			active: route.surface === "book",
			onSelect: () => openOwnBook("book"),
		},
		{
			key: "reader",
			label: t("nav.reader"),
			icon: "icon-[solar--document-text-linear]",
			active: route.surface === "reader",
			onSelect: () => openOwnBook("reader"),
		},
		{
			key: "console",
			label: t("nav.console"),
			icon: "icon-[solar--pulse-2-linear]",
			active: route.surface === "console",
			onSelect: () => openOwnBook("console"),
			group: t("nav.craft"),
		},
		{
			key: "ledger",
			label: t("nav.ledger"),
			icon: "icon-[solar--branching-paths-up-linear]",
			active: route.surface === "ledger",
			onSelect: () => openOwnBook("ledger"),
		},
	];

	const surfaceLabel =
		route.surface === "shelf"
			? t("nav.shelf")
			: route.surface === "catalog"
				? t("nav.library")
				: route.surface === "book"
					? t("nav.book")
					: route.surface === "reader"
						? t("nav.reader")
						: route.surface === "console"
							? t("nav.console")
							: t("nav.ledger");

	return (
		<div className="mahua-root flex h-full min-h-0 flex-col overflow-hidden bg-muted/40 text-foreground">
			<StudioChrome
				crumb={book && route.surface !== "shelf" && route.surface !== "catalog" ? [t("view.studio.label"), book.title, surfaceLabel] : [t("view.studio.label"), surfaceLabel]}
				right={
					book ? (
						<span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
							{t("studio.header.progress", {
								progress: `${book.progress.committedCount}/${book.targetChapters}`,
							})}
						</span>
					) : undefined
				}
			/>

			{state.credentialSource === "bundled" && state.rejectedCredential ? (
				<div className="mx-3 mb-2 shrink-0 rounded-[9px] border border-border/60 bg-muted/50 px-3 py-2 text-[11px] leading-relaxed">
					<p className="font-medium">{t("activation.fallbackTitle")}</p>
					<p className="mt-1 text-muted-foreground">{t("activation.fallbackInline")}</p>
				</div>
			) : null}

			{state.error ? (
				<div
					role="alert"
					className="mx-3 mb-2 shrink-0 rounded-[9px] bg-destructive/15 px-3 py-2 text-[11px] text-destructive [overflow-wrap:anywhere]"
				>
					{state.error}
				</div>
			) : null}

			<div className="flex min-h-0 flex-1 gap-1 px-1 pb-1 sm:gap-2 sm:px-2 sm:pb-2">
				<StudioRail items={railItems} book={book} credentialActive />

				<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-border/60 bg-background shadow-sm sm:rounded-[18px]">
					{/* 同步带只说「这一页是上一次落盘的样子」；它挂在有书的三层上，书架与书库没有主语。 */}
					{book && route.surface !== "shelf" && route.surface !== "catalog" ? <StudioStrip book={book} /> : null}

					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						{state.loading && state.books.length === 0 ? (
							<p className="p-6 text-[11px] text-muted-foreground">{t("studio.loading")}</p>
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
								onOpenConsole={(id) => openConsole(id)}
							/>
						) : route.surface === "catalog" ? (
							<LibraryCatalog books={state.books} onOpen={selectBook} onBack={openShelf} />
						) : book === null ? (
							<p className="p-6 text-[11px] text-muted-foreground">{t("studio.loading")}</p>
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
						) : route.surface === "console" ? (
							<ConsolePane
								book={book}
								review={state.review}
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
								onOpenConsole={() => openConsole(book.id)}
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
				</main>
			</div>
		</div>
	);
}
