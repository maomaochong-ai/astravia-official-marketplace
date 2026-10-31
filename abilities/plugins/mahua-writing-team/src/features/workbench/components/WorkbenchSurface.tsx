import { useEffect, useState } from "react";
import { getStudioRuntime } from "../../../plugin-context.js";
import { useLiveFeed } from "../../studio/live-feed/use-live-feed.js";
import { useStudioState } from "../hooks/use-studio-state";
import { useTeamReveal } from "../hooks/use-team-reveal";
import { useTranslator } from "../hooks/use-translator";
import { useWorkbenchRoute } from "../hooks/use-workbench-route";
import { arcOf, committedCount, committedWords, coverSeed, elapsedSince, formatCount, percent } from "../workbench-model";
import { elapsedText, isWriting, lastLandedStudioEvent } from "../workbench-feed";
import { isBarePage, pageTitleKey, type WorkbenchPage } from "../workbench-pages";
import { StudioShell } from "./shell/StudioShell";
import { ActivationPage } from "./pages/ActivationPage";
import { BookPage } from "./pages/BookPage";
import { ConsolePage } from "./pages/ConsolePage";
import { LedgerPage } from "./pages/LedgerPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ReaderPage } from "./pages/ReaderPage";
import { ShelfPage } from "./pages/ShelfPage";

/** 宿主的窄面板默认只有几百像素，第一次挂进标签页时把它拉满，之后由用户决定。 */
let stretched = false;

const NARROW_WIDTH = 760;

/** 同一批落盘事件合并成一次重读。 */
const REFRESH_DEBOUNCE_MS = 300;

/**
 * 工作台的装配层：七帧只在这里被选一次。运行时一定在（`WorkbenchScreen` 已经挡过一道）。
 *
 * 它自己不做任何事——路由在 `use-workbench-route`，事实在 `use-studio-state`，
 * 团队的门在 `use-team-reveal`，事件流在 `use-live-feed`。这里只把四样东西接起来，
 * 唯一的行为是「有新的落盘事件就重读一次」：同步只有这一个方向。
 */
export function WorkbenchSurface() {
	const { ctx } = getStudioRuntime();
	const t = useTranslator();
	const data = useStudioState();
	const { route, navigate } = useWorkbenchRoute();
	const reveal = useTeamReveal();
	const events = useLiveFeed();
	const [full, setFull] = useState(true);
	const now = Date.now();

	useEffect(() => {
		if (stretched) return;
		stretched = true;
		ctx.ui.setActivityPanelWidth("max");
	}, [ctx]);

	const landed = lastLandedStudioEvent(events);
	const landedId = landed?.id ?? null;
	const refresh = data.refresh;

	// 侧栏里的团队把文件落盘 → 这里重读一遍 → 界面自己变。反过来没有任何通路。
	// 一个团队回合会连着落好几条事件，逐条重读等于连读好几遍稿件；合并成一次。
	useEffect(() => {
		if (landedId === null) return;
		const timer = setTimeout(refresh, REFRESH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [landedId, refresh]);

	const book = data.book;
	const chapter = book?.progress.currentChapter ?? 0;
	const arc = book ? arcOf(book, chapter) : null;
	const writing = landed && isWriting(events, now) ? landed : null;

	const go = (page: WorkbenchPage, target?: number) => {
		if (target !== undefined) data.selectChapter(target);
		navigate(page, target);
	};

	const toggleFull = () => {
		const next = !full;
		setFull(next);
		ctx.ui.setActivityPanelWidth(next ? "max" : NARROW_WIDTH);
	};

	const chromeRight = (
		<>
			{book && (
				<span className="font-mono tabular-nums">
					{formatCount(committedWords(book))} · {percent(committedCount(book), book.targetChapters)}%
				</span>
			)}
			<button
				type="button"
				onClick={toggleFull}
				title={full ? t("window.restore") : t("window.stretch")}
				aria-label={full ? t("window.restore") : t("window.stretch")}
				className="flex size-6 items-center justify-center rounded-control text-ink-soft hover:bg-raised"
			>
				<span className={`${full ? "icon-[lucide--minimize-2]" : "icon-[lucide--maximize-2]"} size-3.5`} />
			</button>
		</>
	);

	const shell = (
		<StudioShell
			crumb={t("window.crumb", { page: t(pageTitleKey(route.page)) })}
			active={route.page}
			right={chromeRight}
			bare={isBarePage(route.page)}
			sync={
				isBarePage(route.page)
					? undefined
					: {
							writer: landed?.actor ?? t("sync.team"),
							doing: landed ? t(landed.textKey, landed.textParams) : t("sync.idle"),
							// 还没提交过任何一章时，磁盘上确实没有 `chapters/0.md`，别显示一个不存在的文件。
							file: chapter > 0 ? `chapters/${chapter}.md` : "chapters/",
							words: book ? `${formatCount(committedWords(book))}` : "—",
							ago: landed ? elapsedText(elapsedSince(landed.at, now), t) : t("sync.never"),
							queue: t("sync.events", { count: events.length }),
						}
			}
			rail={{
				bookTitle: book?.title ?? t("rail.noBook"),
				cover: coverSeed(book?.title ?? t("rail.noBook")),
				stage:
					book && arc
						? `${arc.title} · ${t("rail.chapter", { chapter })}`
						: t("rail.noBook"),
				percent: book ? percent(committedCount(book), book.targetChapters) : 0,
				writing: writing
					? {
							writer: writing.actor ?? t("sync.team"),
							elapsed: elapsedText(elapsedSince(writing.at, now), t),
							line: writing.chapter
								? `${writing.chapter} · ${t(writing.textKey, writing.textParams)}`
								: t(writing.textKey, writing.textParams),
						}
					: null,
				live: events.length > 0,
				credential: {
					ok: data.entitlement.status === "active",
					label: t(`activation.status.${data.entitlement.status}`),
				},
				onNavigate: go,
				onRevealTeam: reveal,
			}}
		>
			{data.loading ? (
				<div className="flex min-h-0 flex-1 items-center justify-center text-micro text-ink-faint">
					{t("window.loading")}
				</div>
			) : data.error !== null ? (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-10 text-center">
					<span className="text-body-sm font-semibold text-ink">{t("window.error")}</span>
					<span className="max-w-[520px] break-words text-[10px] leading-4 text-ink-soft">{data.error}</span>
					<button
						type="button"
						onClick={data.refresh}
						className="mt-2 flex h-7 items-center rounded-control border border-line px-3 text-[10px] text-ink"
					>
						{t("window.retry")}
					</button>
				</div>
			) : (
				<>
					{route.page === "shelf" && <ShelfPage data={data} onNavigate={go} onRevealTeam={reveal} />}
					{route.page === "library" && <LibraryPage data={data} onNavigate={go} />}
					{route.page === "book" && <BookPage data={data} onNavigate={go} onRevealTeam={reveal} />}
					{route.page === "reader" && <ReaderPage data={data} onNavigate={go} />}
					{route.page === "ledger" && <LedgerPage data={data} onNavigate={go} />}
					{route.page === "console" && (
						<ConsolePage data={data} onNavigate={go} onRevealTeam={reveal} />
					)}
					{route.page === "activation" && <ActivationPage data={data} />}
				</>
			)}
		</StudioShell>
	);

	return <div className="mahua-root h-full w-full">{shell}</div>;
}
