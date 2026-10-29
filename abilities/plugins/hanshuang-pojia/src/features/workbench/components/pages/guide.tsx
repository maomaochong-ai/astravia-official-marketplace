/**
 * 面板「指引」页：从零开始的下一步做什么。
 *
 * 内容全部来自随包文档与当前状态，不写死版本号；页面只读，不触发工具调用。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { AiButton } from "../shell/ai-button";
import type { PageProps } from "./overview";

const FLOW = ["step.pick", "step.run", "step.read", "step.ask", "step.export"] as const;

const LAB_OFF = ["guide.lab.off.1", "guide.lab.off.2", "guide.lab.off.3"] as const;
const LAB_ON = ["guide.lab.on.1", "guide.lab.on.2", "guide.lab.on.3"] as const;
const PANEL = ["guide.can.panel.engine", "guide.can.panel.report", "guide.can.panel.strings", "guide.can.panel.compare"] as const;
const CHAT = ["guide.can.chat.toolchain", "guide.can.chat.explain", "guide.can.chat.split", "guide.can.chat.disasm"] as const;
const LIMITS = ["guide.limit.execute", "guide.limit.network", "guide.limit.size", "guide.limit.scope", "guide.limit.tools"] as const;

/** 使用指南：一次完整流程、能力分工、以及插件真的做不到的事。 */
export function GuidePage({ model }: PageProps) {
	const { t } = useTranslation();
	const busy = model.chat.sending;

	return (
		<>
			<PageHeader
				title={t("page.guide.title")}
				description={t("page.guide.lead")}
				actions={<AiButton label={t("ai.workflow")} onClick={() => model.ask("continue")} busy={busy} />}
			/>
			<div className="grid gap-3 p-4 @min-[900px]:grid-cols-2">
				<Card title={t("guide.flow")} bodyClassName="p-3.5" className="@min-[900px]:col-span-2">
					<ol className="grid gap-2.5 @min-[760px]:grid-cols-5">
						{FLOW.map((step, index) => (
							<li key={step} className="min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-4 font-mono text-[10px] text-text-2">{index + 1}</span>
									<span className="truncate text-[12px] font-medium text-text">{t(`guide.${step}.title`)}</span>
								</div>
								<p className="mt-1 text-[10.5px] leading-relaxed text-text-4">{t(`guide.${step}.body`)}</p>
							</li>
						))}
					</ol>
				</Card>


				<Card title={t("guide.lab.title")} bodyClassName="p-3.5" className="@min-[900px]:col-span-2">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Icon name="chip" className="size-3.5 text-purple" />
							<span className="text-[11px] font-medium text-text-2">{t("guide.lab.status")}</span>
							<span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + (model.lab.state.enabled ? "bg-risk-low/15 text-risk-low" : "bg-surface-4 text-text-4")}>
								{t(model.lab.state.enabled ? "guide.lab.on" : "guide.lab.off")}
							</span>
						</div>
						<button
							type="button"
							onClick={() => model.lab.set(!model.lab.state.enabled)}
							className="rounded-md border border-line-subtle px-2.5 py-1 text-[11px] font-medium text-text-2 hover:bg-surface-4"
						>
							{t(model.lab.state.enabled ? "guide.lab.disable" : "guide.lab.enable")}
						</button>
					</div>
					<p className="mt-2 text-[10.5px] leading-relaxed text-text-3">{t("guide.lab.lead")}</p>
					<div className="mt-3 grid gap-1.5 border-t border-line-subtle pt-2.5 @min-[600px]:grid-cols-2">
						<div>
							<div className="flex items-center gap-1.5 text-[11px] font-medium text-text-2">
								<Icon name="ban" className="size-3 text-text-4" />
								<span>{t("guide.lab.offTitle")}</span>
							</div>
							<ul className="mt-1.5 space-y-1">
								{LAB_OFF.map(item => (
									<li key={item} className="flex gap-1.5 text-[10.5px] leading-relaxed text-text-3">
										<Icon name="ban" className="mt-0.5 size-3 shrink-0 text-text-4" />
										{t(item)}
									</li>
								))}
							</ul>
						</div>
						<div>
							<div className="flex items-center gap-1.5 text-[11px] font-medium text-text-2">
								<Icon name="sparkle" className="size-3 text-purple" />
								<span>{t("guide.lab.onTitle")}</span>
							</div>
							<ul className="mt-1.5 space-y-1">
								{LAB_ON.map(item => (
									<li key={item} className="flex gap-1.5 text-[10.5px] leading-relaxed text-text-3">
										<Icon name="check" className="mt-0.5 size-3 shrink-0 text-risk-low" />
										{t(item)}
									</li>
								))}
							</ul>
						</div>
					</div>
					<div className="mt-3 rounded-md border border-line-subtle bg-surface-4 px-3 py-2 text-[10.5px] leading-relaxed text-text-3">
						<span className="font-medium text-text-2">{t("guide.lab.caseTitle")}</span> {t("guide.lab.case")}
					</div>
				</Card>

				<Card title={t("guide.can.title")} bodyClassName="divide-y divide-line-subtle">
					<div className="px-3.5 py-2">
						<div className="flex items-center gap-1.5 text-[11px] font-medium text-text-2">
							<Icon name="chip" className="size-3.5 text-text-3" />
							{t("guide.can.panel")}
						</div>
						<ul className="mt-1.5 space-y-1">
							{PANEL.map(item => (
								<li key={item} className="flex gap-1.5 text-[10.5px] leading-relaxed text-text-3">
									<Icon name="check" className="mt-0.5 size-3 shrink-0 text-risk-low" />
									{t(item)}
								</li>
							))}
						</ul>
					</div>
					<div className="px-3.5 py-2">
						<div className="flex items-center gap-1.5 text-[11px] font-medium text-text-2">
							<Icon name="sparkle" className="size-3.5 text-purple" />
							{t("guide.can.chat")}
						</div>
						<ul className="mt-1.5 space-y-1">
							{CHAT.map(item => (
								<li key={item} className="flex gap-1.5 text-[10.5px] leading-relaxed text-text-3">
									<Icon name="chevron" className="mt-0.5 size-3 shrink-0 text-text-4" />
									{t(item)}
								</li>
							))}
						</ul>
					</div>
				</Card>

				<Card title={t("guide.limit.title")} bodyClassName="p-3.5">
					<ul className="space-y-1.5">
						{LIMITS.map(item => (
							<li key={item} className="flex gap-1.5 text-[10.5px] leading-relaxed text-text-3">
								<Icon name="ban" className="mt-0.5 size-3 shrink-0 text-text-4" />
								{t(item)}
							</li>
						))}
					</ul>
					<div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-subtle pt-2.5">
						<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={busy} />
						<AiButton label={t("ai.report")} onClick={() => model.ask("report")} busy={busy} disabled={!model.report} />
					</div>
				</Card>
			</div>
		</>
	);
}
