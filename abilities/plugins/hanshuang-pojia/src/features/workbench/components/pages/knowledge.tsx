import { useTranslation } from "@astravia-org/plugin-sdk";
import { SHIPPED_PRECEDENTS } from "../../../../domain/case/precedents";
import { AiButton } from "../shell/ai-button";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { CasesPage } from "./cases";
import { DocsPage } from "./docs";
import type { PageProps } from "./overview";

type View = "docs" | "cases";

/**
 * 知识：文档与案例库同屏切换。
 *
 * 两者在内容上是一件事的两面——一套语料（346 篇文档）与从它派生出的先例包（20 个），
 * 读的人常常在两处来回跳：先看方法，再找打过这类目标的先例。
 *
 * 两条设计约束（都是被上一版打出来的）：
 *
 *   1. **一级导航不能长得像二级筛选。** 上一版这里用分段控件，「文档 / 案例」与案例页内的
 *      「随包先例 / 我的案例」是同一种圆角容器、只差一个尺寸，用户读不出哪一级在管什么。
 *      顶栏这一级改成下划线 tab：贴内容顶边、带计数、没有容器底 —— 与局部视图明确不同。
 *
 *   2. **动作跟着视图走，不能跟着子页走。** 子页在 embedded 下会把整个 PageHeader 让出来，
 *      于是 `ai.docs` / `cases.open` / `cases.refresh` 三个按钮在知识页里全部消失（案例为空时
 *      连重扫都没有）。现在动作挂在这一层，按当前视图换；子页只管内容。
 */
export function KnowledgePage({ model }: PageProps) {
	const { t } = useTranslation();
	const { view } = model.knowledge;
	const totals: Record<View, number> = {
		docs: model.docs.totals.documents,
		cases: SHIPPED_PRECEDENTS.length + model.cases.cases.length,
	};

	const actions =
		view === "docs" ? (
			<AiButton label={t("ai.docs")} busy={model.chat.sending} onClick={() => model.ask("docs")} />
		) : (
			<>
				<AiButton label={t("cases.open")} busy={model.chat.sending} onClick={() => model.ask("case-open")} />
				<button
					type="button"
					onClick={model.cases.refresh}
					className="flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
				>
					<Icon name="refresh" className="size-3" />
					{t("cases.refresh")}
				</button>
			</>
		);

	return (
		<>
			<PageHeader title={t("page.knowledge.title")} description={t("page.knowledge.lead")} actions={actions} />

			{/*
			 * 下划线 tab：`aria-selected` + `role="tablist"`，键盘左右键由浏览器按 radiogroup
			 * 之外的原生 tab 语义处理；计数放在标签内，切视图不用先点进去看有多少条。
			 */}
			<div role="tablist" aria-label={t("page.knowledge.title")} className="flex shrink-0 gap-1">
				{(["docs", "cases"] as const).map(item => {
					const active = item === view;
					return (
						<button
							key={item}
							type="button"
							role="tab"
							aria-selected={active}
							onClick={() => model.patchKnowledge({ view: item })}
							className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[12px] transition-colors ${
								active
									? "border-accent font-medium text-text"
									: "border-transparent text-text-3 hover:border-line-strong hover:text-text-2"
							}`}
						>
							{t(`page.knowledge.${item}`)}
							<span className="font-mono text-[10.5px] tabular-nums text-text-4">{totals[item]}</span>
						</button>
					);
				})}
			</div>

			{/*
			 * 只有当前视图挂载：另一份清单不占内存，也不用把两块滚动容器同时留着。
			 * 阅读位置在 model 里（`knowledge.slug` / `knowledge.group`），卸载不会丢。
			 */}
			{view === "docs" ? <DocsPage model={model} embedded /> : <CasesPage model={model} embedded />}
		</>
	);
}
