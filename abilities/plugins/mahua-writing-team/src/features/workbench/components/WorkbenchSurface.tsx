import { useEffect, useState } from "react";
import { useConsoleTimeline } from "../console-timeline/use-console-timeline.js";
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
 * 事件流在 `use-console-timeline`。这里只把几样东西接起来，唯一的行为是「有新的落盘事件就
 * 重读一次」：同步只有这一个方向。
 *
 * 「全屏」是**同一棵树的定位切换**，不是第二个实例、也不是第二个宿主注册：
 * 平时根节点是面板里的一块（`h-full`），点全屏后同一个根节点换成 `fixed inset-0`，盖住
 * 宿主窗口。这样做的三条理由，都是实测出来的：
 *
 * 1. 宿主工作区视图（`openWorkspaceView`）做不到「只有插件」——宿主的路由文件把它渲染在
 *    应用外壳里，侧栏与页头都在，SDK 也没有隐藏侧栏或全屏窗口的 API；
 * 2. 插件 CSS 活在 `@scope ([data-astravia-plugin-root=<id>])` 里，`:root` 级别的选择器碰不到
 *    宿主 chrome，所以唯一能覆盖整窗的办法就是让自己变成一块固定定位的画布；
 * 3. 为什么不是 `createPortal` 到 `body`：那要自己再造一个作用域根，等于把 `@scope` 的根
 *    复制一份（Tailwind 类挂在根上会被静默丢弃，另一个插件已经踩过）；而 `fixed` 不受祖先
 *    `overflow: hidden` 裁剪——宿主的挂载点只有 `overflow-hidden`，没有 `transform` /
 *    `filter` / `contain`，所以固定定位仍然相对视口，不需要换父节点。
 *
 * 代价写在明处：覆盖整窗后宿主的窗口控制键被盖住，所以报头在全屏时是拖拽区，Esc 与报头上的
 * 按钮都能退出。这是「模态全屏」的常规取舍（VS Code 也是这样）。
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
	// mac 的红绿灯由系统画在网页内容之上，全屏时得给报头让出左侧那一段。
	const [mac] = useState(() => document.documentElement.dataset.platform === "mac");

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

	useEffect(() => {
		if (!fullscreen) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setFullscreen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [fullscreen]);

	const book = data.book;
	const chapter = book?.progress.currentChapter ?? 0;
	const arc = book ? arcOf(book, chapter) : null;
	const writing = landed && isWriting(events, now) ? landed : null;
	const frontier = book ? committedFrontier(book) : 0;

	const go = (page: WorkbenchPage, target?: number) => {
		if (target !== undefined) data.selectChapter(target);
		navigate(page, target);
	};

	return (
		<div
			ref={surfaceRef}
			className={`mahua-root flex min-h-0 w-full flex-col overflow-hidden ${
				fullscreen ? "fixed inset-0 z-[60]" : "h-full"
			}`}
			data-fullscreen={fullscreen ? "true" : "false"}
		>
			<StudioShell
				active={route.page}
				fullscreen={fullscreen}
				onToggleFullscreen={() => setFullscreen((value) => !value)}
				trafficLights={fullscreen && mac}
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
							className="mt-2 flex h-7 items-center rounded-control border border-line px-3 text-[10px] text-ink"
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
}
