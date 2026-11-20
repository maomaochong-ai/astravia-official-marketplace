import { useTranslation } from "@astravia-org/plugin-sdk";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { AiButton } from "../shell/ai-button";
import { useState } from "react";
import { planNextSteps } from "../../../../domain/case/next-step";
import type { PageProps } from "./overview";

/**
 * 使用指南：一张**工作流图** + 每步交付什么。
 *
 * 上一版是六段文字列表，读者得自己把「哪一步用哪个页面」拼起来。现在：
 *   · 上半是一行流图（六段带箭头，箭头之间标「进入下一段的判据」）；
 *   · 下半是工件表：每段产出的文件/结论、落在哪个页面、下一步拿它干什么；
 *   · 最后一段是边界：插件不做什么，免得把「工具输出」当成「结论」。
 */
const FLOW = ["intake", "static", "knowledge", "dynamic", "deliver", "review"] as const;

/** 每段的工件：产出是什么、在哪看、下一步用它干什么。 */
const ARTIFACTS: Record<(typeof FLOW)[number], { where: string; out: string; next: string }> = {
	intake: { where: "samples", out: "sha256 / 格式 / 节区 / 熵", next: "带着指纹进静态画像" },
	static: { where: "findings / strings / disasm / static", out: "规则命中 + 偏移 + 符号", next: "把命中拿去知识库找方法" },
	knowledge: { where: "knowledge", out: "方法文档 + 先例 slug + 可跑工具", next: "决定用哪个方法、跑哪个脚本" },
	dynamic: { where: "prompts", out: "激活的提示词 / 注入计划 / 拒答梯度", next: "用配置去验证假设" },
	deliver: { where: "reports", out: "四节报告（概要/判定点/证据/防御）", next: "交付、复核、归档" },
	review: { where: "selfcheck / activity", out: "自检结论 + 调用配对 + 回滚命令", next: "任何改动都必须能回滚" },
};

export function GuidePage({ model }: PageProps) {

/** 置信度 → 徽标配色。写死映射，禁止在 JSX 里拼条件类名（拼错了 tailwind 会直接丢掉）。 */
const STEP_TONE: Record<"strong" | "weak" | "fallback", string> = {
	strong: "bg-accent-soft text-accent",
	weak: "bg-surface-3 text-text-3",
	fallback: "bg-surface-3 text-text-4",
};

	const { t } = useTranslation();
	const busy = model.chat.sending;
	const [active, setActive] = useState<(typeof FLOW)[number]>("intake");

	return (
		<>
			<PageHeader
				title={t("page.guide.title")}
				description={t("page.guide.lead")}
				actions={<AiButton label={t("ai.workflow")} onClick={() => model.ask("continue")} busy={busy} />}
			/>

			<div className="fb-page">
				{/* 工作流图：六段横排，段间箭头标注「判据」。窄面板自动折行。 */}
				<Card title={t("guide.flow.title")} bodyClassName="p-3">
					<ol className="flex flex-wrap items-stretch gap-1.5">
						{FLOW.map((stage, index) => (
							<li key={stage} className="flex min-w-0 flex-1 items-stretch gap-1.5" style={{ minWidth: 150 }}>
								<button
									type="button"
									onClick={() => setActive(stage)}
									aria-pressed={active === stage}
									className={`flex min-w-0 flex-1 flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors ${
										active === stage ? "border-accent/50 bg-accent-soft" : "border-line-subtle bg-surface hover:bg-surface-hover"
									}`}
								>
									<span className="flex items-center gap-1.5">
										<span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-4 font-mono text-[9.5px] text-text-2">
											{index + 1}
										</span>
										<span className={`truncate text-[11.5px] font-medium ${active === stage ? "text-accent" : "text-text"}`}>
											{t(`guide.stage.${stage}.title`)}
										</span>
									</span>
									<span className="truncate font-mono text-[9.5px] text-text-4">{ARTIFACTS[stage].where}</span>
								</button>
								{index < FLOW.length - 1 ? (
									<span aria-hidden className="flex shrink-0 items-center px-0.5 text-text-4">
										<Icon name="chevron" className="size-3" />
									</span>
								) : null}
							</li>
						))}
					</ol>
					<p className="mt-2 text-[10px] leading-relaxed text-text-4">{t("guide.flow.note")}</p>
				</Card>

				{/* 选中段的工件表：产出 / 下一步，两行就够，不做成图表。 */}
				<Card title={`${t(`guide.stage.${active}.title`)} · ${t("guide.artifacts.title")}`} bodyClassName="divide-y divide-line-subtle">
					<div className="flex items-start gap-2.5 px-3.5 py-2">
						<Icon name="check" className="mt-0.5 size-3 shrink-0 text-accent" />
						<div className="min-w-0 flex-1">
							<div className="text-[11.5px] text-text">{t("guide.artifacts.out")}</div>
							<div className="mt-0.5 font-mono text-[10px] text-text-3">{ARTIFACTS[active].out}</div>
						</div>
					</div>
					<div className="flex items-start gap-2.5 px-3.5 py-2">
						<Icon name="chevron" className="mt-0.5 size-3 shrink-0 text-text-4" />
						<div className="min-w-0 flex-1">
							<div className="text-[11.5px] text-text">{t("guide.artifacts.next")}</div>
							<div className="mt-0.5 text-[10.5px] leading-relaxed text-text-3">{ARTIFACTS[active].next}</div>
						</div>
					</div>
					<div className="px-3.5 py-2 text-[10.5px] leading-relaxed text-text-3">{t(`guide.stage.${active}.body`)}</div>
				</Card>

				{/* 下一步：与 `plan_next_step` 工具同一份实现，面板与对话给出的计划因此不会分叉。 */}
				{model.report ? (
					<Card
						title={t("guide.next.title")}
						actions={<span className="font-mono text-[10px] text-text-4">{model.report.findings.length}</span>}
						bodyClassName="divide-y divide-line-subtle"
					>
						{planNextSteps({
							format: model.report.target.format,
							ruleIds: model.report.findings.map(item => item.ruleId),
						}).map(step => (
							<div key={step.id} className="flex flex-col gap-1 px-3.5 py-2">
								<div className="flex items-center gap-1.5">
									<span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] ${STEP_TONE[step.confidence]}`}>
										{t(`guide.next.confidence.${step.confidence}`)}
									</span>
									<span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-text">{step.hypothesis}</span>
								</div>
								<code className="fb-wrap font-mono text-[10px] text-text-2">{`${step.action.tool} ${step.action.args}`}</code>
								<span className="text-[10.5px] leading-relaxed text-text-3">
									{t("guide.next.disproof")} {step.disproof}
								</span>
								<span className="text-[10.5px] leading-relaxed text-text-4">
									{t("guide.next.else")} {step.elseDo}
								</span>
							</div>
						))}
					</Card>
				) : null}

				<Card title={t("guide.limit.title")} bodyClassName="divide-y divide-line-subtle">
					{(["execute", "network", "size", "scope", "tools"] as const).map(item => (
						<div key={item} className="flex gap-1.5 px-3.5 py-1.5">
							<Icon name="ban" className="mt-0.5 size-3 shrink-0 text-text-4" />
							<span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{t(`guide.limit.${item}`)}</span>
						</div>
					))}
					<div className="flex flex-wrap gap-1.5 px-3.5 py-2.5">
						<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={busy} />
						<AiButton label={t("ai.report")} onClick={() => model.ask("report")} busy={busy} disabled={!model.report} />
					</div>
				</Card>
			</div>
		</>
	);
}
