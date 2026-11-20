import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";
import type { DeepMode } from "../../../../domain/native/deep";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { NumberField } from "../shell/number-field";
import { Spinner } from "../shell/spinner";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";
import type { PageProps } from "./overview";

const MODES: DeepMode[] = ["summary", "branch", "full"];
/** 函数列表一次画多少行；候选表本身可能是几百项。 */
const MAX_LISTED = 200;

/**
 * 正文一次画多少行。
 *
 * 预算是 500–60000 条指令：全量塞进 DOM 时，一次 6 万条的分支视图会让面板卡到无法滚动
 * （每个 div 都要参与布局）。渲染截断，但**复制与交给对话用的仍是全文** ——
 * 截断只影响「屏幕上画多少」，不影响读者能拿走什么。
 */
const MAX_RENDERED_LINES = 800;

/**
 * 偏移。补齐到 8 位：不补时 0x100 与 0x10000 混排，列宽跳动会让读者误以为量级不同。
 */
function hex(value: number): string {
	return `0x${value.toString(16).padStart(8, "0")}`;
}

/**
 * 深层反汇编页：函数列表 → 三档视图 → 交给 AI。
 *
 * 与 strings / entropy 一样全部在渲染进程算，走的是本插件自己的解码器与 CFG，
 * 不依赖外部反汇编器，面板在没有工具链的机器上也能用。
 */
export function DisasmPage({ model }: PageProps) {
	const { t } = useTranslation();
	const { disasm, chat } = model;
	const [query, setQuery] = useState("");

	const rows = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const visible = needle ? disasm.candidates.filter(item => (item.name ?? "").toLowerCase().includes(needle) || hex(item.offset).includes(needle)) : disasm.candidates;
		return visible.slice(0, MAX_LISTED);
	}, [disasm.candidates, query]);

	const result = disasm.result;
	// 只在结果变化时才切分：这个字符串可能上兆字节。
	const lines = useMemo(() => (result ? result.text.split("\n") : []), [result]);
	const rendered = lines.length > MAX_RENDERED_LINES ? lines.slice(0, MAX_RENDERED_LINES) : lines;

	return (
		<>
			<PageHeader
				title={t("page.disasm.title")}
				description={t("page.disasm.lead")}
				actions={
					<AiButton
						label={t("ai.disasm")}
						busy={chat.sending}
						disabled={!result}
						onClick={() =>
							model.ask("disasm", {
								// 把页面上正在看的函数与档位一并交给 Agent，免得它从零猜要看哪里。
								other: result ? `${hex(result.start)} · ${result.mode} · ${result.instructions} instructions · ${result.blocks} blocks` : undefined,
							})
						}
					/>
				}
			/>

			{disasm.unsupported ? (
				<EmptyState
					icon="code"
					title={t(`disasm.unsupported.${disasm.unsupported}.title`)}
					body={t(`disasm.unsupported.${disasm.unsupported}.body`)}
				/>
			) : (
				<div className="fb-page">
					<div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
						<StatTile label={t("disasm.stat.arch")} value={disasm.arch ?? "—"} />
						<StatTile label={t("disasm.stat.functions")} value={disasm.candidates.length} hint={disasm.indexing ? t("disasm.stat.indexing") : undefined} />
						<StatTile label={t("disasm.stat.instructions")} value={result?.instructions ?? 0} />
						<StatTile label={t("disasm.stat.blocks")} value={result?.blocks ?? 0} />
					</div>

					<Card
					title={t("page.disasm.list")}
					actions={
						<span className="font-mono text-[10.5px] text-text-4">
							{rows.length === disasm.candidates.length
								? rows.length
								: t("disasm.list.count", { shown: rows.length, total: disasm.candidates.length })}
						</span>
					}
				>
						<div className="border-b border-line-subtle px-3.5 py-2">
							<input
								value={query}
								onChange={event => setQuery(event.target.value)}
								placeholder={t("disasm.functions.filter")}
								aria-label={t("disasm.functions.filter")}
								className="w-full rounded border border-line-subtle bg-surface px-2 py-1 font-mono text-[11.5px] text-text outline-none placeholder:font-sans placeholder:text-text-4 focus:border-line-strong"
							/>
						</div>
						<div className="fb-scroll max-h-[var(--fb-h-sm)] overflow-y-auto">
							{rows.length === 0 ? (
								<div className="flex items-center justify-center gap-2 px-3.5 py-6 text-center text-[11.5px] text-text-4">
									{/* 索引中与「真的没有」是两件事：把「慢」显示成「没有」会让人以为工具坏了。 */}
									{disasm.indexing ? (
										<>
											<Spinner className="size-3" />
											{t("disasm.stat.indexing")}
										</>
									) : (
										t("disasm.functions.empty")
									)}
								</div>
							) : (
								rows.map(item => {
									const active = item.offset === disasm.selected;
									return (
										<button
											key={`${item.source}-${item.offset}`}
											type="button"
											onClick={() => disasm.select(item.offset)}
											aria-current={active ? "true" : undefined}
											className={`flex w-full items-center gap-2 border-b border-line-subtle px-3.5 py-1.5 text-left last:border-0 ${
												active ? "fb-selected" : "hover:bg-surface-hover"
											}`}
										>
											<span className="min-w-0 flex-1 fb-wrap font-mono text-[11.5px] text-text">{item.name ?? t("disasm.functions.unnamed")}</span>
											<span className="shrink-0 font-mono text-[10.5px] text-text-4">{hex(item.offset)}</span>
											<span className="shrink-0 rounded border border-line-subtle px-1 text-[9.5px] uppercase tracking-wide text-text-4">{t(`disasm.source.${item.source}`)}</span>
										</button>
									);
								})
							)}
						</div>
					</Card>
					<Card
						fill
						bodyClassName="flex min-h-0 flex-1 flex-col"
						title={result ? `${result.name ?? t("disasm.functions.unnamed")} · ${hex(result.start)}` : t("disasm.output.title")}
						actions={
							<>
								<FilterChips items={MODES.map(mode => ({ id: mode, label: t(`disasm.mode.${mode}`) }))} value={disasm.mode} onChange={mode => disasm.setMode(mode)} />
								<button
									type="button"
									onClick={disasm.copy}
									title={t("panel.action.copy")}
									aria-label={t("panel.action.copy")}
									disabled={!result}
									className="inline-flex items-center gap-1 rounded border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover disabled:opacity-50"
								>
									<Icon name="copy" className="size-3" />
									<span className="sr-only">{t("panel.action.copy")}</span>
								</button>
							</>
						}
					>
						<div className="shrink-0 border-b border-line-subtle">
							<NumberField
								label={t("disasm.budget.label")}
								hint={t("disasm.budget.hint")}
								value={disasm.budget}
								min={500}
								max={60_000}
								step={500}
								onChange={disasm.setBudget}
							/>
						</div>
						{result ? (
							<pre className="fb-scroll fb-fill-scroll min-h-0 overflow-auto px-3.5 py-2.5 font-mono text-[11.5px] leading-[1.55] text-text-2">
								{rendered.map((line, index) => (
									<div key={index} className={line.startsWith(";") ? "text-text-4" : undefined}>
										{line === "" ? "\u00a0" : line}
									</div>
								))}
								{lines.length > MAX_RENDERED_LINES ? (
									<div className="mt-2 border-t border-line-subtle pt-2 text-text-4">
										{t("disasm.output.truncated", { shown: MAX_RENDERED_LINES, total: lines.length })}
									</div>
								) : null}
							</pre>
						) : (
							<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{t("disasm.output.empty")}</div>
						)}
					</Card>
				</div>
			)}
		</>
	);
}
