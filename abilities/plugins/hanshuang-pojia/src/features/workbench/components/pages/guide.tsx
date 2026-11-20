import { useTranslation } from "@astravia-org/plugin-sdk";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { AiButton } from "../shell/ai-button";
import { SegmentedControl } from "../shell/segmented-control";
import { useState } from "react";
import type { PageProps } from "./overview";

/**
 * 一次评估的六段，与当前实现对齐（不是旧版的五步）：
 * 载入样本 → 静态画像 → 语义核对（知识库） → 动态/注入 → 交付 → 复核与回滚。
 *
 * 每段写明「在哪个页面做」「哪条命令/工具」「产出什么」，读者照着点就能走完，
 * 不需要先理解插件结构。旧版只写「选样本 / 跑 / 读 / 问 / 导出」五步，
 * 与现在的知识库两级筛选、注入矩阵、报告与回滚都对不上。
 */
const STAGES = ["intake", "static", "knowledge", "dynamic", "deliver", "review"] as const;

const CAP_PANEL = ["cap.panel.engine", "cap.panel.report", "cap.panel.strings", "cap.panel.compare", "cap.panel.probe"] as const;
const CAP_CHAT = ["cap.chat.toolchain", "cap.chat.explain", "cap.chat.split", "cap.chat.disasm"] as const;
const LIMITS = ["limit.execute", "limit.network", "limit.size", "limit.scope", "limit.tools"] as const;

type Tab = "flow" | "split" | "limits";

/** 使用指南：一条完整链路、面板与对话的分工、以及插件真的做不到的事。 */
export function GuidePage({ model }: PageProps) {
	const { t } = useTranslation();
	const busy = model.chat.sending;
	const [tab, setTab] = useState<Tab>("flow");

	return (
		<>
			<PageHeader
				title={t("page.guide.title")}
				description={t("page.guide.lead")}
				actions={
					<>
						<SegmentedControl<Tab>
							size="sm"
							value={tab}
							onValueChange={setTab}
							ariaLabel={t("page.guide.title")}
							items={[
								{ value: "flow", label: t("guide.tab.flow") },
								{ value: "split", label: t("guide.tab.split") },
								{ value: "limits", label: t("guide.tab.limits") },
							]}
						/>
						<AiButton label={t("ai.workflow")} onClick={() => model.ask("continue")} busy={busy} />
					</>
				}
			/>

			<div className="fb-page">
				{tab === "flow" ? (
					<>
						<Card title={t("guide.flow.title")} bodyClassName="p-3.5">
							<ol className="flex flex-col gap-0">
								{STAGES.map((stage, index) => (
									<li key={stage} className="flex gap-3">
										{/* 竖线只连在本段与下一段之间：最后一段不画，避免结尾多出一截。 */}
										<div className="flex w-5 shrink-0 flex-col items-center">
											<span className="flex size-5 items-center justify-center rounded-full bg-surface-4 font-mono text-[10px] text-text-2">
												{index + 1}
											</span>
											{index < STAGES.length - 1 ? <span aria-hidden className="my-1 w-px flex-1 bg-line-subtle" /> : null}
										</div>
										<div className={`min-w-0 flex-1 ${index < STAGES.length - 1 ? "pb-3.5" : ""}`}>
											<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
												<span className="text-[12px] font-medium text-text">{t(`guide.stage.${stage}.title`)}</span>
												<span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[9.5px] text-text-3">{t(`guide.stage.${stage}.where`)}</span>
											</div>
											<p className="mt-1 text-[10.5px] leading-relaxed text-text-3">{t(`guide.stage.${stage}.body`)}</p>
											<p className="mt-0.5 font-mono text-[10px] text-text-4">{t(`guide.stage.${stage}.out`)}</p>
										</div>
									</li>
								))}
							</ol>
						</Card>

						<Card title={t("guide.lab.title")} bodyClassName="p-3.5">
							<div className="flex items-start gap-2.5">
								<Icon name="chip" className="mt-0.5 size-3.5 shrink-0 text-accent" />
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-[11.5px] font-medium text-text-2">{t("guide.lab.status")}</span>
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
												model.lab.state.enabled ? "bg-risk-low/15 text-risk-low" : "bg-surface-4 text-text-4"
											}`}
										>
											{t(model.lab.state.enabled ? "guide.lab.on" : "guide.lab.off")}
										</span>
									</div>
									<p className="mt-1.5 text-[10.5px] leading-relaxed text-text-3">{t("guide.lab.lead")}</p>
									<p className="mt-1 text-[10.5px] leading-relaxed text-text-4">{t("guide.lab.case")}</p>
								</div>
								<button
									type="button"
									onClick={() => model.lab.set(!model.lab.state.enabled)}
									className="shrink-0 rounded-md border border-line-subtle px-2.5 py-1 text-[11px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
								>
									{t(model.lab.state.enabled ? "guide.lab.disable" : "guide.lab.enable")}
								</button>
							</div>
						</Card>
					</>
				) : null}

				{tab === "split" ? (
					<div className="grid gap-3 @min-[900px]:grid-cols-2">
						<Card title={t("guide.cap.panel")} bodyClassName="divide-y divide-line-subtle">
							{CAP_PANEL.map(item => (
								<div key={item} className="flex gap-1.5 px-3.5 py-1.5">
									<Icon name="check" className="mt-0.5 size-3 shrink-0 text-risk-low" />
									<span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{t(`guide.${item}`)}</span>
								</div>
							))}
						</Card>
						<Card title={t("guide.cap.chat")} bodyClassName="divide-y divide-line-subtle">
							{CAP_CHAT.map(item => (
								<div key={item} className="flex gap-1.5 px-3.5 py-1.5">
									<Icon name="chevron" className="mt-0.5 size-3 shrink-0 text-text-4" />
									<span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{t(`guide.${item}`)}</span>
								</div>
							))}
						</Card>
					</div>
				) : null}

				{tab === "limits" ? (
					<Card title={t("guide.limit.title")} bodyClassName="divide-y divide-line-subtle">
						{LIMITS.map(item => (
							<div key={item} className="flex gap-1.5 px-3.5 py-1.5">
								<Icon name="ban" className="mt-0.5 size-3 shrink-0 text-text-4" />
								<span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{t(`guide.${item}`)}</span>
							</div>
						))}
						<div className="flex flex-wrap gap-1.5 px-3.5 py-2.5">
							<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={busy} />
							<AiButton label={t("ai.report")} onClick={() => model.ask("report")} busy={busy} disabled={!model.report} />
						</div>
					</Card>
				) : null}
			</div>
		</>
	);
}
