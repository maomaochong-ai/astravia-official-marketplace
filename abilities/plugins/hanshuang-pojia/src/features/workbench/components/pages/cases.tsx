import { useMemo, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { rankCases } from "../../../../domain/case/library";
import { findPrecedent, rankPrecedents, SHIPPED_PRECEDENTS } from "../../../../domain/case/precedents";
import { CaseReader } from "../case-reader";
import { PrecedentReader } from "../precedent-reader";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { FilterMenu } from "../shell/filter-menu";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { SegmentedControl } from "../shell/segmented-control";
import { Tag } from "../shell/tag";
import type { PageProps } from "./overview";

/** 一次列举完：榜单只做过滤与排序，不做分页。 */
const LIMIT = 200;

type Source = "precedent" | "mine";

/**
 * 案例库：一页两栏，左栏用 **分段选项** 在「随包先例 / 我的案例」之间切，右栏读正文。
 *
 * 之前左栏是三张卡竖着堆（先例 + 已扫描案例 + 我的案例），再各自加搜索与分类，
 * 面板一矮就互相压住、chip 与文字叠在一起。现在：
 *   · 搜索与分类提到页面级的**横向工具栏**（与文档页同一套），不再住在列表里；
 *   · 左栏只剩一张卡，卡头一个分段控件决定列哪一份清单 —— 一次只显示一种，不会堆叠；
 *   · 两份清单都吃满剩余高度、自己滚，不再用 `max-h-[132px]` 截断。
 */
export function CasesPage({ model, embedded = false }: PageProps & { embedded?: boolean }) {
	const { t } = useTranslation();
	const cases = model.cases;
	const docs = model.caseDocs;
	const [query, setQuery] = useState("");
	// 「正在读哪份先例」存 model：切视图会卸载本页，放本地 state 就会丢，
	// 而从先例跳到「战例研究」再切回案例时，那一份正是要回到的地方。
	const { slug } = model.knowledge;
	const setSlug = (next: string | null) => model.patchKnowledge({ slug: next });
	const [category, setCategory] = useState<string>("all");
	const [source, setSource] = useState<Source>("precedent");
	const [listOpen, setListOpen] = useState(false);

	const precedent = slug ? (findPrecedent(slug) ?? null) : null;
	const record = cases.selected;
	const reading = record !== null || precedent !== null;
	// 没选中东西时一定看列表；选中之后由 listOpen 决定（窄面板下列表与正文互斥）。
	// 这样重挂载时不会出现「明明选着一份先例，却只显示列表」。
	const showList = !reading || listOpen;

	const found = useMemo(() => rankCases(cases.cases, query, { limit: LIMIT }).map(hit => hit.record), [cases.cases, query]);

	// 分类计数从索引现算：19 条数据，没必要预生成一份统计表。
	const categoryCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const item of SHIPPED_PRECEDENTS) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
		return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
	}, []);

	const precedents = useMemo(() => {
		const ranked = rankPrecedents(query, LIMIT).map(hit => hit.precedent);
		return category === "all" ? ranked : ranked.filter(item => item.category === category);
	}, [query, category]);

	const openCase = (path: string) => {
		cases.select(path);
		setSlug(null);
		setListOpen(false);
	};
	const openPrecedent = (next: string) => {
		setSlug(next);
		cases.select(null);
		setListOpen(false);
	};

	return (
		<>
			{embedded ? null : (
				<PageHeader
					title={t("page.cases.title")}
					description={t("page.cases.lead")}
					actions={
						<>
							<AiButton label={t("cases.open")} busy={model.chat.sending} onClick={() => model.ask("case-open")} />
							<button
								type="button"
								onClick={cases.refresh}
								className="flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
							>
								<Icon name="refresh" className="size-3" />
								{t("cases.refresh")}
							</button>
						</>
					}
				/>
			)}

			<div className="fb-page">
				{cases.error ? (
					<div className="flex shrink-0 items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 ring-1 ring-line-subtle">
						<Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-risk-high" />
						<p className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{cases.error}</p>
					</div>
				) : null}

				{/* 页面级工具栏：搜索 + 分类（只在先例视图有意义）。 */}
				<div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-surface-2 px-3 py-2 ring-1 ring-line-subtle">
					<div className="relative min-w-[150px] flex-1">
						<Icon name="search" className="pointer-events-none absolute start-2 top-1/2 size-3 -translate-y-1/2 text-text-4" />
						<input
							value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder={t("cases.search.placeholder")}
							aria-label={t("cases.search.placeholder")}
							className="w-full rounded-md border border-line-subtle bg-surface py-1 pe-2 ps-7 text-[11.5px] text-text outline-none placeholder:text-text-4 focus:border-accent"
						/>
					</div>
					{source === "precedent" ? (
						// 与文档页同一个控件：同一栏里两套筛选形态，用户读不出它们是同一件事。
						<FilterMenu<string>
							placeholder={t("cases.filter")}
							allId="all"
							value={category}
							onChange={next => setCategory(next ?? "all")}
							items={[
								{ id: "all", label: t("cases.category.all"), count: SHIPPED_PRECEDENTS.length },
								...categoryCounts.map(([id, count]) => ({ id, label: t(`cases.category.${id}`), count })),
							]}
						/>
					) : null}
					<span className="ms-auto shrink-0 font-mono text-[10.5px] text-text-4">
						{source === "precedent" ? precedents.length : found.length}
					</span>
				</div>

				<div
					className={`fb-fill grid min-h-0 gap-2.5 grid-rows-[minmax(0,1fr)] @min-[980px]:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] ${
						showList ? "" : "@max-[979px]:grid-rows-[minmax(0,1fr)]"
					}`}
				>
					<Card bodyClassName="p-0" fill className={showList ? "" : "hidden @min-[980px]:flex"}>
						<div data-testid="cases-list" className="flex h-full min-h-0 flex-col">
							{/* 菜单式选项：一次只列一份清单，切换不改变高度。 */}
							<div className="shrink-0 border-b border-line-subtle p-2">
								<SegmentedControl<Source>
									size="sm"
									value={source}
									onValueChange={setSource}
									ariaLabel={t("page.cases.title")}
									items={[
										{ value: "precedent", label: t("cases.tab.precedent") },
										{ value: "mine", label: t("cases.tab.mine") },
									]}
								/>
							</div>

							<div className="fb-scroll fb-fill-scroll overflow-y-auto">
								{source === "precedent" ? (
									precedents.length === 0 ? (
										<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{t("cases.search.empty")}</div>
									) : (
										precedents.map(item => {
											const active = item.slug === precedent?.slug;
											return (
												<button
													key={item.slug}
													type="button"
													onClick={() => openPrecedent(item.slug)}
													aria-pressed={active}
													title={`cases/${item.slug}/`}
													className={`flex w-full items-start gap-2 border-b border-line-subtle px-2.5 py-1.5 text-left last:border-0 ${
														active ? "fb-selected" : "hover:bg-surface-hover"
													}`}
												>
												<div className="min-w-0 flex-1">
													<div className="fb-wrap text-[11.5px] text-text">{item.title}</div>
													{/* 一行副标题：slug 与两个计数并排 —— 第二条信息不该再占一行高度。 */}
													<div className="fb-wrap font-mono text-[9.5px] text-text-4">
														{`cases/${item.slug}/ · ${t("cases.precedent.counts", { signals: item.signals.length, docs: item.docs.length })}`}
													</div>
												</div>
												{active ? (
													// 标签是「选中之后才要看的信息」；19 行都挂两枚，扫读时全是噪音。
													<span className="flex shrink-0 flex-col items-end gap-0.5">
														<Tag tone="neutral">{t(`cases.category.${item.category}`)}</Tag>
														<Tag tone="neutral">{t(`cases.completeness.${item.completeness}`)}</Tag>
													</span>
												) : null}
												</button>
											);
										})
									)
								) : cases.cases.length === 0 ? (
									<div className="flex flex-col items-start gap-2 px-3 py-3">
										<p className="text-[10.5px] leading-relaxed text-text-4">{t("cases.empty.body")}</p>
										<button
											type="button"
											onClick={cases.refresh}
											className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
										>
											<Icon name="refresh" className="size-3" />
											{t("cases.refresh")}
										</button>
									</div>
								) : found.length === 0 ? (
									<p className="px-3 py-3 text-[10.5px] text-text-4">{t("cases.search.empty")}</p>
								) : (
									found.map(item => {
										const active = item.path === record?.path;
										return (
											<button
												key={item.path}
												type="button"
												onClick={() => openCase(item.path)}
												aria-pressed={active}
												title={item.path}
												className={`flex w-full items-center gap-2 border-b border-line-subtle px-2.5 py-1.5 text-left last:border-0 ${
													active ? "fb-selected" : "hover:bg-surface-hover"
												}`}
											>
												<span className="min-w-0 flex-1 fb-wrap text-[11.5px] text-text">{item.name}</span>
												<span className="shrink-0 font-mono text-[9.5px] text-text-4">
													{t("cases.row.counts", { assets: item.inScope.length, evidence: item.evidenceCount })}
												</span>
											</button>
										);
									})
								)}
							</div>

							{/* 扫描状态是脚注，不占一整张卡。 */}
							<div className="flex shrink-0 items-center gap-1.5 border-t border-line-subtle px-3 py-1.5 text-[10.5px] text-text-4">
								<Icon name={cases.scanning ? "refresh" : "check"} className={`size-3 shrink-0 ${cases.scanning ? "animate-spin" : ""}`} />
								<span className="min-w-0 flex-1 fb-wrap">
									{cases.scanning ? t("cases.scanning") : t("cases.count", { total: cases.cases.length })}
								</span>
								{cases.truncated > 0 ? <span className="shrink-0 text-risk-medium">{t("cases.truncated", { count: cases.truncated })}</span> : null}
							</div>
						</div>
					</Card>

					<Card
						title={record ? record.name : precedent ? precedent.title : t("cases.reader.title")}
						actions={
							reading ? (
								<button
									type="button"
									onClick={() => {
										cases.select(null);
										setSlug(null);
										setListOpen(true);
									}}
									className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text @min-[980px]:hidden"
								>
									<Icon name="chevron" className="size-3 rotate-180" />
									<span>{t("cases.reader.back")}</span>
								</button>
							) : undefined
						}
						bodyClassName="p-0"
						fill
					>
						<div data-testid="cases-reader" className="flex h-full min-h-0 flex-col overflow-y-auto">
							{record ? (
								<CaseReader record={record} docs={docs} />
							) : precedent ? (
								<PrecedentReader
									key={precedent.slug}
									precedent={precedent}
									busy={model.chat.sending}
									onScaffold={() => model.ask("case-open", { other: precedent.slug })}
									onOpenStudy={id => {
										model.docs.select(id);
										model.go("knowledge");
									}}
								/>
							) : (
								<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
									<Icon name="library" className="size-5 text-text-4" />
									<p className="text-[12px] font-medium text-text-2">{t("cases.reader.empty.title")}</p>
									<p className="max-w-sm text-[11.5px] leading-relaxed text-text-4">{t("cases.reader.empty.body")}</p>
								</div>
							)}
						</div>
					</Card>
				</div>
			</div>
		</>
	);
}
