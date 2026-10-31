import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import type { WorkbenchPage } from "../../workbench-pages";
import { useConsoleTimeline } from "../../console-timeline/use-console-timeline";
import { isWriting, lastLandedStudioEvent } from "../../workbench-feed";
import { coverSeed, elapsedSince, formatCount, percent, wanWords } from "../../workbench-model";
import { Cover } from "../shell/Cover";
import { EmptySheet } from "../shell/EmptySheet";
import { PageHeader } from "../shell/PageHeader";
import { PhaseBadge } from "../shell/PhaseBadge";
import { COLUMNS, columnClassName, HEADER_CELLS, HIDE_CHAPTERS, HIDE_GENRE, HIDE_UPDATED } from "./library-columns";

const PAGE_SIZE = 9;

/** 六列表头：书名 / 题材·篇幅 / 阶段 / 章·进度 / 字数 / 更新。
 *
 * 宽度不够时**丢列**（题材篇幅与字数 → 章进度 → 更新），而不是把六列一起压到叠字。
 * 列模板、每格的隐藏档位都写在 `library-columns.ts`：表头与行共用同一组，守卫测试逐档
 * 核对「轨道数 = 可见单元格数」——多出来的子项会被 grid 塞进隐式第二行，那正是列错位的根因。 */

// 与 `NovelPhase` 同序：落库的阶段一个都不能漏，否则筛选带会对某些书静默失灵
// （`arc_close` 曾经漏在这里）。
const PHASES = ["briefing", "planning", "drafting", "revising", "arc_close", "completed"] as const;

type SizeKey = "long" | "medium" | "short";
type SortKey = "recent" | "chapters" | "title";

/**
 * 篇幅按**计划章数**分档，不按已写字数：一本 40 章的新书刚立项时字数是 0，
 * 按字数会被算成短篇。计划章数是它立项时定下的承诺，也是用户心里的那件事。
 */
function sizeOf(targetChapters: number): SizeKey {
	if (targetChapters >= 50) return "long";
	if (targetChapters >= 20) return "medium";
	return "short";
}

const SIZES: readonly SizeKey[] = ["long", "medium", "short"];

const SORT_LABELS: Record<SortKey, string> = {
	recent: "library.sort.recent",
	chapters: "library.sort.chapters",
	title: "library.sort.title",
};

/**
 * 书库：一条筛选带，一张满宽台账。
 *
 * 这一版的排版语言换过一次（ADR 0033）：筛选带不再是一张带投影的横条 + 三根竖杠，
 * 而是三组凹槽（每组一个维度）加一组排序；台账不再是「卡头 / 表头 / 行 / 卡尾」四段
 * 各画一根分隔线，而是「表头是一条凹槽、页脚是另一条凹槽，中间的行自己浮在卡片上」。
 * 分隔交给底色与间距，不交给线。
 *
 * 筛选与排序都是本页的瞬时状态——工作台不改任何书的事实，只改「现在看哪几本」。
 * 因此这里没有成书、也没有编辑入口：一行只是一个通往书页的门。
 */
export function LibraryPage({
	data,
	onNavigate,
}: {
	data: StudioState;
	onNavigate: (page: WorkbenchPage, chapter?: number) => void;
}) {
	const t = useTranslator();
	const now = Date.now();
	const events = useConsoleTimeline();
	const [genre, setGenre] = useState<string | null>(null);
	const [phase, setPhase] = useState<string | null>(null);
	const [size, setSize] = useState<SizeKey | null>(null);
	const [sort, setSort] = useState<SortKey>("recent");
	const [page, setPage] = useState(0);

	const landed = lastLandedStudioEvent(events);
	const writing = landed && isWriting(events, now) ? landed : null;

	const genres = useMemo(() => {
		const seen = new Map<string, number>();
		for (const entry of data.books) {
			const key = (entry.genre ?? "").trim();
			if (key.length > 0) seen.set(key, (seen.get(key) ?? 0) + 1);
		}
		return [...seen.entries()].sort((a, b) => b[1] - a[1]);
	}, [data.books]);

	const sizeCounts = useMemo(() => {
		const counts: Record<SizeKey, number> = { long: 0, medium: 0, short: 0 };
		for (const entry of data.books) counts[sizeOf(entry.targetChapters)] += 1;
		return counts;
	}, [data.books]);

	const filtered = useMemo(() => {
		const rows = data.books.filter((entry) => {
			if (genre !== null && (entry.genre ?? "").trim() !== genre) return false;
			if (phase !== null && entry.phase !== phase) return false;
			if (size !== null && sizeOf(entry.targetChapters) !== size) return false;
			return true;
		});
		return [...rows].sort((a, b) => {
			if (sort === "title") return a.title.localeCompare(b.title);
			if (sort === "chapters") return b.committedCount - a.committedCount;
			return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
		});
	}, [data.books, genre, phase, size, sort]);

	const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const current = Math.min(page, pages - 1);
	const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
	const words = filtered.reduce((sum, entry) => sum + (entry.words ?? 0), 0);

	/** 改筛选/排序就回到第一页：否则当前页可能已经不存在。 */
	const pick = (next: () => void) => {
		setPage(0);
		next();
	};

	// 页头的「上一本 / 下一本」：在**当前筛选结果**里逐本走，不跳页、不离开书库——
	// 换书之后还能接着比。当前作品不在筛选结果里时从第一个开始走。
	const currentIndex = filtered.findIndex((entry) => entry.id === data.book?.id);
	const stepBook = (delta: number) => {
		if (filtered.length < 2) return;
		const from = currentIndex < 0 ? 0 : currentIndex;
		data.selectBook(filtered[(from + delta + filtered.length) % filtered.length].id);
	};

	/** 一枚筛选片：选中的从凹槽里浮起来，没选中的只在悬停时沾一点墨。
	 *  从前选中态是黑底反白，一排看下来像一排按钮；纸面语言里「选中」应该是
	 * 这一格被抬起来，而不是被涂黑。 */
	const chip = (active: boolean) =>
		`flex h-6 shrink-0 items-center gap-1 rounded-pill px-2 text-[10px] transition-colors ${
			active ? "bg-raised font-medium text-ink shadow-raise" : "text-ink-soft hover:bg-wash"
		}`;

	/* 计数不跟着选中态变颜色：同一列数字忽深忽浅反而更难比对。 */
	const chipCount = "font-mono text-ink-faint";

	const group = (label: string, children: ReactNode) => (
		<div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-panel bg-well px-2 py-1.5">
			<span className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
				{label}
			</span>
			{children}
		</div>
	);

	const stepButton = (delta: number, label: string, icon: string) => (
		<button
			type="button"
			onClick={() => stepBook(delta)}
			disabled={filtered.length < 2}
			title={label}
			aria-label={label}
			className="flex size-7 shrink-0 items-center justify-center rounded-control bg-well text-ink-soft transition-colors hover:bg-wash-strong hover:text-ink disabled:opacity-40 disabled:hover:bg-well"
		>
			<span className={`${icon} size-3.5`} />
		</button>
	);

	return (
		<div className="mahua-page">
			<PageHeader
				back={{ label: t("library.back"), onBack: () => onNavigate("shelf") }}
				title={t("page.library.title")}
				meta={
					<span className="text-body-sm text-ink-soft">
						{t("library.meta", { count: filtered.length, words: wanWords(words) })}
					</span>
				}
				right={
					<>
						{stepButton(-1, t("library.stepPrev"), "icon-[solar--alt-arrow-left-bold]")}
						{stepButton(1, t("library.stepNext"), "icon-[solar--alt-arrow-right-bold]")}
					</>
				}
			/>

			{/* 筛选带：三个维度各占一格凹槽，排序钉在右端。它不锁高也不再 `overflow-hidden`：
			 * 面板拖到 500px 时三个分组放不下，从前会被硬生生裁掉半个 chip（看着像渲染错位）。
			 * 宁可让带子长成两行，也不让某一项只剩一半。 */}
			<div className="mt-3 flex shrink-0 flex-wrap items-center gap-2">
				{group(
					t("library.filter.genre"),
					<>
						<button type="button" onClick={() => pick(() => setGenre(null))} className={chip(genre === null)}>
							{t("library.all")}
							<span className={chipCount}>{data.books.length}</span>
						</button>
						{genres.map(([name, count]) => (
							<button
								key={name}
								type="button"
								onClick={() => pick(() => setGenre(genre === name ? null : name))}
								className={chip(genre === name)}
							>
								<span className="max-w-[96px] truncate">{name}</span>
								<span className={chipCount}>{count}</span>
							</button>
						))}
					</>,
				)}

				{group(
					t("library.filter.status"),
					<>
						{PHASES.map((name) => (
							<button
								key={name}
								type="button"
								onClick={() => pick(() => setPhase(phase === name ? null : name))}
								className={chip(phase === name)}
							>
								{t(`phase.${name}`)}
								<span className={chipCount}>
									{data.books.filter((entry) => entry.phase === name).length}
								</span>
							</button>
						))}
					</>,
				)}

				{group(
					t("library.filter.length"),
					<>
						{SIZES.map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => pick(() => setSize(size === key ? null : key))}
								className={chip(size === key)}
							>
								{t(`library.size.${key}`)}
								<span className={chipCount}>{sizeCounts[key]}</span>
							</button>
						))}
					</>,
				)}

				<div className="ml-auto flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-panel bg-well px-2 py-1.5">
					<span className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
						{t("library.filter.sort")}
					</span>
					{(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
						<button
							key={key}
							type="button"
							onClick={() => pick(() => setSort(key))}
							aria-pressed={sort === key}
							className={chip(sort === key)}
						>
							{t(SORT_LABELS[key])}
						</button>
					))}
				</div>
			</div>

			{/* 满宽台账：状态行只读，表头是一条凹槽，行内部滚，页脚是另一条凹槽。
			 * 四段之间没有一根 `border-*`——分隔靠底色与 8px 间距。 */}
			<section className="mahua-card mt-3 flex min-h-0 flex-1 flex-col">
				<div className="flex shrink-0 items-center gap-2 px-4 pt-3">
					{writing ? (
						<>
							<span className="size-1.5 shrink-0 rounded-pill bg-cinnabar" />
							<span className="min-w-0 flex-1 truncate text-micro text-ink">
								{t("library.ledgerWriting", { chapter: writing.chapter ?? 0 })}
							</span>
						</>
					) : (
						<span className="min-w-0 flex-1 truncate text-micro text-ink-faint">{t("library.ledgerIdle")}</span>
					)}
					<span className="min-w-0 truncate text-[10px] text-ink-faint">{t("library.ledgerNote")}</span>
				</div>

				<div
					className={`mx-2 mt-2 grid ${COLUMNS} shrink-0 items-center gap-3 rounded-control bg-well px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-faint`}
				>
					{HEADER_CELLS.map((cell) => (
						<span key={cell.key} className={`min-w-0 truncate ${columnClassName(cell)}`}>
							{t(cell.key)}
						</span>
					))}
				</div>

				{rows.length === 0 ? (
					<div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-2">
						<EmptySheet icon="icon-[solar--layers-bold]" title={t("library.empty")} />
					</div>
				) : (
					<ul className="mahua-scroll mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-1">
						{rows.map((entry) => {
							const ago = elapsedSince(entry.updatedAt, now);
							const done = percent(entry.committedCount, entry.targetChapters);
							const isCurrent = entry.id === data.book?.id;
							return (
								<li key={entry.id} className="h-14">
									<button
										type="button"
										onClick={() => {
											data.selectBook(entry.id);
											onNavigate("book");
										}}
										aria-current={isCurrent ? "true" : undefined}
										className={`group grid h-full w-full ${COLUMNS} items-center gap-3 rounded-control px-3 text-left transition-colors ${
											isCurrent ? "bg-cinnabar-soft hover:bg-wash" : "hover:bg-wash"
										}`}
									>
										<span className="flex min-w-0 items-center gap-2.5">
											<Cover {...coverSeed(entry.title)} size="thumb" />
											<span className="min-w-0">
												<span
													className={`block truncate font-display text-body-sm font-semibold ${
														isCurrent ? "text-cinnabar-ink" : "text-ink"
													}`}
												>
													{entry.title}
												</span>
												<span className="flex items-center gap-1 truncate text-[10px] text-ink-faint">
													<span className="icon-[solar--arrow-right-up-linear] size-2.5" />
													{t("library.open")}
												</span>
											</span>
										</span>
										<span className={`flex min-w-0 flex-col ${HIDE_GENRE}`}>
											<span className="truncate text-micro text-ink-soft">
												{entry.genre ?? t("library.card.noGenre")}
											</span>
											<span className="truncate text-[10px] text-ink-faint">
												{t(`library.size.${sizeOf(entry.targetChapters)}`)}
											</span>
										</span>
										<span className="min-w-0">
											<PhaseBadge phase={entry.phase} />
										</span>
										<span className={`flex min-w-0 items-center gap-2.5 ${HIDE_CHAPTERS}`}>
											<span className="w-[46px] shrink-0 font-mono text-[11px] tabular-nums text-ink">
												{entry.committedCount}
												<span className="text-ink-faint">/{entry.targetChapters}</span>
											</span>
											<span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-pill bg-wash-strong">
												<span className="block h-full rounded-pill bg-ink/60" style={{ width: `${done}%` }} />
											</span>
											<span className="w-[30px] shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-faint">
												{done}%
											</span>
										</span>
										<span className={`text-right font-mono text-[11px] tabular-nums text-ink-soft ${HIDE_GENRE}`}>
											{entry.words ? formatCount(entry.words) : "—"}
										</span>
										<span className={`text-right text-[10px] text-ink-faint ${HIDE_UPDATED}`}>
											{ago ? t(ago.key, { count: ago.count }) : "—"}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}

				<div className="m-2 mt-0 flex shrink-0 items-center gap-3 rounded-control bg-well px-3 py-1.5 text-micro text-ink-soft">
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => setPage(Math.max(0, current - 1))}
							disabled={current === 0}
							aria-label={t("library.prev")}
							className="flex size-6 items-center justify-center rounded-control text-ink-faint transition-colors hover:bg-wash-strong hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
						>
							<span className="icon-[solar--alt-arrow-left-bold] size-3.5" />
						</button>
						<span className="font-mono tabular-nums">{t("library.page", { page: current + 1, pages })}</span>
						<button
							type="button"
							onClick={() => setPage(Math.min(pages - 1, current + 1))}
							disabled={current >= pages - 1}
							aria-label={t("library.next")}
							className="flex size-6 items-center justify-center rounded-control text-ink-faint transition-colors hover:bg-wash-strong hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
						>
							<span className="icon-[solar--alt-arrow-right-bold] size-3.5" />
						</button>
					</div>
					<span className="ml-auto min-w-0 truncate text-[10px] text-ink-faint">
						{t("library.footer", { size: PAGE_SIZE })}
					</span>
				</div>
			</section>
		</div>
	);
}

