import { useTranslation } from "@astravia-org/plugin-sdk";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { AiButton } from "../shell/ai-button";
import type { PageProps } from "./overview";

const FLOW = ["step.pick", "step.run", "step.read", "step.ask", "step.export"] as const;
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
