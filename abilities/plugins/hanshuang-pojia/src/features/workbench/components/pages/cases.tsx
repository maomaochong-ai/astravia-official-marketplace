import { useMemo, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { rankCases } from "../../../../domain/case/library";
import { findPrecedent, rankPrecedents, SHIPPED_PRECEDENTS } from "../../../../domain/case/precedents";
import { CaseReader } from "../case-reader";
import { PrecedentReader } from "../precedent-reader";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";
import { Tag } from "../shell/tag";
import type { PageProps } from "./overview";

/** 一次列举完：榜单只做过滤与排序，不做分页。 */
const LIMIT = 200;

/** `all` 是筛选条的「全部」，不是某一份先例的分类。 */
type CategoryFilter = "all" | string;

/**
 * 案例库：左栏两张单子（随包先例 / 扫描到的案例），右栏把选中的那份读出来。
 *
 * 版面按「谁吃剩余高度」组织，而不是按内容自然高度：
 *   左栏是列（`fb-fill`），先例单子 `fill` 自己滚——19 条列表在旧版里被 `max-h-[300px]` 截住，
 *   下面留一条底色；两张单子并列时又按行高各自分走空间，于是出现「一半是空的」。
 *   右栏阅读区同样 `fill`，未选中时给一行紧凑提示，不再用整块空态撑满。
 *
 * 分类筛选读的是 `case.json` 的 `category`（经 `sync-precedents` 进生成物），
 * 不在页面里靠 slug 前缀猜——猜出来的分类没法校验，也挡不住新包漏填。
 */
export function CasesPage({ model }: PageProps) {
	const { t } = useTranslation();
	const cases = model.cases;
	const docs = model.caseDocs;
	const [query, setQuery] = useState("");
	const [slug, setSlug] = useState<string | null>(null);
	const [category, setCategory] = useState<CategoryFilter>("all");
	const [listOpen, setListOpen] = useState(true);

	const precedent = slug ? (findPrecedent(slug) ?? null) : null;
	const record = cases.selected;
	const reading = record !== null || precedent !== null;
	const showList = listOpen || !reading;

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
			<PageHeader
				title={t("page.cases.title")}
				description={t("page.cases.lead")}
				actions={
					<>
						<AiButton label={t("cases.open")} busy={model.chat.sending} onClick={() => model.ask("case-open")} />
						<button
							type="button"
							onClick={cases.refresh}
							className="flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
						>
							<Icon name="refresh" className="size-3" />
							{t("cases.refresh")}
						</button>
					</>
				}
			/>

			<div className="fb-page">
				{cases.error ? (
					<Card bodyClassName="px-3.5 py-2">
						<div className="flex items-start gap-2">
							<Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-risk-high" />
							<p className="text-[10.5px] leading-relaxed text-text-3">{cases.error}</p>
						</div>
					</Card>
				) : null}

				<div className="grid shrink-0 grid-cols-3 gap-2">
					<StatTile label={t("cases.stat.cases")} value={cases.cases.length} hint={t("cases.stat.casesHint")} />
					<StatTile
						label={t("cases.stat.evidence")}
						value={cases.evidenceCount}
						tone={cases.evidenceCount > 0 ? "low" : "default"}
						hint={t("cases.stat.evidenceHint")}
					/>
					<StatTile label={t("cases.stat.precedents")} value={SHIPPED_PRECEDENTS.length} hint={t("cases.stat.precedentsHint")} />
				</div>

				{cases.truncated > 0 ? (
					<Card bodyClassName="px-3.5 py-2">
						<div className="flex items-start gap-2">
							<Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-risk-medium" />
							<p className="text-[10.5px] leading-relaxed text-text-3">{t("cases.truncated", { count: cases.truncated })}</p>
						</div>
					</Card>
				) : null}

				{/* 宽屏恒双栏：左列两张单子，右列阅读区；两边各自吃满剩余高度。 */}
				<div
					className={`fb-fill grid min-h-0 gap-2.5 ${
						showList ? "grid-rows-[minmax(0,1fr)] @min-[980px]:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]" : ""
					}`}
				>
					<div data-testid="cases-list" className={`min-h-0 min-w-0 flex-col gap-2.5 ${showList ? "flex" : "hidden @min-[980px]:flex"}`}>
						<input
							value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder={t("cases.search.placeholder")}
							aria-label={t("cases.search.placeholder")}
							className="w-full shrink-0 rounded-md border border-line-subtle bg-surface px-2 py-1 text-[11.5px] text-text outline-none placeholder:text-text-4 focus:border-line-strong"
						/>

						<Card
							title={t("cases.precedent.title")}
							actions={<span className="font-mono text-[10px] text-text-4">{t("cases.precedent.count", { count: precedents.length })}</span>}
							bodyClassName="p-0"
							fill
							className="min-h-[240px]"
						>
							{/* 分类筛选：preset 全是 offline-sample，靠它分不出族；这一行读 case.json 的 category。 */}
							<div className="shrink-0 border-b border-line-subtle px-2 py-1.5">
								<FilterChips
									items={[
										{ id: "all", label: t("cases.category.all"), count: SHIPPED_PRECEDENTS.length },
										...categoryCounts.map(([id, count]) => ({ id, label: t(`cases.category.${id}`), count })),
									]}
									value={category}
									onChange={setCategory}
								/>
							</div>
							{precedents.length === 0 ? (
								<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{t("cases.search.empty")}</div>
							) : (
								<div className="fb-scroll fb-fill-scroll overflow-y-auto">
									{precedents.map(item => {
										const active = item.slug === precedent?.slug;
										return (
											<button
												key={item.slug}
												type="button"
												onClick={() => openPrecedent(item.slug)}
												aria-pressed={active}
												title={`cases/${item.slug}/`}
												className={`flex w-full flex-col gap-1 border-b border-line-subtle px-2.5 py-1.5 text-left last:border-0 ${
													active ? "bg-surface-4" : "hover:bg-surface-hover"
												}`}
											>
												<span className="flex w-full min-w-0 items-center gap-1.5">
													<span className="min-w-0 flex-1 truncate text-[11.5px] text-text">{item.title}</span>
													<Tag tone="neutral">{t(`cases.category.${item.category}`)}</Tag>
												</span>
												<span className="flex w-full min-w-0 items-center gap-1.5">
													<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-4">{`cases/${item.slug}/`}</span>
													<span className="shrink-0 font-mono text-[9.5px] text-text-4">
														{t("cases.precedent.counts", { signals: item.signals.length, docs: item.docs.length })}
													</span>
												</span>
											</button>
										);
									})}
								</div>
							)}
						</Card>

						<Card
							title={t("cases.list.title")}
							actions={
								<span className="font-mono text-[10px] text-text-4">
									{cases.scanning ? t("cases.scanning") : t("cases.count", { total: cases.cases.length })}
								</span>
							}
							bodyClassName="p-0"
							className="shrink-0"
						>
							{cases.cases.length === 0 ? (
								<p className="px-3 py-2 text-[10.5px] leading-relaxed text-text-4">{t("cases.empty.body")}</p>
							) : found.length === 0 ? (
								<p className="px-3 py-2 text-[10.5px] text-text-4">{t("cases.search.empty")}</p>
							) : (
								<ul className="fb-scroll max-h-[132px] overflow-y-auto">
									{found.map(item => {
										const active = item.path === record?.path;
										return (
											<li key={item.path}>
												<button
													type="button"
													onClick={() => openCase(item.path)}
													aria-pressed={active}
													title={item.path}
													className={`flex w-full min-w-0 items-center gap-1.5 border-b border-line-subtle px-2.5 py-1 text-left last:border-0 ${
														active ? "bg-surface-4" : "hover:bg-surface-hover"
													}`}
												>
													<span className="min-w-0 flex-1 truncate text-[11.5px] text-text">{item.name}</span>
													<Tag tone="neutral">{item.preset ?? t("cases.row.case")}</Tag>
													<span className="shrink-0 font-mono text-[9.5px] text-text-4">
														{t("cases.row.counts", { assets: item.inScope.length, evidence: item.evidenceCount })}
													</span>
												</button>
											</li>
										);
									})}
								</ul>
							)}
						</Card>

						<Card
							title={t("cases.mine.title")}
							actions={
								model.myCases.cases.length > 0 ? (
									<button
										type="button"
										onClick={() => model.myCases.clear()}
										className="rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
									>
										{t("cases.mine.clear")}
									</button>
								) : null
							}
							bodyClassName="px-2.5 py-2"
							className="shrink-0"
						>
							{model.myCases.cases.length === 0 ? (
								<p className="text-[10.5px] leading-relaxed text-text-4">{t("cases.mine.empty")}</p>
							) : (
								<ul className="space-y-1">
									{model.myCases.cases.slice(0, 4).map(item => (
										<li key={item.id} className="flex items-center gap-2">
											<span className="size-1.5 shrink-0 rounded-full bg-purple" />
											<span className="min-w-0 flex-1 truncate text-[11px] text-text" title={item.highlights.join(" · ") || item.format}>
												{item.name}
											</span>
											<span className="shrink-0 text-[9.5px] text-text-4">{item.grade}</span>
											<button
												type="button"
												onClick={() => model.myCases.remove(item.id)}
												className="shrink-0 text-[10px] text-text-4 transition-colors hover:text-risk-high"
											>
												{t("cases.mine.remove")}
											</button>
										</li>
									))}
								</ul>
							)}
						</Card>
					</div>

					<Card
						title={record ? record.name : precedent ? precedent.title : t("cases.reader.title")}
						actions={
							reading ? (
								<button
									type="button"
									onClick={() => setListOpen(true)}
									className={`inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text ${
										showList ? "hidden" : ""
									}`}
								>
									<Icon name="chevron" className="size-3 rotate-180" />
									<span>{t("cases.reader.back")}</span>
								</button>
							) : undefined
						}
						bodyClassName="pb-1"
						fill
					>
						<div data-testid="cases-reader" className="flex min-h-0 flex-1 flex-col">
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
										model.go("docs");
									}}
								/>
							) : (
								<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
									<Icon name="library" className="size-5 text-text-4" />
									<p className="text-[12px] font-medium text-text-2">{t("cases.reader.empty.title")}</p>
									<p className="max-w-sm text-[11px] leading-relaxed text-text-4">{t("cases.reader.empty.body")}</p>
									<button
										type="button"
										onClick={() => model.go("docs")}
										className="mt-1 inline-flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
									>
										<Icon name="book" className="size-3" />
										{t("cases.reader.browse")}
									</button>
								</div>
							)}
						</div>
					</Card>
				</div>
			</div>
		</>
	);
}
