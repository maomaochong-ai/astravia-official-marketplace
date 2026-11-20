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
 * 文档页：**工具栏在主区横向铺开**，下面才是「目录 + 正文」两栏。
 *
 * 之前的搜索框与两级筛选全塞在左侧目录栏里：面板一窄，目录栏只剩 38% 高度和 ~240px 宽，
 * 搜索框被压成一条缝、筛选 chip 挤成两行 —— 而且换目录会让整块工具栏跟着跳。
 * 工具栏是页面级操作，不该住在被拖动的列里。
 *
 * 目录与正文都吃满剩余高度；窄面板用分段切换“目录 / 正文”，返回按钮把选中项清掉
 * （`docs.select(null)`），比只切一个布尔量更可靠：正文清空后目录必然重新占满。
 */
export function DocsPage({ model, embedded = false }: PageProps & { embedded?: boolean }) {
	const { t } = useTranslation();
	const { docs, chat } = model;
	const listing = docs.hits;

	// 一级：语料组；二级：子目录（topic 第一段）。
	const [group, setGroup] = useState<string | null>(null);
	const [topic, setTopic] = useState<string | null>(null);

	const showList = docs.listOpen || !docs.selected;
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
		() => visibleGroups.map(item => ({ ...item, topics: item.topics.filter(entry => !topic || subdirOf(entry.id) === topic) })).filter(item => item.topics.length > 0),
		[visibleGroups, topic],
	);

	const [listWidth, setListWidth, resetListWidth] = useStoredWidth({
		storageKey: "hanshuang-pojia:docs-list-width",
		fallback: 288,
		min: 220,
		max: 460,
	});

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
							disabled={!docs.selected}
							onClick={() =>
								model.ask("docs", { other: docs.selected ? `${docs.selected.title} · ${docs.selected.path}` : undefined })
							}
						/>
					}
				/>
			)}

			<div className="fb-page">
				{/* 工具栏：搜索 + 两档检索 + 语料组 + 子目录 + 命中数，一行横向铺开、可换行。 */}
				<div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-surface-2 px-3 py-2 ring-1 ring-line-subtle">
					<div className="relative min-w-[150px] flex-1">
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
					<span className="h-4 w-px shrink-0 bg-line-subtle" />
					<FilterChips
						items={[
							{ id: "all", label: t("docs.group.all"), count: total },
							...groupCounts.map(item => ({
								id: item.id,
								label: t(DOC_GROUPS.find(entry => entry.id === item.id)?.labelKey ?? "docs.group.kb"),
								count: item.count,
							})),
						]}
						value={group ?? "all"}
						onChange={next => {
							setGroup(next === "all" ? null : next);
							setTopic(null);
						}}
					/>
					{subdirCounts.length > 1 ? (
						<>
							<span className="h-4 w-px shrink-0 bg-line-subtle" />
							<FilterChips
								items={[
									{ id: "all", label: t("docs.topic.all"), count: subdirCounts.reduce((sum, item) => sum + item[1], 0) },
									...subdirCounts.map(([id, count]) => ({ id, label: id, count })),
								]}
								value={topic ?? "all"}
								onChange={next => setTopic(next === "all" ? null : next)}
							/>
						</>
					) : null}
					<span className="ms-auto flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-text-4">
						{docs.searching ? <Spinner className="size-3" /> : null}
						{listing ? listing.length : docs.totals.documents}
					</span>
				</div>

				<div
					style={{ "--docs-list": `${listWidth}px` } as Record<string, string>}
					className="fb-fill grid min-h-0 gap-2.5 grid-rows-[minmax(0,1fr)] @min-[900px]:grid-cols-[var(--docs-list)_5px_minmax(0,1fr)] @min-[900px]:gap-0"
				>
					<Card
						testId="docs-list-card"
						title={listing ? t("docs.search.results") : t("docs.nav.title")}
						bodyClassName="p-0"
						fill
						className={`${showList ? "" : "hidden @min-[900px]:flex"}`}
					>
						<div data-testid="docs-list" className="fb-scroll fb-fill-scroll overflow-y-auto">
							{listing ? (
								listing.length === 0 ? (
									<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{docs.searching ? t("docs.search.running") : t("docs.search.empty")}</div>
								) : (
									listing.map(hit => {
										const active = hit.entry.id === docs.selected?.id;
										return (
											<button
												key={hit.entry.id}
												type="button"
												onClick={() => docs.select(hit.entry.id)}
												aria-pressed={active}
												className={`flex w-full flex-col gap-0.5 border-b border-line-subtle px-3 py-1.5 text-left last:border-0 ${
													active ? "bg-surface-4" : "hover:bg-surface-hover"
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
													const active = doc.id === docs.selected?.id;
													return (
														<button
															key={doc.id}
															data-doc-id={doc.id}
															type="button"
															onClick={() => docs.select(doc.id)}
															aria-pressed={active}
															className={`flex w-full items-center gap-2 px-3 py-1 text-left ${active ? "bg-surface-4" : "hover:bg-surface-hover"}`}
														>
															<span className="min-w-0 flex-1 truncate text-[11.5px] text-text">{doc.title}</span>
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

					{showList ? (
						<div className="hidden @min-[900px]:flex">
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
					) : null}

					<Card
						title={docs.selected ? docs.selected.title : t("docs.reader.title")}
						actions={
							<div className="flex items-center gap-1">
								{docs.selected ? (
									<>
										<button
											type="button"
											onClick={() => docs.select(null)}
											className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text @min-[900px]:hidden"
										>
											<Icon name="chevron" className="size-3 rotate-180" />
											<span>{t("docs.reader.back")}</span>
										</button>
										<span className="hidden font-mono text-[10px] text-text-4 @min-[1100px]:inline">
											{`${docs.selected.lines} ${t("docs.reader.lines")} · ${kilobytes(docs.selected.bytes)}`}
										</span>
										<button
											type="button"
											onClick={docs.copyPath}
											className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover"
										>
											<Icon name="copy" className="size-3" />
											<span className="sr-only">{t("panel.action.copy")}</span>
										</button>
									</>
								) : null}
							</div>
						}
						bodyClassName="p-0"
						fill
					>
						{docs.selected ? (
							<div className="shrink-0 border-b border-line-subtle px-3 py-1.5 font-mono text-[10px] text-text-4">{docs.selected.path}</div>
						) : null}

						{docs.error ? (
							<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{docs.error}</div>
						) : docs.loading ? (
							<div className="flex items-center justify-center gap-2 px-3.5 py-10 text-[11.5px] text-text-4">
								<Spinner className="size-3" />
								{t("docs.reader.loading")}
							</div>
						) : docs.selected && docs.body !== null ? (
							<div className="fb-scroll fb-fill-scroll overflow-y-auto px-3.5 py-3">
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
