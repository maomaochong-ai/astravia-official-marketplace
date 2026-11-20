import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { PageHeader } from "../shell/page-header";
import { SegmentedControl } from "../shell/segmented-control";
import { EntropyPage } from "./entropy";
import { ManifestPage } from "./manifest";
import { SignaturePage } from "./signature";
import type { PageProps } from "./overview";

type View = "manifest" | "entropy" | "signature";

/**
 * 静态详情：清单 / 熵 / 签名三张只读视图。
 *
 * 三者的数据源是同一份体检结果，读者也是同一个问题——「这份样本的静态事实长什么样」。
 * 分成三个侧栏入口时，每一项都只有一到两张卡，点进去还要再回来看导航；
 * 合到一页用分段控件切换，导航少两项，三张视图仍然各自完整（子页面未被裁剪，只隐藏了自己的标题）。
 */
export function StaticPage({ model }: PageProps) {
	const { t } = useTranslation();
	const [view, setView] = useState<View>("manifest");

	return (
		<>
			<PageHeader
				title={t("page.static.title")}
				description={t("page.static.lead")}
				actions={
					<SegmentedControl<View>
						value={view}
						onValueChange={setView}
						ariaLabel={t("page.static.title")}
						items={[
							{ value: "manifest", label: t("page.manifest.title") },
							{ value: "entropy", label: t("page.entropy.title") },
							{ value: "signature", label: t("page.signature.title") },
						]}
					/>
				}
			/>
			{view === "manifest" ? <ManifestPage model={model} embedded /> : null}
			{view === "entropy" ? <EntropyPage model={model} embedded /> : null}
			{view === "signature" ? <SignaturePage model={model} embedded /> : null}
		</>
	);
}
