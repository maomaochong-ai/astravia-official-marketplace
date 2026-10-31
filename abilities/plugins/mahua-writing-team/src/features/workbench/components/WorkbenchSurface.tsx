import { useEffect, useRef, useState } from "react";
import { getStudioRuntime } from "../../../plugin-context.js";
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
 * 收回时用的宽度：量不到当前宽度（首帧、宿主隐藏）才用它。
 * 取 560 是因为工作台的两栏版面在这个宽度上刚好都不塌。
 */
const RESTORE_FALLBACK_PX = 560;

/**
 * 工作台的装配层：七帧只在这里被选一次。运行时一定在（入口已经挡过一道）。
 *
 * 它自己不做任何事——路由在 `use-workbench-route`，事实在 `use-studio-state`，
 * 事件流在 `use-console-timeline`。这里只把几样东西接起来，唯一的行为是「有新的落盘事件就
 * 重读一次」：同步只有这一个方向。
 *
 * 「铺满」= 让**宿主**把活动面板拉到最宽，而不是插件自己盖一层覆盖层。
 *
 * 从前这里是 `createPortal` 到 `document.body` 的 `fixed inset-0` 覆盖层，理由是「宿主工作区
 * 视图做不到只有插件」。那条路有三个治不好的毛病，用户两个都撞上了：
 *
 * 1. 覆盖层盖住的只是**画面**，宿主的标签条与侧栏仍在原地——视觉上是「标签菜单残留在工作台
 *    上」，交互上侧栏并没有真的收起，只是被蒙住；
 * 2. 想把整窗铺满就得给自己一个极大的 `z-index`，而插件 CSS 编在 `@scope` 里，压不压得住宿主
 *    壳层取决于宿主的层叠上下文，宿主改一次外壳就可能翻车；
 * 3. 它违反本仓库的版面纪律：面板类 slot 不许 `fixed`、不许超大 `z-index`、不许 portal 到 body。
 *
 * 现在走宿主自己的宽度通道：`ctx.ui.setActivityPanelWidth("max")`。宿主的面板宽度模型在面板
 * 超过 `窗口宽 - 384` 时**自动收起左侧栏**（`useActivityPanelModel` 的 `reconcileSidebarForWidth`），
 * 退出时再把用户原来的意愿位还原——这正是「全屏时侧栏该让位」的正确实现点，由宿主做，
 * 插件不碰宿主的 DOM，也不需要额外权限。收回时把展开前量到的宽度原样还回去。
 */
export function WorkbenchSurface() {
	const t = useTranslator();
	const data = useStudioState();
	const { route, navigate } = useWorkbenchRoute();
	const rail = useRailCollapsed();
	const { ref: surfaceRef, narrow, width } = useNarrowSurface();
	const events = useConsoleTimeline();
	const [now, setNow] = useState(() => Date.now());
	const [expanded, setExpanded] = useState(false);
	/** 展开前的面板宽度；收回时还回去，而不是塞一个写死的值。 */
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

	const expand = () => {
		restoreRef.current = width > 0 ? width : null;
		setPanelWidth("max");
		setExpanded(true);
	};

	// 铺满之后 Esc 收回：这是模态化的唯一残留，键盘用户得有一条退路。
	useEffect(() => {
		if (!expanded) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") collapse();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

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
			data-expanded={expanded ? "true" : "false"}
		>
			<StudioShell
				active={route.page}
				expanded={expanded}
				onToggleExpanded={expanded ? collapse : expand}
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
