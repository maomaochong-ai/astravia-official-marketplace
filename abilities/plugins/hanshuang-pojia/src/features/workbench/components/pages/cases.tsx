import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CaseRecord } from "../../../../domain/case/library";
import { PrecedentTable } from "../precedent-table";
import { Card } from "../shell/card";
import { DataTable, type DataTableRow } from "../shell/data-table";
import { EmptyState } from "../shell/empty-state";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { Tag } from "../shell/tag";
import type { PageProps } from "./overview";

function when(epoch: number | undefined): string {
	if (!epoch) return "—";
	const date = new Date(epoch);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleDateString();
}

/** 只读的战例索引：这一页解释「哪个案例可复现、哪个还不能动」，不改任何文件。 */
export function CasesPage({ model }: PageProps) {
	const { t } = useTranslation();
	const cases = model.cases;
	const selected = model.cases.selected;

	const rows: DataTableRow[] = cases.cases.map(record => ({
		key: record.path,
		cells: [
			<button
				key="open"
				type="button"
				onClick={() => cases.select(record.path === selected?.path ? null : record.path)}
				className="max-w-full truncate text-left text-[11.5px] text-text transition-colors hover:text-purple"
				title={record.path}
			>
				{record.name}
			</button>,
			<Tag key="preset" tone="neutral">
				{record.preset ?? "—"}
			</Tag>,
			<Tag key="auth" tone={record.authStatus === "granted" ? "low" : "medium"}>
				{record.authStatus ?? "pending"}
			</Tag>,
			<Tag key="ready" tone={record.ready ? "low" : "neutral"}>
				{record.ready ? t("cases.ready.yes") : t("cases.ready.no")}
			</Tag>,
			<span key="scope" className="font-mono text-[11px]">
				{record.inScope.length}
			</span>,
			<span key="evidence" className="font-mono text-[11px]">
				{record.evidenceCount}
			</span>,
			<span key="items" className="font-mono text-[11px]">
				{record.workItems.filter(item => item.status === "done").length}/{record.workItems.length}
			</span>,
			<span key="when" className="font-mono text-[10px] text-text-4">
				{when(record.updatedAt)}
			</span>,
		],
	}));

	return (
		<>
			<PageHeader
				title={t("page.cases.title")}
				description={t("page.cases.lead")}
				actions={
					<button
						type="button"
						onClick={cases.refresh}
						className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="refresh" className="size-3" />
						{t("cases.refresh")}
					</button>
				}
			/>
			<div className="space-y-3 p-4">
				{cases.error ? (
					<Card bodyClassName="px-3.5 py-2.5">
						<div className="flex items-start gap-2">
							<Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-risk-high" />
							<p className="text-[10.5px] leading-relaxed text-text-3">{cases.error}</p>
						</div>
					</Card>
				) : null}

				<Card
					title={t("cases.index")}
					actions={
						<span className="font-mono text-[10px] text-text-4">
							{cases.scanning ? t("cases.scanning") : t("cases.count", { ready: cases.readyCount, total: cases.cases.length })}
						</span>
					}
					bodyClassName="px-1 py-1"
				>
					{cases.cases.length === 0 ? (
						<EmptyState icon="folderSearch" title={t("cases.empty.title")} body={t("cases.empty.body")} />
					) : (
						<DataTable
							columns={[
								t("cases.col.name"),
								t("cases.col.preset"),
								t("cases.col.auth"),
								t("cases.col.ready"),
								t("cases.col.scope"),
								t("cases.col.evidence"),
								t("cases.col.items"),
								t("cases.col.when"),
							]}
							rows={rows}
							mono={[false, false, false, false, true, true, true, true]}
						/>
					)}
				</Card>

				{cases.truncated > 0 ? (
					<Card bodyClassName="px-3.5 py-2.5">
						<div className="flex items-start gap-2">
							<Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-risk-medium" />
							<p className="text-[10.5px] leading-relaxed text-text-3">{t("cases.truncated", { count: cases.truncated })}</p>
						</div>
					</Card>
				) : null}

				<PrecedentTable />

				{selected ? <CaseDetail record={selected} /> : null}

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

function CaseDetail({ record }: { record: CaseRecord }) {
	const { t } = useTranslation();
	const done = record.workItems.filter(item => item.status === "done").length;
	return (
		<Card title={t("cases.detail.title", { name: record.name })} bodyClassName="px-3.5 py-2.5">
			<div className="flex min-w-0 flex-wrap items-center gap-1.5">
				<span className="truncate font-mono text-[10.5px] text-text-4">{record.path}</span>
				{record.networkProfile ? <Tag tone="neutral">{record.networkProfile}</Tag> : null}
				<Tag tone={record.notes.implemented > 0 ? "purple" : "neutral"}>
					{t("cases.detail.notes", { kept: record.notes.implemented, dropped: record.notes.rejected })}
				</Tag>
				<Tag tone="neutral">{t("cases.detail.items", { done, total: record.workItems.length })}</Tag>
			</div>

			{record.blockers.length > 0 ? (
				<div className="mt-2.5">
					<p className="text-[10px] font-medium uppercase tracking-wider text-text-4">{t("cases.detail.blockers")}</p>
					<ul className="mt-1 space-y-1">
						{record.blockers.map(blocker => (
							<li key={blocker} className="flex items-start gap-1.5">
								<Icon name="ban" className="mt-0.5 size-3 shrink-0 text-risk-medium" />
								<span className="text-[10.5px] leading-relaxed text-text-3">{blocker}</span>
							</li>
						))}
					</ul>
				</div>
			) : null}

			<div className="mt-2.5 grid gap-2.5 @min-[560px]:grid-cols-2">
				<List title={t("cases.detail.inScope")} items={record.inScope} />
				<List title={t("cases.detail.deliverables")} items={record.deliverables} />
			</div>

			<p className="mt-2.5 text-[10px] leading-relaxed text-text-4">{t("cases.detail.read", { path: record.path })}</p>
		</Card>
	);
}

function List({ title, items }: { title: string; items: readonly string[] }) {
	const { t } = useTranslation();
	return (
		<div className="min-w-0">
			<p className="text-[10px] font-medium uppercase tracking-wider text-text-4">{title}</p>
			{items.length === 0 ? (
				<p className="mt-1 text-[10.5px] text-text-4">{t("cases.detail.empty")}</p>
			) : (
				<ul className="mt-1 space-y-0.5">
					{items.map(item => (
						<li key={item} className="truncate font-mono text-[10.5px] text-text-3" title={item}>
							{item}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
