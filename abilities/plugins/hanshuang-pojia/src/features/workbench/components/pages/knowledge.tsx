import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { PageHeader } from "../shell/page-header";
import { SegmentedControl } from "../shell/segmented-control";
import { CasesPage } from "./cases";
import { DocsPage } from "./docs";
import type { PageProps } from "./overview";

type View = "docs" | "cases";

/**
 * 知识：文档与案例库同屏切换。
 *
 * 两者在内容上是一件事的两面——一套语料（345 篇文档）与从它派生出的先例包（19 个），
 * 读的人常常在两处来回跳：先看方法，再找打过这类目标的先例。分成两个侧栏入口时，
 * 每次跳都要重新定位一次列表；合到一页用分段控件切换，选中的文档/先例在切换后仍然保留。
 *
 * 子页面自己带标题栏，这里传 `embedded` 让它只留内容；过滤、搜索、拖拽列宽的逻辑一行未改。
 */
export function KnowledgePage({ model }: PageProps) {
	const { t } = useTranslation();
	const [view, setView] = useState<View>("docs");

	return (
		<>
			<PageHeader
				title={t("page.knowledge.title")}
				description={t("page.knowledge.lead")}
				actions={
					<SegmentedControl<View>
						value={view}
						onValueChange={setView}
						ariaLabel={t("page.knowledge.title")}
						items={[
							{ value: "docs", label: t("page.knowledge.docs") },
							{ value: "cases", label: t("page.knowledge.cases") },
						]}
					/>
				}
			/>
			{view === "docs" ? <DocsPage model={model} embedded /> : null}
			{view === "cases" ? <CasesPage model={model} embedded /> : null}
		</>
	);
}
