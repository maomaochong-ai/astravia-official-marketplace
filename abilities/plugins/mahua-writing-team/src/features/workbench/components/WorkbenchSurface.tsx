import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { useConsoleTimeline } from "../console-timeline/use-console-timeline.js";
import {
	OVERLAY_Z_INDEX,
	enterOsFullscreen,
	exitOsFullscreen,
	watchOsFullscreenExit,
} from "../fullscreen.js";
import { useNarrowSurface } from "../hooks/use-narrow-surface";
import { useRailCollapsed } from "../hooks/use-rail-collapsed";
import { useStudioState } from "../hooks/use-studio-state";
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
import { PanelOverlay } from "./PanelOverlay";
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

const PANEL_CLASS = "mahua-root flex h-full min-h-0 w-full flex-col overflow-hidden";

/** 覆盖层：脱离面板的流，相对视口铺满。`zIndex` 走内联，见 `../fullscreen.ts` 的注释。 */
const OVERLAY_CLASS = "mahua-root fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-canvas";

/**
 * 工作台的装配层：七帧只在这里被选一次。运行时一定在（入口已经挡过一道）。
 *
 * 它自己不做任何事——路由在 `use-workbench-route`，事实在 `use-studio-state`，
 * 事件流在 `use-console-timeline`。这里只把几样东西接起来，唯一的行为是「有新的落盘事件就
 * 重读一次」：同步只有这一个方向。
 *
 * 宿主形态只有一个：活动面板里的标签页。「全屏」是本插件自己的覆盖层，不是宿主的整页路由，
 * 也不去动面板宽度——那两条路都走不通：
 *
 * - **拉宽面板换不来全屏。** 宿主给面板宽度留了一条硬底线
 *   （`ACTIVITY_PANEL_MIN_CHAT_AREA = 384`，在 atom 层统一夹紧），传 `"max"` 拿到的是
 *   「窗口宽 − 384」，会话区永远在旁边。
 * - **整页路由也不是全屏。** 那是宿主的页面：侧栏与页头跟着一起来，而且进去之后插件没有
 *   返回的办法（导航能力里只有「打开」）。
 *
 * 所以全屏 = 覆盖层（`PanelOverlay`，portal 到 body）+ 窗口全屏（`../fullscreen.ts`）。
 * 前者把画面铺满窗口，后者让窗口本身连标题栏一起让位；后者被拒绝也只少一层，覆盖层照旧。
 */
export function WorkbenchSurface() {
	const t = useTranslator();
	const data = useStudioState();
	const { route, navigate } = useWorkbenchRoute();
	const rail = useRailCollapsed();
	const { ref: surfaceRef, narrow } = useNarrowSurface();
	const events = useConsoleTimeline();
	const [now, setNow] = useState(() => Date.now());
	const [fullscreen, setFullscreen] = useState(false);

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

	const leaveFullscreen = useCallback(() => {
		setFullscreen(false);
		void exitOsFullscreen();
	}, []);

	const enterFullscreen = () => {
		setFullscreen(true);
		void enterOsFullscreen();
	};

	/**
	 * Esc 有两拨人管。真进了窗口全屏，Esc 被浏览器收走，页面只收到 `fullscreenchange`；
	 * 没进成（被拒绝）时浏览器不管，才轮到这里的键盘监听。两条路都收口到 `leaveFullscreen`。
	 */
	useEffect(() => {
		if (!fullscreen) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			leaveFullscreen();
		};
		window.addEventListener("keydown", onKey);
		const unwatch = watchOsFullscreenExit(leaveFullscreen);
		return () => {
			window.removeEventListener("keydown", onKey);
			unwatch();
		};
	}, [fullscreen, leaveFullscreen]);

	// 宿主把面板关掉时这棵树直接消失：窗口全屏必须还回去，否则用户被留在一个没有插件的全屏里。
	useEffect(() => {
		return () => {
			void exitOsFullscreen();
		};
	}, []);

	const toggle = fullscreen ? leaveFullscreen : enterFullscreen;

	const book = data.book;
	const chapter = book?.progress.currentChapter ?? 0;
	const arc = book ? arcOf(book, chapter) : null;
	const writing = landed && isWriting(events, now) ? landed : null;
	const frontier = book ? committedFrontier(book) : 0;

	const go = (page: WorkbenchPage, target?: number) => {
		if (target !== undefined) data.selectChapter(target);
		navigate(page, target);
	};

	const surfaceStyle: CSSProperties | undefined = fullscreen ? { zIndex: OVERLAY_Z_INDEX } : undefined;

	const surface = (
		<div
			ref={surfaceRef}
			className={fullscreen ? OVERLAY_CLASS : PANEL_CLASS}
			style={surfaceStyle}
			data-expanded={fullscreen ? "true" : "false"}
		>
			<StudioShell
				active={route.page}
				expanded={fullscreen}
				onToggleExpanded={toggle}
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
				rail={
					isBarePage(route.page)
						? undefined
						: {
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
								collapsed: rail.collapsed || narrow,
								autoCollapsed: narrow,
								onToggleCollapsed: rail.toggle,
								onNavigate: go,
							}
				}
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
							className="mt-2 flex h-7 items-center rounded-control bg-well px-3 text-[10px] text-ink transition-colors hover:bg-wash-strong"
						>
							{t("window.retry")}
						</button>
					</div>
				) : (
					<>
						{route.page === "shelf" && <ShelfPage data={data} onNavigate={go} />}
						{route.page === "library" && <LibraryPage data={data} onNavigate={go} />}
						{route.page === "book" && <BookPage data={data} onNavigate={go} />}
						{route.page === "reader" && <ReaderPage data={data} onNavigate={go} />}
						{route.page === "ledger" && <LedgerPage data={data} onNavigate={go} />}
						{route.page === "console" && <ConsolePage data={data} onNavigate={go} />}
						{route.page === "activation" && <ActivationPage data={data} onNavigate={go} />}
					</>
				)}
			</StudioShell>
		</div>
	);

	return fullscreen ? <PanelOverlay>{surface}</PanelOverlay> : surface;
}
