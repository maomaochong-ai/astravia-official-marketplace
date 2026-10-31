import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getStudioRuntime } from "../../../plugin-context.js";
import { useConsoleTimeline } from "../console-timeline/use-console-timeline.js";
import { useStudioState } from "../hooks/use-studio-state";
import { useTeamReveal } from "../hooks/use-team-reveal";
import { useTranslator } from "../hooks/use-translator";
import { useWorkbenchRoute } from "../hooks/use-workbench-route";
import { arcOf, committedCount, coverSeed, elapsedSince, formatCount, percent } from "../workbench-model";
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

/** 同一批落盘事件合并成一次重读。 */
const REFRESH_DEBOUNCE_MS = 300;

/** 相对时间（「1 秒前」）得自己走；没有新数据也每 30 秒重画一次。 */
const CLOCK_MS = 30_000;

/**
 * 工作台的装配层：七帧只在这里被选一次。运行时一定在（入口已经挡过一道）。
 *
 * 它自己不做任何事——路由在 `use-workbench-route`，事实在 `use-studio-state`，
 * 团队的门在 `use-team-reveal`，事件流在 `use-console-timeline`。这里只把四样东西接起来，
 * 唯一的行为是「有新的落盘事件就重读一次」：同步只有这一个方向。
 *
 * 全屏是**本插件自己的覆盖层**，不是宿主的整页路由：宿主没有给插件 `requestFullscreen`，
 * 而把它注册成 `sidebar: false` 的工作区视图，入口只会落到「设置 → 更多」里，
 * 那不是用户点放大时要的结果。覆盖层盖住整个视口，侧栏与主体都在里面，再点一次或按 Esc 复原。
 */
export function WorkbenchSurface() {
	const { ctx } = getStudioRuntime();
	const t = useTranslator();
	const data = useStudioState();
	const { route, navigate } = useWorkbenchRoute();
	const [expanded, setExpanded] = useState(false);
	const reveal = useTeamReveal(() => setExpanded(false));
	const events = useConsoleTimeline();
	const [now, setNow] = useState(() => Date.now());

	const landed = lastLandedStudioEvent(events);
	const landedId = landed?.id ?? null;
	const refresh = data.refresh;

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
		return () => clearInterval(timer);
	}, []);

	// 覆盖层自己收键盘：不给 Esc 留通路的话，全屏就是一条有去无回的路。
	useEffect(() => {
		if (!expanded) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setExpanded(false);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [expanded]);

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

	const surfaceButton = (
		<button
			type="button"
			onClick={() => setExpanded((open) => !open)}
			title={expanded ? t("window.toTab") : t("window.fullscreen")}
			aria-label={expanded ? t("window.toTab") : t("window.fullscreen")}
			aria-pressed={expanded}
			className="flex size-6 items-center justify-center rounded-control text-ink-soft hover:bg-raised"
		>
			<span className={`${expanded ? "icon-[lucide--minimize-2]" : "icon-[lucide--maximize-2]"} size-3.5`} />
		</button>
	);

	const shell = (
		<StudioShell
			active={route.page}
			right={surfaceButton}
			bare={isBarePage(route.page)}
			sync={
				isBarePage(route.page)
					? undefined
					: {
							writer: landed?.actor ?? t("sync.team"),
							doing: landed ? t(landed.textKey, landed.textParams) : t("sync.idle"),
							// 还没提交过任何一章时，磁盘上确实没有 `chapters/0.md`，别显示一个不存在的文件。
							file: chapter > 0 ? `chapters/${chapter}.md` : "chapters/",
							words: book ? `${formatCount(committedCount(book))} / ${book.targetChapters}` : "—",
							ago: landed ? elapsedText(elapsedSince(landed.at, now), t) : t("sync.never"),
							queue: t("sync.events", { count: events.length }),
						}
			}
			rail={{
				bookTitle: book?.title ?? t("rail.noBook"),
				cover: coverSeed(book?.title ?? t("rail.noBook")),
				stage: book && arc ? `${arc.title} · ${t("rail.chapter", { chapter })}` : t("rail.noBook"),
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
					{route.page === "console" && <ConsolePage data={data} onNavigate={go} onRevealTeam={reveal} />}
					{route.page === "activation" && <ActivationPage data={data} />}
				</>
			)}
		</StudioShell>
	);

	if (!expanded) return <div className="mahua-root h-full w-full">{shell}</div>;

	// portal 到 body：活动面板自己带 overflow 与层叠上下文，留在面板里就盖不满整个窗口。
	return createPortal(
		<div
			data-mahua-overlay="workbench"
			className="mahua-root fixed inset-0 z-[90] flex flex-col overflow-hidden bg-canvas"
		>
			{shell}
		</div>,
		document.body,
	);
}
