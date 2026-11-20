import { useTranslation } from "@astravia-org/plugin-sdk";
import { AiButton } from "../shell/ai-button";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { EntropyPage } from "./entropy";
import { ManifestPage } from "./manifest";
import { SignaturePage } from "./signature";
import type { PageProps } from "./overview";

type View = "manifest" | "entropy" | "signature";

/**
 * 静态详情：清单 / 熵 / 签名三张只读视图。
 *
 * 三者的数据源是同一份体检结果，读者也是同一个问题——「这份样本的静态事实长什么样」。
 * 拆成三个侧栏入口时每页只有一两张卡，导航却多三项；合到一页后导航少两项。
 *
 * 两条与知识页对齐的约定（都是被同一类缺陷打出来的）：
 *
 *   1. **一级视图用下划线 tab，不用分段控件。** 分段控件在这个面板里表示「局部筛选」
 *      （随包先例 / 我的案例、预览 / 原文）；一级导航与二级筛选长得一样，用户读不出
 *      哪一级在管什么。知识页已经改成 tab，这里必须一致。
 *   2. **动作挂在这一层，跟着视图换。** 子页在 `embedded` 下会把整个 PageHeader 让出来，
 *      连带把 `ai.permissions` / `ai.entropy` / `ai.verifySignature` / 导出一起摘掉 ——
 *      合并之后那四个动作就没有任何入口了。
 */
export function StaticPage({ model }: PageProps) {
	const { t } = useTranslation();
	const view = model.staticView;

	const actions: Record<View, React.ReactNode> = {
		manifest: (
			<>
				<AiButton label={t("ai.permissions")} onClick={() => model.ask("permissions")} busy={model.chat.sending} />
				<button
					type="button"
					onClick={() => model.exportReport("markdown")}
					disabled={!model.report}
					className="flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
				>
					<Icon name="save" className="size-3" />
					{t("manifest.export")}
				</button>
			</>
		),
		entropy: (
			<AiButton label={t("ai.entropy")} onClick={() => model.ask("entropy")} busy={model.chat.sending} disabled={!model.report} />
		),
		signature: (
			<AiButton label={t("ai.verifySignature")} onClick={() => model.ask("signature")} busy={model.chat.sending} />
		),
	};

	return (
		<>
			<PageHeader title={t("page.static.title")} description={t("page.static.lead")} actions={actions[view]} />

			<div role="tablist" aria-label={t("page.static.title")} className="flex shrink-0 gap-1">
				{(["manifest", "entropy", "signature"] as const).map(item => {
					const active = item === view;
					const labelKey = item === "manifest" ? "page.manifest.title" : item === "entropy" ? "page.entropy.title" : "page.signature.title";
					return (
						<button
							key={item}
							type="button"
							role="tab"
							aria-selected={active}
							onClick={() => model.setStaticView(item)}
							className={`-mb-px border-b-2 px-2.5 py-1.5 text-[12px] transition-colors ${
								active ? "border-accent font-medium text-text" : "border-transparent text-text-3 hover:border-line-strong hover:text-text-2"
							}`}
						>
							{t(labelKey)}
						</button>
					);
				})}
			</div>

			{view === "manifest" ? <ManifestPage model={model} embedded /> : null}
			{view === "entropy" ? <EntropyPage model={model} embedded /> : null}
			{view === "signature" ? <SignaturePage model={model} embedded /> : null}
		</>
	);
}
