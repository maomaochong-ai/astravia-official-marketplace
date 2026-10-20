import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatBytes } from "../../../../domain/report/report";
import { Card } from "../shell/card";
import { DataTable, type DataTableRow } from "../shell/data-table";
import { EmptyState } from "../shell/empty-state";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { Tag } from "../shell/tag";
import type { PageProps } from "./overview";

function when(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/** 报告库：本次会话里分析过的样本摘要；存储可用时跨会话保留。 */
export function ReportsPage({ model }: PageProps) {
	const { t } = useTranslation();

	const rows: DataTableRow[] = model.entries.map(entry => ({
		key: entry.id,
		cells: [
			<button
				key="open"
				type="button"
				onClick={() => model.openEntry(entry.id)}
				className="max-w-full truncate text-left text-[11.5px] text-text transition-colors hover:text-purple"
				title={entry.path}
			>
				{entry.name}
			</button>,
			<Tag key="format" tone="neutral">
				{entry.format.toUpperCase()}
			</Tag>,
			<span key="score" className="font-mono text-[11px]">
				{entry.score} · {entry.grade}
			</span>,
			<span key="when" className="font-mono text-[10px] text-text-4">
				{when(entry.analysedAt)}
			</span>,
		],
	}));

	return (
		<>
			<PageHeader
				title={t("page.reports.title")}
				description={t("page.reports.lead")}
				actions={
					<>
						<button
							type="button"
							onClick={() => model.copyReport("markdown")}
							disabled={!model.report}
							className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
						>
							<Icon name="copy" className="size-3" />
							{t("reports.copy")}
						</button>
						<button
							type="button"
							onClick={() => model.exportReport("markdown")}
							disabled={!model.report}
							className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
						>
							<Icon name="save" className="size-3" />
							{t("reports.export")}
						</button>
					</>
				}
			/>
			<div className="space-y-3 p-4">
				<Card
					title={t("reports.library")}
					actions={
						model.entries.length > 0 ? (
							<button
								type="button"
								onClick={model.clearLibrary}
								className="rounded px-1.5 py-0.5 text-[10.5px] text-text-4 transition-colors hover:bg-surface-hover hover:text-risk-high"
							>
								{t("reports.clear")}
							</button>
						) : null
					}
					bodyClassName="px-1 py-1"
				>
					{model.entries.length === 0 ? (
						<EmptyState icon="file" title={t("reports.empty.title")} body={t("reports.empty.body")} />
					) : (
						<DataTable
							columns={[t("reports.col.name"), t("reports.col.format"), t("reports.col.score"), t("reports.col.when")]}
							rows={rows}
							mono={[false, false, true, true]}
						/>
					)}
				</Card>

				<Card title={t("reports.storage")} bodyClassName="p-3.5">
					<div className="flex items-start gap-2">
						<Icon name={model.persisted ? "check" : "alert"} className={`mt-0.5 size-3.5 shrink-0 ${model.persisted ? "text-risk-low" : "text-risk-medium"}`} />
						<p className="text-[10.5px] leading-relaxed text-text-3">{model.persisted ? t("reports.storage.on") : t("reports.storage.off")}</p>
					</div>
					<p className="mt-1.5 text-[10px] leading-relaxed text-text-4">{t("reports.storage.body")}</p>
				</Card>

				{model.report ? (
					<Card title={t("reports.current")} bodyClassName="px-3.5 py-2.5">
						<div className="flex min-w-0 items-center gap-2">
							<span className="truncate font-mono text-[11px] text-text-2">{model.report.target.name}</span>
							<Tag>{formatBytes(model.report.target.size)}</Tag>
							<Tag tone={model.report.mode === "full" ? "purple" : "neutral"}>{t(`mode.${model.report.mode}`)}</Tag>
						</div>
						<div className="mt-2 flex flex-wrap gap-1.5">
							<button
								type="button"
								onClick={() => model.exportReport("json")}
								className="rounded border border-line px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
							>
								{t("reports.exportJson")}
							</button>
							<button
								type="button"
								onClick={() => model.exportReport("markdown")}
								className="rounded border border-line px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
							>
								{t("reports.exportMarkdown")}
							</button>
						</div>
					</Card>
				) : null}
			</div>
		</>
	);
}
