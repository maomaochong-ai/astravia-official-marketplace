import { useTranslation } from "@astravia-org/plugin-sdk";
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
 */
export function DocsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const { docs, chat } = model;
	const listing = docs.hits;

	return (
		<>
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

			<div className="flex flex-col gap-2.5 p-3">
				<div className="grid grid-cols-3 gap-2">
					<StatTile label={t("docs.stat.documents")} value={docs.totals.documents} />
					<StatTile label={t("docs.stat.volume")} value={kilobytes(docs.totals.bytes)} />
					<StatTile label={t("docs.stat.lines")} value={docs.totals.lines} />
				</div>

				<div className="grid gap-2.5 @min-[900px]:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
					<div className="flex min-w-0 flex-col gap-2.5">
						<div className="flex flex-col gap-1.5">
							<input
								value={docs.query}
								onChange={event => docs.setQuery(event.target.value)}
								placeholder={t("docs.search.placeholder")}
								className="w-full rounded border border-line bg-surface px-2 py-1 text-[11.5px] text-text outline-none placeholder:text-text-4 focus:border-line-strong"
							/>
							<div className="flex items-center justify-between gap-2">
								<FilterChips items={MODES.map(mode => ({ id: mode, label: t(`docs.search.${mode}`) }))} value={docs.mode} onChange={mode => docs.setMode(mode)} />
								<span className="font-mono text-[10px] text-text-4">{listing ? listing.length : ""}</span>
							</div>
						</div>

						<Card
							title={listing ? t("docs.search.results") : t("docs.nav.title")}
							actions={docs.searching ? <Spinner className="size-3" /> : undefined}
							bodyClassName="p-0"
						>
							<div className="fb-scroll max-h-[520px] overflow-y-auto">
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
													className={`flex w-full flex-col gap-0.5 border-b border-line-subtle px-3 py-1.5 text-left last:border-0 ${active ? "bg-surface-4" : "hover:bg-surface-hover"}`}
												>
													<span className="w-full truncate text-[11.5px] text-text">{hit.entry.title}</span>
													<span className="w-full truncate font-mono text-[10px] text-text-4">{hit.entry.id}</span>
													{hit.snippet ? <span className="line-clamp-2 w-full text-[10.5px] leading-snug text-text-3">{hit.snippet}</span> : null}
												</button>
											);
										})
									)
								) : (
									docs.groups.map(group => (
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

					<Card
						title={docs.selected ? docs.selected.title : t("docs.reader.title")}
						actions={
							docs.selected ? (
								<>
									<span className="hidden font-mono text-[10px] text-text-4 @min-[1100px]:inline">{`${docs.selected.lines} ${t("docs.reader.lines")} · ${kilobytes(docs.selected.bytes)}`}</span>
									<button
										type="button"
										onClick={docs.copyPath}
										className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover"
									>
										<Icon name="copy" className="size-3" />
										<span className="sr-only">{t("panel.action.copy")}</span>
									</button>
								</>
							) : undefined
						}
					>
						{docs.selected ? (
							<div className="border-b border-line-subtle px-3.5 py-1.5 font-mono text-[10px] text-text-4">{docs.selected.path}</div>
						) : null}

						{docs.error ? (
							<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{docs.error}</div>
						) : docs.loading ? (
							<div className="flex items-center justify-center gap-2 px-3.5 py-10 text-[11.5px] text-text-4">
								<Spinner className="size-3" />
								{t("docs.reader.loading")}
							</div>
						) : docs.selected && docs.body !== null ? (
							<div className="fb-scroll max-h-[620px] overflow-y-auto px-3.5 py-3">
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
