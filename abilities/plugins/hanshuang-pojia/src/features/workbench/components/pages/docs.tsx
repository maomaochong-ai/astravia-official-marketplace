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
import { StatTile } from "../shell/stat-tile";
import type { DocSearchMode } from "../../hooks/use-docs";
import type { PageProps } from "./overview";
import { DOC_GROUPS } from "../../services/docs";

const MODES: DocSearchMode[] = ["title", "full"];

function kilobytes(bytes: number): string {
	return `${Math.round(bytes / 1024)} KB`;
}

/**
 * 实战文档页：左栏是工具包文档库的目录与检索，右栏渲染选中的 Markdown。
 *
 * 文档随插件发布，正文按篇拆块，点开才加载；检索分标题与全文两档，
 * 全文要读完整个库，所以只在用户显式切换时执行。
 *
 * 版面按「容器填到底」组织：两张卡都是 .fb-fill，卡体自己滚。
 * 以前用 max-h-[520px]/[620px] 封顶，面板比它高时下面就空出一条底色——
 * 圆角容器停在半空是这类界面最明显的缺陷。
 */
export function DocsPage({ model, embedded = false }: PageProps & { embedded?: boolean }) {
	const { t } = useTranslation();
	const { docs, chat } = model;
	const listing = docs.hits;
	// 两级筛选：先按语料组（kb / manual / kit-docs / cases / reference），
	// 再按子目录（kb 的 66 个专题目录、cases 的 19 个案例目录）。一级筛选只能缩到几百篇，两级才找得到。
	const [group, setGroup] = useState<string | null>(null);
	const [topic, setTopic] = useState<string | null>(null);
	// 列表与栅格列模板必须同进同退：列模板留在两列时，收起列表会让正文落进 240–300px 的首列。
	const showList = docs.listOpen || !docs.selected;
	const groupCounts = docs.groups.map(item => ({ id: item.id, count: item.topics.reduce((sum, topic) => sum + topic.entries.length, 0) }));
	const total = groupCounts.reduce((sum, item) => sum + item.count, 0);
	const visibleGroups = group ? docs.groups.filter(item => item.id === group) : docs.groups;

	// 子目录 = 条目 topic 的第一段（`apk-reverse/ai-findings` → `apk-reverse`）。
	// 二级筛选读这一段而不是完整 topic：66 个专题目录会变成一屏 chip，反而没人选。
	const subdirOf = (id: string | null | undefined): string => (id ? id.split("/")[0] : "");
	const subdirCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const item of visibleGroups) {
			for (const entry of item.topics) {
				{
					const key = subdirOf(entry.id);
					if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
				}
			}
		}
		return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
	}, [visibleGroups]);

	const browsableGroups = useMemo(
		() =>
			visibleGroups
				.map(item => ({
					...item,
					topics: item.topics
						.filter(entry => !topic || subdirOf(entry.id) === topic)
						.map(entry => ({ ...entry, entries: entry.entries })),
				}))
				.filter(item => item.topics.length > 0),
		[visibleGroups, topic],
	);
	// 左右两栏之间可以拖：分类从 4 组变成 5 组后，列表标题变长，固定 240–300px 会截断。
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
								model.ask("docs", {
									other: docs.selected ? `${docs.selected.title} · ${docs.selected.path}` : undefined,
								})
							}
						/>
					}
				/>
			)}

			<div className="fb-page">
				<div className="grid shrink-0 grid-cols-3 gap-2">
					<StatTile label={t("docs.stat.documents")} value={docs.totals.documents} />
					<StatTile label={t("docs.stat.volume")} value={kilobytes(docs.totals.bytes)} />
					<StatTile label={t("docs.stat.lines")} value={docs.totals.lines} />
				</div>

				{/* 窄面板：列表吃 38% 高度；宽面板：三列，中间那条是拖拽把手。 */}
				<div
					style={{ "--docs-list": `${listWidth}px` } as Record<string, string>}
					className={`fb-fill grid min-h-0 gap-2.5 ${
						showList
							? "grid-rows-[minmax(0,38%)_minmax(0,1fr)] @min-[900px]:grid-cols-[var(--docs-list)_5px_minmax(0,1fr)] @min-[900px]:grid-rows-[minmax(0,1fr)] @min-[900px]:gap-0"
							: ""
					}`}
				>
					<div data-testid="docs-list" className={`min-h-0 min-w-0 flex-col gap-2.5 ${showList ? "flex" : "hidden"}`}>
						<div className="flex shrink-0 flex-col gap-1.5">
							<input
								value={docs.query}
								onChange={event => docs.setQuery(event.target.value)}
								placeholder={t("docs.search.placeholder")}
								className="w-full rounded-md border border-line-subtle bg-surface px-2 py-1 text-[11.5px] text-text outline-none placeholder:text-text-4 focus:border-line-strong"
							/>
							<div className="flex items-center justify-between gap-2">
								<FilterChips items={MODES.map(mode => ({ id: mode, label: t(`docs.search.${mode}`) }))} value={docs.mode} onChange={mode => docs.setMode(mode)} />
								<span className="font-mono text-[10px] text-text-4">{listing ? listing.length : ""}</span>
							</div>
							{/* 五类语料要能直接跳转：搜索栏解决「已知名字」，分组解决「不知道叫什么」。 */}
							<div className="flex items-center gap-1 overflow-x-auto pb-0.5">
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
										// 换了语料组，上一组的子目录就没有意义了。
										setTopic(null);
									}}
								/>
							</div>
							{/* 二级：子目录。只在多于一页时出现，否则它是占地方的一行。 */}
							{subdirCounts.length > 1 ? (
								<div className="flex items-center gap-1 overflow-x-auto pb-0.5">
									<FilterChips
										items={[
											{ id: "all", label: t("docs.topic.all"), count: subdirCounts.reduce((sum, item) => sum + item[1], 0) },
											...subdirCounts.map(([id, count]) => ({ id, label: id, count })),
										]}
										value={topic ?? "all"}
										onChange={next => setTopic(next === "all" ? null : next)}
									/>
								</div>
							) : null}
						</div>

						<Card
							title={listing ? t("docs.search.results") : t("docs.nav.title")}
							actions={docs.searching ? <Spinner className="size-3" /> : undefined}
							bodyClassName="p-0"
							fill
						>
							<div className="fb-scroll fb-fill-scroll overflow-y-auto">
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
									// 索引按需读取（ADR 0009 D5）：未到达时说清楚，不要用空目录冒充「没有文档」。
									<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{t("docs.index.loading")}</div>
								) : (
									browsableGroups.map(group => (
										<div key={group.id} className="border-b border-line-subtle last:border-0">
											<div className="bg-surface-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-4">
												{t(DOC_GROUPS.find(item => item.id === group.id)?.labelKey ?? "docs.group.kb")}
											</div>
											{group.topics.map(topic => (
												<div key={`${group.id}-${topic.id}`}>
													{topic.id ? <div className="px-3 pt-1.5 pb-0.5 font-mono text-[10px] text-text-4">{topic.id}</div> : null}
													{topic.entries.map(entry => {
														const active = entry.id === docs.selected?.id;
														return (
															<button
																key={entry.id}
																data-doc-id={entry.id}
																type="button"
																onClick={() => docs.select(entry.id)}
																aria-pressed={active}
																className={`flex w-full items-center gap-2 px-3 py-1 text-left ${active ? "bg-surface-4" : "hover:bg-surface-hover"}`}
															>
																<span className="min-w-0 flex-1 truncate text-[11.5px] text-text">{entry.title}</span>
																<span className="shrink-0 font-mono text-[9.5px] text-text-4">{kilobytes(entry.bytes)}</span>
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
					</div>
					{/* 只在宽布局出现：窄布局上下堆叠，横向拖没有意义。 */}
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
							docs.selected ? (
								<>
									<button
										type="button"
										onClick={docs.showList}
										className={`inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text ${showList ? "hidden" : ""}`}
									>
										<Icon name="chevron" className="size-3 rotate-180" />
										<span>{t("docs.reader.back")}</span>
									</button>
									<span className="hidden font-mono text-[10px] text-text-4 @min-[1100px]:inline">{`${docs.selected.lines} ${t("docs.reader.lines")} · ${kilobytes(docs.selected.bytes)}`}</span>
									<button
										type="button"
										onClick={docs.copyPath}
										className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover"
									>
										<Icon name="copy" className="size-3" />
										<span className="sr-only">{t("panel.action.copy")}</span>
									</button>
								</>
							) : undefined
						}
						fill
					>
						{docs.selected ? (
							<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line-subtle px-3.5 py-1.5">
								<span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-text-3">
									{t(DOC_GROUPS.find(entry => entry.id === docs.selected?.group)?.labelKey ?? "docs.group.kb")}
								</span>
								<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-4">{docs.selected.path}</span>
								<span className="shrink-0 font-mono text-[9.5px] text-text-4">{kilobytes(docs.selected.bytes)}</span>
							</div>
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
