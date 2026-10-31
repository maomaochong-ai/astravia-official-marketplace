import { useEffect, useState } from "react";
import { getStudioRuntime } from "../../../plugin-context.js";
import { STUDIO_TAB_ID, STUDIO_VIEW_ID } from "../../../studio-ids.js";
import { useConsoleTimeline } from "../console-timeline/use-console-timeline.js";
import { useHostMode } from "../hooks/use-host-mode";
import { useRailCollapsed } from "../hooks/use-rail-collapsed";
import { useStudioState } from "../hooks/use-studio-state";
import { useTeamReveal } from "../hooks/use-team-reveal";
import { useTranslator } from "../hooks/use-translator";
import { useWorkbenchRoute } from "../hooks/use-workbench-route";
import {
	arcOf,
	committedCount,
	committedFrontier,
	coverSeed,
	elapsedSince,
	formatCount,
	percent,
} from "../workbench-model";
import { elapsedText, isWriting, lastLandedStudioEvent } from "../workbench-feed";
import { isBarePage, type WorkbenchPage } from "../workbench-pages";
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
 * 「放大」= 换一个宿主位置，不是盖一层自己的浮层。同一张工作台注册了两次形态：
 * 活动面板里的一张标签页（窄，跟着对话），以及一个 `sidebar: false` 的工作区视图
 * （宽，占据主内容区）。两个按钮就在这两者之间来回切，宿主负责排版，插件从不
 * 把自己贴到视口上、也不 portal 到 body——那会盖住宿主的侧栏与标题栏，面板宽度一变就撑坏。
 *
 * `surface` 只决定「从哪儿回哪儿去」：面板形态的按钮是「放大到整页」，整页形态的按钮是
 * 「收回对话面板」。其余一切两态共用。
 */
export function WorkbenchSurface({ surface = "panel" }: { surface?: "panel" | "page" }) {
	const { ctx } = getStudioRuntime();
	const t = useTranslator();
	const data = useStudioState();
	const { route, navigate } = useWorkbenchRoute();
	const rail = useRailCollapsed();
	const hostMode = useHostMode();
	const reveal = useTeamReveal();
	const events = useConsoleTimeline();
	const [now, setNow] = useState(() => Date.now());

	const landed = lastLandedStudioEvent(events);
	const landedId = landed?.id ?? null;
	const refresh = data.refresh;

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
		return () => clearInterval(timer);
	}, []);

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
	const frontier = book ? committedFrontier(book) : 0;

	const go = (page: WorkbenchPage, target?: number) => {
		if (target !== undefined) data.selectChapter(target);
		navigate(page, target);
	};

	const onSwapSurface = () => {
		if (surface === "page") {
			ctx.ui.openActivityTab(STUDIO_TAB_ID);
			return;
		}
		ctx.ui.openWorkspaceView(STUDIO_VIEW_ID);
	};

	const swapLabel = surface === "page" ? t("window.toTab") : t("window.fullscreen");
	const swapIcon = surface === "page" ? "icon-[lucide--panel-right-close]" : "icon-[lucide--maximize-2]";

	const surfaceButton = (
		<button
			type="button"
			onClick={onSwapSurface}
			title={swapLabel}
			aria-label={swapLabel}
			className="flex h-6 items-center gap-1.5 rounded-control px-1.5 text-[10px] text-ink-soft hover:bg-raised hover:text-ink"
		>
			<span className={`${swapIcon} size-3.5 shrink-0`} />
			<span className="hidden @[720px]:inline">{swapLabel}</span>
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
							// 没提交过任何一章时，磁盘上确实没有 `chapters/0.md`，别显示一个不存在的文件。
							file: frontier > 0 ? `chapters/${frontier}.md` : "chapters/",
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
				collapsed: rail.collapsed,
				onToggleCollapsed: rail.toggle,
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
					{route.page === "activation" && <ActivationPage data={data} onNavigate={go} />}
				</>
			)}
		</StudioShell>
	);

	return (
		<div className="mahua-root h-full w-full" data-mahua-mode={hostMode}>
			{shell}
		</div>
	);
}
