import { useMemo, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { rankCases } from "../../../../domain/case/library";
import { findPrecedent, rankPrecedents, SHIPPED_PRECEDENTS } from "../../../../domain/case/precedents";
import { CaseReader } from "../case-reader";
import { PrecedentReader } from "../precedent-reader";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";
import { Tag } from "../shell/tag";
import type { PageProps } from "./overview";

/** 一次列举完：榜单只做过滤与排序，不做分页。 */
const LIMIT = 200;

/**
 * 案例库：左栏是「我的案例」与「随包先例」两张单子，右栏把选中的那份读出来。
 *
 * 改造前这一页只列元数据、选中才给几行摘要，正文得自己拿编辑器去翻；现在案例的
 * scope/timeline/workitems/证据与先例的四份文档都在这页读，仍然不写盘。
 * 案例身份是路径（cases/ 与 work/ 可能同名），先例身份是 slug，两者互斥选中。
 */
export function CasesPage({ model }: PageProps) {
	const { t } = useTranslation();
	const cases = model.cases;
	const docs = model.caseDocs;
	const [query, setQuery] = useState("");
	const [slug, setSlug] = useState<string | null>(null);
	const [listOpen, setListOpen] = useState(true);

	const precedent = slug ? (findPrecedent(slug) ?? null) : null;
	const record = cases.selected;
	const reading = record !== null || precedent !== null;
	const showList = listOpen || !reading;

	const found = useMemo(() => rankCases(cases.cases, query, { limit: LIMIT }).map(hit => hit.record), [cases.cases, query]);
	const precedents = useMemo(() => rankPrecedents(query, LIMIT).map(hit => hit.precedent), [query]);

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
							className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
						>
							<Icon name="refresh" className="size-3" />
							{t("cases.refresh")}
						</button>
					</>
				}
			/>
			<div className="flex flex-col gap-2.5 p-3">
				{cases.error ? (
					<Card bodyClassName="px-3.5 py-2.5">
						<div className="flex items-start gap-2">
							<Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-risk-high" />
							<p className="text-[10.5px] leading-relaxed text-text-3">{cases.error}</p>
						</div>
					</Card>
				) : null}

				<div className="grid grid-cols-3 gap-2">
					<StatTile
						label={t("cases.stat.cases")}
						value={cases.cases.length}
						hint={t("cases.stat.casesHint")}
					/>
					<StatTile
						label={t("cases.stat.ready")}
						value={cases.readyCount}
						tone={cases.readyCount > 0 ? "low" : "default"}
						hint={t("cases.stat.readyHint")}
					/>
					<StatTile label={t("cases.stat.precedents")} value={SHIPPED_PRECEDENTS.length} hint={t("cases.stat.precedentsHint")} />
				</div>

				<input
					value={query}
					onChange={event => setQuery(event.target.value)}
					placeholder={t("cases.search.placeholder")}
					aria-label={t("cases.search.placeholder")}
					className="w-full rounded border border-line bg-surface px-2 py-1 text-[11.5px] text-text outline-none placeholder:text-text-4 focus:border-line-strong"
				/>

				{cases.truncated > 0 ? (
					<Card bodyClassName="px-3.5 py-2.5">
						<div className="flex items-start gap-2">
							<Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-risk-medium" />
							<p className="text-[10.5px] leading-relaxed text-text-3">{t("cases.truncated", { count: cases.truncated })}</p>
						</div>
					</Card>
				) : null}

				{/* 宽屏恒双栏：右侧阅读区一开始就在，不必等选中才腾出来。 */}
				<div className="grid gap-2.5 @min-[900px]:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
					<div data-testid="cases-list" className={`min-w-0 flex-col gap-2.5 ${showList ? "flex" : "hidden @min-[900px]:flex"}`}>
						<Card
							title={t("cases.list.title")}
							actions={
								<span className="font-mono text-[10px] text-text-4">
									{cases.scanning ? t("cases.scanning") : t("cases.count", { ready: cases.readyCount, total: cases.cases.length })}
								</span>
							}
							bodyClassName="px-1 py-1"
						>
							{cases.cases.length === 0 ? (
								<EmptyState icon="folderSearch" title={t("cases.empty.title")} body={t("cases.empty.body")} />
							) : found.length === 0 ? (
								<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{t("cases.search.empty")}</div>
							) : (
								<ul className="fb-scroll max-h-[300px] overflow-y-auto">
									{found.map(item => {
										const active = item.path === record?.path;
										const done = item.workItems.filter(entry => entry.status === "done").length;
										return (
											<li key={item.path}>
												<button
													type="button"
													onClick={() => openCase(item.path)}
													aria-pressed={active}
													title={item.path}
													className={`flex w-full flex-col gap-1 border-b border-line-subtle px-2.5 py-1.5 text-left last:border-0 ${active ? "bg-surface-4" : "hover:bg-surface-hover"}`}
												>
													<span className="flex w-full min-w-0 items-center gap-1.5">
														<span className="min-w-0 flex-1 truncate text-[11.5px] text-text">{item.name}</span>
														<Tag tone={item.ready ? "low" : "neutral"}>{item.ready ? t("cases.ready.yes") : t("cases.ready.no")}</Tag>
													</span>
													<span className="flex w-full min-w-0 items-center gap-1.5">
														<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-4">{item.path}</span>
														<span className="shrink-0 font-mono text-[9.5px] text-text-4">
															{t("cases.row.counts", { assets: item.inScope.length, evidence: item.evidenceCount, done, total: item.workItems.length })}
														</span>
													</span>
												</button>
											</li>
										);
									})}
								</ul>
							)}
						</Card>

						<Card
							title={t("cases.precedent.title")}
							actions={<span className="font-mono text-[10px] text-text-4">{t("cases.precedent.count", { count: SHIPPED_PRECEDENTS.length })}</span>}
							bodyClassName="px-1 py-1"
						>
							<p className="px-2.5 pb-1 pt-1.5 text-[10.5px] leading-relaxed text-text-3">{t("cases.precedent.lead")}</p>
							{precedents.length === 0 ? (
								<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{t("cases.search.empty")}</div>
							) : (
								<ul className="fb-scroll max-h-[300px] overflow-y-auto">
									{precedents.map(item => {
										const active = item.slug === precedent?.slug;
										return (
											<li key={item.slug}>
												<button
													type="button"
													onClick={() => openPrecedent(item.slug)}
													aria-pressed={active}
													title={`cases/${item.slug}/`}
													className={`flex w-full flex-col gap-1 border-b border-line-subtle px-2.5 py-1.5 text-left last:border-0 ${active ? "bg-surface-4" : "hover:bg-surface-hover"}`}
												>
													<span className="flex w-full min-w-0 items-center gap-1.5">
														<span className="min-w-0 flex-1 truncate text-[11.5px] text-text">{item.title}</span>
														<Tag tone="neutral">{item.preset}</Tag>
													</span>
													<span className="flex w-full min-w-0 items-center gap-1.5">
														<span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-4">{`cases/${item.slug}/`}</span>
														<span className="shrink-0 font-mono text-[9.5px] text-text-4">
															{t("cases.precedent.counts", { signals: item.signals.length, docs: item.docs.length })}
														</span>
													</span>
												</button>
											</li>
										);
									})}
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
									className={`inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text ${showList ? "hidden" : ""}`}
								>
									<Icon name="chevron" className="size-3 rotate-180" />
									<span>{t("cases.reader.back")}</span>
								</button>
							) : undefined
						}
						bodyClassName="pb-1"
					>
						<div data-testid="cases-reader">
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
								<EmptyState
									icon="library"
									title={t("cases.reader.empty.title")}
									body={t("cases.reader.empty.body")}
									action={
										<button
											type="button"
											onClick={() => model.go("docs")}
											className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
										>
											<Icon name="book" className="size-3" />
											{t("cases.reader.browse")}
										</button>
									}
								/>
							)}
						</div>
					</Card>
				</div>

				<Card title={t("cases.contract.title")} bodyClassName="px-3.5 py-2.5">
					<ul className="space-y-1.5">
						{["declaration", "gate", "precedent"].map(key => (
							<li key={key} className="flex items-start gap-2">
								<Icon name="check" className="mt-0.5 size-3 shrink-0 text-text-4" />
								<p className="text-[10.5px] leading-relaxed text-text-3">{t(`cases.contract.${key}`)}</p>
							</li>
						))}
					</ul>
					<p className="mt-2 text-[10px] leading-relaxed text-text-4">{t("cases.contract.next")}</p>
				</Card>
			</div>
		</>
	);
}
