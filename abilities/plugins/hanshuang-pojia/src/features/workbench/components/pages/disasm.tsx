import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";
import type { DeepMode } from "../../../../domain/native/deep";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { NumberField } from "../shell/number-field";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";
import type { PageProps } from "./overview";

const MODES: DeepMode[] = ["summary", "branch", "full"];
/** 函数列表一次画多少行；候选表本身可能是几百项。 */
const MAX_LISTED = 200;

function hex(value: number): string {
	return `0x${value.toString(16)}`;
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
	const lines = result ? result.text.split("\n") : [];

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
				<div className="flex flex-col gap-2.5 p-3">
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						<StatTile label={t("disasm.stat.arch")} value={disasm.arch ?? "—"} />
						<StatTile label={t("disasm.stat.functions")} value={disasm.candidates.length} hint={disasm.indexing ? t("disasm.stat.indexing") : undefined} />
						<StatTile label={t("disasm.stat.instructions")} value={result?.instructions ?? 0} />
						<StatTile label={t("disasm.stat.blocks")} value={result?.blocks ?? 0} />
					</div>

					<Card title={t("page.disasm.list")} actions={<span className="font-mono text-[10.5px] text-text-4">{rows.length === disasm.candidates.length ? rows.length : `${rows.length}/${disasm.candidates.length}`}</span>}>
						<div className="border-b border-line-subtle px-3.5 py-2">
							<input
								value={query}
								onChange={event => setQuery(event.target.value)}
								placeholder={t("disasm.functions.filter")}
								className="w-full rounded border border-line bg-surface px-2 py-1 font-mono text-[11.5px] text-text outline-none placeholder:font-sans placeholder:text-text-4 focus:border-line-strong"
							/>
						</div>
						<div className="fb-scroll max-h-[168px] overflow-y-auto">
							{rows.length === 0 ? (
								<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{t("disasm.functions.empty")}</div>
							) : (
								rows.map(item => {
									const active = item.offset === disasm.selected;
									return (
										<button
											key={`${item.source}-${item.offset}`}
											type="button"
											onClick={() => disasm.select(item.offset)}
											aria-pressed={active}
											className={`flex w-full items-center gap-2 border-b border-line-subtle px-3.5 py-1.5 text-left last:border-0 ${
												active ? "bg-surface-4" : "hover:bg-surface-hover"
											}`}
										>
											<span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-text">{item.name ?? t("disasm.functions.unnamed")}</span>
											<span className="shrink-0 font-mono text-[10.5px] text-text-4">{hex(item.offset)}</span>
											<span className="shrink-0 rounded border border-line px-1 text-[9.5px] uppercase tracking-wide text-text-4">{t(`disasm.source.${item.source}`)}</span>
										</button>
									);
								})
							)}
						</div>
					</Card>

					<Card
						title={result ? `${result.name ?? t("disasm.functions.unnamed")} · ${hex(result.start)}` : t("disasm.output.title")}
						actions={
							<>
								<FilterChips items={MODES.map(mode => ({ id: mode, label: t(`disasm.mode.${mode}`) }))} value={disasm.mode} onChange={mode => disasm.setMode(mode)} />
								<button
									type="button"
									onClick={disasm.copy}
									disabled={!result}
									className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover disabled:opacity-50"
								>
									<Icon name="copy" className="size-3" />
									<span className="sr-only">{t("panel.action.copy")}</span>
								</button>
							</>
						}
					>
						<div className="border-b border-line-subtle">
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
							<pre className="fb-scroll max-h-[320px] overflow-auto px-3.5 py-2.5 font-mono text-[11px] leading-[1.55] text-text-2">
								{lines.map((line, index) => (
									<div key={index} className={line.startsWith(";") ? "text-text-4" : undefined}>
										{line === "" ? "\u00a0" : line}
									</div>
								))}
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
