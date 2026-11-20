/**
 * 面板「样本」页：工作区里已加入的样本与切换入口。
 *
 * 宿主拒绝读取时交给 `blocked-panel` 给替代路径，页面本身不重试、不探测文件系统。
 */

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
			{/*
			 * 左栏吃满、右栏自己滚。
			 *
			 * 这里原本是 `grid` 容器，而卡片靠 `fill`（= `flex: 1 1 auto`）撑高 ——
			 * flex 属性在 grid 里不生效，于是左栏高度等于内容高度：文件一多，
			 * 选择器的滚动区没有上限，把「解析范围」与「边界」两张卡推到很远，
			 * 窄面板（< 880px，也就是大多数时候）下基本看不到。
			 * 换成 flex：宽屏横排、窄屏竖排，两者都能拿到有界高度。
			 */}
			<div className="fb-page fb-fill @min-[880px]:flex-row">
				<Card
					title={t("page.samples.picker")}
					className="min-h-[180px] max-h-[46vh] @min-[880px]:max-h-none @min-[880px]:w-[260px] @min-[880px]:shrink-0"
					bodyClassName="flex min-h-0 flex-1 flex-col pt-2"
				>
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

				<div className="fb-scroll flex min-h-0 flex-col gap-3 overflow-y-auto @min-[880px]:flex-1">
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
