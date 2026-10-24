import { useTranslation } from "@astravia-org/plugin-sdk";
import { Card } from "../shell/card";
import { DataTable, type DataTableRow } from "../shell/data-table";
import { PageHeader } from "../shell/page-header";
import { SamplePicker } from "../workbench/sample-picker";
import type { PageProps } from "./overview";

const FORMATS = ["apk", "ipa", "jar", "native", "dex", "other"] as const;

/** 样本页：左边选文件，右边说清楚每种格式会解析到什么。 */
export function SamplesPage({ model }: PageProps) {
	const { t } = useTranslation();
	const rows: DataTableRow[] = FORMATS.map(id => ({
		key: id,
		cells: [t(`format.${id}.name`), t(`format.${id}.detail`)],
	}));

	return (
		<>
			<PageHeader title={t("page.samples.title")} description={t("page.samples.lead")} />
			<div className="grid gap-3 p-4 @min-[880px]:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
				<Card title={t("page.samples.picker")} className="flex min-h-[320px] flex-col" bodyClassName="flex min-h-0 flex-1 flex-col pt-2">
					<SamplePicker
						cwd={model.cwd}
						files={model.files}
						loading={model.filesLoading}
						busy={model.phase === "loading"}
						selectedPath={model.selectedPath}
						onRefresh={model.refreshFiles}
						onAnalyse={model.analyse}
						onImport={files => model.importFile(files[0])}
						onHandOff={model.openHandoff}
					/>
				</Card>

				<div className="space-y-3">
					<Card title={t("page.samples.formats")} bodyClassName="px-1 py-1">
						<DataTable columns={[t("page.samples.col.format"), t("page.samples.col.parsed")]} rows={rows} mono={[true, false]} />
					</Card>
					<Card title={t("page.samples.scope")} bodyClassName="p-3.5">
						<ul className="space-y-1.5 text-[10.5px] leading-relaxed text-text-3">
							<li>· {t("page.samples.scope.project")}</li>
							<li>· {t("page.samples.scope.size")}</li>
							<li>· {t("page.samples.scope.readonly")}</li>
							<li>· {t("page.samples.scope.dex")}</li>
						</ul>
					</Card>
				</div>
			</div>
		</>
	);
}
