import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo } from "react";
import { permissionLevel } from "../../../../domain/android/permission-risk";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { DataTable, type DataTableRow } from "../shell/data-table";
import { EmptyState } from "../shell/empty-state";
import { PageHeader } from "../shell/page-header";
import { Tag, type TagTone } from "../shell/tag";
import { sectionRows } from "../../sections";
import type { PageProps } from "./overview";

const LEVEL_TONE: Record<ReturnType<typeof permissionLevel>, TagTone> = {
	dangerous: "high",
	special: "medium",
	normal: "neutral",
	custom: "low",
};

/** 清单页：权限按运行时风险分级，组件标出对外暴露的那些。 */
export function ManifestPage({ model }: PageProps) {
	const { t } = useTranslation();
	const report = model.report;
	const busy = model.chat.sending;

	const permissions = useMemo(() => sectionRows(report, "permissions"), [report]);
	const components = useMemo(() => sectionRows(report, "components"), [report]);

	if (!report) {
		return (
			<>
				<PageHeader title={t("page.manifest.title")} description={t("page.manifest.lead")} />
				<EmptyState icon="clipboard" title={t("empty.noReport.title")} body={t("empty.noReport.body")} />
			</>
		);
	}

	const permissionRows: DataTableRow[] = permissions.map(row => {
		const level = permissionLevel(row.label);
		return {
			key: row.label,
			cells: [row.label, <Tag key="level" tone={LEVEL_TONE[level]}>{t(`permission.${level}`)}</Tag>, row.value],
		};
	});

	const componentRows: DataTableRow[] = components.map(row => {
		const exported = row.value.includes("exported");
		return {
			key: row.label,
			cells: [row.label, <Tag key="exposure" tone={exported ? "medium" : "neutral"}>{exported ? t("manifest.exported") : t("manifest.internal")}</Tag>, row.value],
		};
	});

	return (
		<>
			<PageHeader
				title={t("page.manifest.title")}
				description={t("page.manifest.lead")}
				actions={
					<>
						<AiButton label={t("ai.permissions")} onClick={() => model.ask("permissions")} busy={busy} />
						<button
							type="button"
							onClick={() => model.exportReport("markdown")}
							className="rounded border border-line px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
						>
							{t("manifest.export")}
						</button>
					</>
				}
			/>
			<div className="space-y-3 p-4">
				<Card title={t("manifest.permissions")} bodyClassName="px-1 py-1">
					<DataTable
						columns={[t("manifest.col.permission"), t("manifest.col.level"), t("manifest.col.note")]}
						rows={permissionRows}
						mono={[true, false, false]}
						empty={t("manifest.noPermissions")}
					/>
				</Card>

				<Card title={t("manifest.components")} bodyClassName="px-1 py-1">
					<DataTable
						columns={[t("manifest.col.component"), t("manifest.col.exposure"), t("manifest.col.detail")]}
						rows={componentRows}
						mono={[true, false, false]}
						empty={t("manifest.noComponents")}
					/>
				</Card>

				<Card title={t("manifest.notes")} bodyClassName="p-3.5">
					<ul className="space-y-1.5 text-[10.5px] leading-relaxed text-text-3">
						<li>
							{t("manifest.note.axml")}
						</li>
						{report.limits.map(limit => (
							<li key={limit} className="text-text-4">
								· {limit}
							</li>
						))}
					</ul>
				</Card>
			</div>
		</>
	);
}
