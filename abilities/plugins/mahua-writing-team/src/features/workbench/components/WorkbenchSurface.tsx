import { useEffect, useRef, useState } from "react";
import { getStudioRuntime } from "../../../plugin-context.js";
import { useConsoleTimeline } from "../console-timeline/use-console-timeline.js";
import {
	FULLSCREEN_SETTLE_MS,
	canLeaveStudioFullscreen,
	enterStudioFullscreen,
	forgetStudioFullscreen,
	fullscreenLanded,
	leaveStudioFullscreen,
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

/** 收回时退到的宽度：量不到用户设的宽度时的兜底，也是宿主默认值。 */
const RESTORE_FALLBACK_PX = 560;

/**
 * 工作台的装配层：七帧只在这里被选一次。运行时一定在（入口已经挡过一道）。
 *
 * 它自己不做任何事——路由在 `use-workbench-route`，事实在 `use-studio-state`，
 * 事件流在 `use-console-timeline`。这里只把几样东西接起来，唯一的行为是「有新的落盘事件就
 * 重读一次」：同步只有这一个方向。
 *
 * 一张界面，两个宿主形态，`mode` 是唯一的差别：
 *
 * - `"tab"`（默认）——活动面板里的标签页。报头的键是「全屏工作台」，按下去跳整页视图。
 * - `"page"`——整页路由。全屏在这里是**事实**，不是意图；键变成「退出全屏」。
 *
 * 为什么「铺满」不能只靠拉宽面板：宿主的面板宽度模型有一条硬底线，面板再宽也要给会话区留
 * `384px`（`ACTIVITY_PANEL_MIN_CHAT_AREA` 在 atom 层统一夹紧，插件传多大都无效）。所以
 * `setActivityPanelWidth("max")` 拿到的是「窗口宽 − 384」，不是全屏。真正的全屏只有整页视图
 * 这条路（`../fullscreen.ts` 里写着判定与退路）。
 *
 * 三条仍然成立的禁区：不许 `fixed`、不许超大 `z-index`、不许 portal 到 body。它们只把画面
 * 蒙住，盖不住宿主的标签条与侧栏，还得赌宿主的层叠上下文——本条纪律由 `manifest-guards` 钉住。
 */
export function WorkbenchSurface({ mode = "tab" }: { mode?: "tab" | "page" }) {
	const t = useTranslator();
	const data = useStudioState();
	const { route, navigate } = useWorkbenchRoute();
	const rail = useRailCollapsed();
	const { ref: surfaceRef, narrow, width } = useNarrowSurface();
	const events = useConsoleTimeline();
	const [now, setNow] = useState(() => Date.now());
	// 面板这一形态里 `expanded` 是意图（用户按了全屏，面板已拉到最宽，但会话区仍在）；
	// 整页这一形态里它是事实。界面不区分这两者的画法，只区分能不能再往外走一步。
	const [expanded, setExpanded] = useState(false);
	const page = mode === "page";
	const fullscreen = page || expanded;
	/** 退回面板时要还的宽度；只在 `"tab"` 的退路里用得到。 */
	const restoreRef = useRef<number | null>(null);

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

	const setPanelWidth = (next: number | "max") => {
		// 权限或宿主版本不满足时 SDK 只是 warn + noop：这里不该为此抛错，
		// 面板宽度是锦上添花，不是这张工作台能画出来的前提。
		getStudioRuntime().ctx.ui.setActivityPanelWidth(next);
	};

	const collapse = () => {
		setPanelWidth(restoreRef.current ?? RESTORE_FALLBACK_PX);
		restoreRef.current = null;
		setExpanded(false);
	};

	/**
	 * 进全屏：先请求宿主的整页路由。
	 *
	 * 缺权限时 `openWorkspaceView` 直接抛（`require`），宿主太旧时它干脆不存在；两种情况
	 * 都不会告诉我们「跳转失败」，所以隔一小段比对 hash：没跳成就在原地把面板拉到最宽——
	 * 键按下去一定有事发生。
	 */
	const expand = () => {
		restoreRef.current = width > 0 ? width : null;
		const before = enterStudioFullscreen();
		window.setTimeout(() => {
			if (fullscreenLanded(before)) return;
			// 没跳成：把「这次是从标签页进来的」也一并忘掉，否则下一次落到整页视图时
			// 会多出一枚指向无关页面的退出键。
			forgetStudioFullscreen();
			setPanelWidth("max");
			setExpanded(true);
		}, FULLSCREEN_SETTLE_MS);
	};

	// 全屏之后 Esc 是第一退路：整页里退回上一个路由，面板里把宽度还回去。
	useEffect(() => {
		if (!fullscreen) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (page) leaveStudioFullscreen();
			else collapse();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	// 整页形态没有「退出」可走时（从侧栏直接进来）就不给这枚键：按下历史后退只会
	// 把人送到别的页面，宿主侧栏才是那种情况下的出口。
	const toggle = page ? (canLeaveStudioFullscreen() ? leaveStudioFullscreen : undefined) : fullscreen ? collapse : expand;

	const book = data.book;
	const chapter = book?.progress.currentChapter ?? 0;
	const arc = book ? arcOf(book, chapter) : null;
	const writing = landed && isWriting(events, now) ? landed : null;
	const frontier = book ? committedFrontier(book) : 0;

	const go = (page: WorkbenchPage, target?: number) => {
		if (target !== undefined) data.selectChapter(target);
		navigate(page, target);
	};

	const surface = (
		<div
			ref={surfaceRef}
			className="mahua-root flex h-full min-h-0 w-full flex-col overflow-hidden"
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

	return surface;
}
