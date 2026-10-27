import { useTranslation } from "@astravia-org/plugin-sdk";
import { SHIPPED_PRECEDENTS } from "../../../domain/case/precedents";
import { Card } from "./shell/card";
import { DataTable, type DataTableRow } from "./shell/data-table";
import { Tag } from "./shell/tag";

/**
 * 随包先例的只读列表。
 *
 * 先例不是本项目里的案例：它们的 scope 一律 pending，所以这里只展示「从哪个预设起手」，
 * 不给「可开工」的错觉，也不提供任何写操作。
 */
export function PrecedentTable() {
	const { t } = useTranslation();

	const rows: DataTableRow[] = SHIPPED_PRECEDENTS.map(precedent => ({
		key: precedent.slug,
		cells: [
			<div key="title" className="min-w-0">
				<p className="truncate text-[11.5px] text-text" title={precedent.summary}>
					{precedent.title}
				</p>
				<p className="truncate font-mono text-[10px] text-text-4">cases/{precedent.slug}/</p>
			</div>,
			<Tag key="preset" tone="neutral">
				{precedent.preset}
			</Tag>,
			<span key="signals" className="text-[10.5px] text-text-3" title={precedent.signals.join(", ")}>
				{precedent.signals.slice(0, 3).join(" · ")}
				{precedent.signals.length > 3 ? ` +${precedent.signals.length - 3}` : ""}
			</span>,
			<Tag key="docs" tone="neutral">
				{precedent.docs.length}
			</Tag>,
			<Tag key="scope" tone="medium">
				{t("cases.precedent.pending")}
			</Tag>,
		],
	}));

	return (
		<Card
			title={t("cases.precedent.title")}
			actions={
				<span className="font-mono text-[10px] text-text-4">
					{t("cases.precedent.count", { count: SHIPPED_PRECEDENTS.length })}
				</span>
			}
			bodyClassName="px-1 py-1"
		>
			<p className="px-3.5 pb-1 pt-2 text-[10.5px] leading-relaxed text-text-3">{t("cases.precedent.lead")}</p>
			<DataTable
				columns={[
					t("cases.precedent.col.title"),
					t("cases.precedent.col.preset"),
					t("cases.precedent.col.signals"),
					t("cases.precedent.col.docs"),
					t("cases.col.ready"),
				]}
				rows={rows}
				mono={[false, true, false, true, false]}
			/>
		</Card>
	);
}
