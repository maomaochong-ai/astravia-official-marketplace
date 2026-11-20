import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";
import { SplitHandle, useStoredWidth } from "../../hooks/use-sidebar-width";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { Markdown } from "../shell/markdown";
import { PageHeader } from "../shell/page-header";
import { Spinner } from "../shell/spinner";
import type { DocSearchMode } from "../../hooks/use-docs";
import type { PageProps } from "./overview";
import { DOC_GROUPS } from "../../services/docs";

const MODES: DocSearchMode[] = ["title", "full"];

function kilobytes(bytes: number): string {
	return `${Math.round(bytes / 1024)} KB`;
}

/**
 * 文档页：工具栏一行、下面「目录树 + 预览」。
 *
 * 三处按反馈改的地方：
 *   1. **筛选不再铺一排 chip**。语料分五组、组内还有几十个子目录，铺开必然换行把工具栏撑成两行；
 *      改成「筛选」按钮 + 分级菜单（组 → 子目录），一次只展开一层。
 *   2. **窄面板不再把两张卡塞进同一格**。之前两卡都在 grid 的唯一一行里，列表占满高度、
 *      预览被挤到行外看不见 —— 这就是「点了不显示」。现在窄面板按选中状态二选一，
 *      宽面板才并排（`@min-[980px]`）。
 *   3. **预览带定位**：当前文档的标题与路径固定在预览卡头，正文自己滚，滚到哪儿都不丢位置感。
 */
export function DocsPage({ model, embedded = false }: PageProps & { embedded?: boolean }) {
	const { t } = useTranslation();
	const { docs, chat } = model;
	const listing = docs.hits;

	const [group, setGroup] = useState<string | null>(null);
	const [topic, setTopic] = useState<string | null>(null);

	const selected = docs.selected;
	const readerOnly = selected !== null && !docs.listOpen;

	const groupCounts = docs.groups.map(item => ({ id: item.id, count: item.topics.reduce((sum, entry) => sum + entry.entries.length, 0) }));
	const total = groupCounts.reduce((sum, item) => sum + item.count, 0);
	const visibleGroups = group ? docs.groups.filter(item => item.id === group) : docs.groups;

	const subdirOf = (id: string | null | undefined): string => (id ? id.split("/")[0] : "");
	const subdirCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const item of visibleGroups) {
			for (const entry of item.topics) {
				const key = subdirOf(entry.id);
				if (key) counts.set(key, (counts.get(key) ?? 0) + entry.entries.length);
			}
		}
		return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
	}, [visibleGroups]);

	const browsableGroups = useMemo(
		() =>
			visibleGroups
				.map(item => ({ ...item, topics: item.topics.filter(entry => !topic || subdirOf(entry.id) === topic) }))
				.filter(item => item.topics.length > 0),
		[visibleGroups, topic],
	);

	const [listWidth, setListWidth, resetListWidth] = useStoredWidth({
		storageKey: "hanshuang-pojia:docs-list-width",
		fallback: 288,
		min: 220,
		max: 460,
	});

	const activeGroupLabel = group ? t(DOC_GROUPS.find(entry => entry.id === group)?.labelKey ?? "docs.group.kb") : t("docs.group.all");
	const filterOpen = group !== null || topic !== null;

	return (
		<>
			{embedded ? null : (
				<PageHeader
					title={t("page.docs.title")}
					description={t("page.docs.lead")}
					actions={
						<AiButton
							label={t("ai.docs")}
							busy={chat.sending}
							disabled={!selected}
							onClick={() => model.ask("docs", { other: selected ? `${selected.title} · ${selected.path}` : undefined })}
						/>
					}
				/>
			)}

			<div className="fb-page">
				{/* 工具栏：搜索 + 两档检索 + 一个筛选菜单 + 计数。高度固定一行，不换行。 */}
				<div className="flex shrink-0 flex-nowrap items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-1.5 ring-1 ring-line-subtle">
					<div className="relative min-w-0 flex-1">
						<Icon name="search" className="pointer-events-none absolute start-2 top-1/2 size-3 -translate-y-1/2 text-text-4" />
						<input
							value={docs.query}
							onChange={event => docs.setQuery(event.target.value)}
							placeholder={t("docs.search.placeholder")}
							aria-label={t("docs.search.placeholder")}
							className="w-full rounded-md border border-line-subtle bg-surface py-1 pe-2 ps-7 text-[11.5px] text-text outline-none placeholder:text-text-4 focus:border-accent"
						/>
					</div>
					<FilterChips items={MODES.map(mode => ({ id: mode, label: t(`docs.search.${mode}`) }))} value={docs.mode} onChange={docs.setMode} />

					{/* 分级菜单：组一层、子目录一层，选中即收起。 */}
					<details className="fb-menu relative shrink-0">
						<summary
							className={`flex cursor-pointer list-none items-center gap-1 rounded-md border px-1.5 py-1 text-[10.5px] transition-colors ${
								filterOpen ? "border-accent/40 bg-accent-soft text-accent" : "border-line-subtle text-text-2 hover:bg-surface-hover"
							}`}
						>
							<Icon name="filter" className="size-3" />
							<span className="max-w-[120px] truncate">{filterOpen ? activeGroupLabel : t("docs.filter")}</span>
						</summary>
						<div className="absolute end-0 top-full z-20 mt-1 max-h-[60vh] w-56 overflow-y-auto rounded-lg bg-surface-2 p-1 ring-1 ring-line-strong shadow-lg">
							<button
								type="button"
								onClick={() => {
									setGroup(null);
									setTopic(null);
								}}
								className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] ${
									group === null ? "bg-surface-4 text-text" : "text-text-2 hover:bg-surface-hover"
								}`}
							>
								<span className="min-w-0 flex-1 truncate">{t("docs.group.all")}</span>
								<span className="font-mono text-[9.5px] text-text-4">{total}</span>
							</button>
							{groupCounts.map(item => {
								const active = group === item.id;
								return (
									<div key={item.id}>
										<button
											type="button"
											onClick={() => {
												setGroup(active ? null : item.id);
												setTopic(null);
											}}
											className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] ${
												active ? "bg-surface-4 text-text" : "text-text-2 hover:bg-surface-hover"
											}`}
										>
											<Icon name={active ? "chevron" : "chevron"} className={`size-3 shrink-0 text-text-4 ${active ? "rotate-90" : ""}`} />
											<span className="min-w-0 flex-1 truncate">{t(DOC_GROUPS.find(entry => entry.id === item.id)?.labelKey ?? "docs.group.kb")}</span>
											<span className="font-mono text-[9.5px] text-text-4">{item.count}</span>
										</button>
										{/* 第二级：只在该组展开时出现，缩进一层。 */}
										{active && subdirCounts.length > 1 ? (
											<div className="mb-1 ms-4 border-s border-line-subtle ps-1.5">
												<button
													type="button"
													onClick={() => setTopic(null)}
													className={`flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-[10.5px] ${
														topic === null ? "text-accent" : "text-text-3 hover:text-text"
													}`}
												>
													{t("docs.topic.all")}
												</button>
												{subdirCounts.map(([id, count]) => (
													<button
														key={id}
														type="button"
														onClick={() => setTopic(id === topic ? null : id)}
														className={`flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-[10.5px] ${
															topic === id ? "text-accent" : "text-text-3 hover:text-text"
														}`}
													>
														<span className="min-w-0 flex-1 truncate">{id}</span>
														<span className="font-mono text-[9px] text-text-4">{count}</span>
													</button>
												))}
											</div>
										) : null}
									</div>
								);
							})}
						</div>
					</details>

					<span className="ms-auto flex shrink-0 items-center gap-1 font-mono text-[10px] text-text-4">
						{docs.searching ? <Spinner className="size-3" /> : null}
						{listing ? listing.length : docs.totals.documents}
					</span>
				</div>

				<div
					style={{ "--docs-list": `${listWidth}px` } as Record<string, string>}
					className="fb-fill grid min-h-0 grid-rows-[minmax(0,1fr)] gap-2.5 @min-[980px]:grid-cols-[var(--docs-list)_5px_minmax(0,1fr)] @min-[980px]:gap-0"
				>
					<Card
						testId="docs-list-card"
						title={listing ? t("docs.search.results") : t("docs.nav.title")}
						bodyClassName="p-0"
						fill
						className={readerOnly ? "hidden @min-[980px]:flex" : ""}
					>
						<div data-testid="docs-list" className="fb-scroll fb-fill-scroll overflow-y-auto">
							{listing ? (
								listing.length === 0 ? (
									<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{docs.searching ? t("docs.search.running") : t("docs.search.empty")}</div>
								) : (
									listing.map(hit => {
										const active = hit.entry.id === selected?.id;
										return (
											<button
												key={hit.entry.id}
												type="button"
												onClick={() => docs.select(hit.entry.id)}
												aria-pressed={active}
												className={`flex w-full flex-col gap-0.5 border-b border-line-subtle px-3 py-1.5 text-left last:border-0 ${
													active ? "bg-accent-soft text-text" : "hover:bg-surface-hover"
												}`}
											>
												<span className="w-full truncate text-[11.5px] text-text">{hit.entry.title}</span>
												<span className="w-full truncate font-mono text-[10px] text-text-4">{hit.entry.id}</span>
												{hit.snippet ? <span className="line-clamp-2 w-full text-[10.5px] leading-snug text-text-3">{hit.snippet}</span> : null}
											</button>
										);
									})
								)
							) : !docs.ready ? (
								<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{t("docs.index.loading")}</div>
							) : (
								browsableGroups.map(entry => (
									<div key={entry.id} className="border-b border-line-subtle last:border-0">
										<div className="bg-surface-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-4">
											{t(DOC_GROUPS.find(item => item.id === entry.id)?.labelKey ?? "docs.group.kb")}
										</div>
										{entry.topics.map(topicEntry => (
											<div key={`${entry.id}-${topicEntry.id}`}>
												{topicEntry.id ? <div className="px-3 pt-1.5 pb-0.5 font-mono text-[10px] text-text-4">{topicEntry.id}</div> : null}
												{topicEntry.entries.map(doc => {
													const active = doc.id === selected?.id;
													return (
														<button
															key={doc.id}
															data-doc-id={doc.id}
															type="button"
															onClick={() => docs.select(doc.id)}
															aria-pressed={active}
															className={`flex w-full items-center gap-2 px-3 py-1 text-left ${active ? "bg-accent-soft" : "hover:bg-surface-hover"}`}
														>
															<span className={`min-w-0 flex-1 truncate text-[11.5px] ${active ? "text-accent" : "text-text"}`}>{doc.title}</span>
															<span className="shrink-0 font-mono text-[9.5px] text-text-4">{kilobytes(doc.bytes)}</span>
														</button>
													);
												})}
											</div>
										))}
									</div>
								))
							)}
						</div>
					</Card>

					<div className="hidden @min-[980px]:flex">
						<SplitHandle
							side="right"
							value={listWidth}
							min={220}
							max={460}
							onChange={setListWidth}
							onReset={resetListWidth}
							label={t("docs.list.resize")}
						/>
					</div>

					<Card
						title={selected ? selected.title : t("docs.reader.title")}
						actions={
							selected ? (
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => docs.showList()}
										className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text @min-[980px]:hidden"
									>
										<Icon name="chevron" className="size-3 rotate-180" />
										<span>{t("docs.reader.back")}</span>
									</button>
									<button
										type="button"
										onClick={docs.copyPath}
										className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover"
									>
										<Icon name="copy" className="size-3" />
										<span className="sr-only">{t("panel.action.copy")}</span>
									</button>
								</div>
							) : undefined
						}
						bodyClassName="p-0"
						fill
						className={readerOnly ? "" : "hidden @min-[980px]:flex"}
					>
						{selected ? (
							<div className="flex shrink-0 items-center gap-2 border-b border-line-subtle px-3 py-1.5">
								<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-4">{selected.path}</span>
								<span className="shrink-0 font-mono text-[9.5px] text-text-4">
									{`${selected.lines} ${t("docs.reader.lines")} · ${kilobytes(selected.bytes)}`}
								</span>
							</div>
						) : null}

						{docs.error ? (
							<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{docs.error}</div>
						) : docs.loading ? (
							<div className="flex items-center justify-center gap-2 px-3.5 py-10 text-[11.5px] text-text-4">
								<Spinner className="size-3" />
								{t("docs.reader.loading")}
							</div>
						) : selected && docs.body !== null ? (
							<div data-testid="docs-body" className="fb-scroll fb-fill-scroll overflow-y-auto px-3.5 py-3">
								<Markdown source={docs.body} />
							</div>
						) : (
							<EmptyState icon="book" title={t("docs.reader.empty.title")} body={t("docs.reader.empty.body")} />
						)}
					</Card>
				</div>
			</div>
		</>
	);
}
