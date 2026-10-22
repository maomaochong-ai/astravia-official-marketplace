import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo } from "react";
import { buildHealthReport, statusOfTally, tallyOf, type HealthItem, type HealthStatus, type HealthVerdict } from "../../services/health";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { Tag } from "../shell/tag";
import type { PageProps } from "./overview";

const TONE: Record<HealthStatus, string> = {
	pass: "text-risk-low",
	warn: "text-risk-medium",
	fail: "text-risk-high",
};

/** 状态 → 标签色调：写死映射，别在 JSX 里拼 Tailwind 类名。 */
const TAG_TONE: Record<HealthStatus, "low" | "medium" | "high"> = {
	pass: "low",
	warn: "medium",
	fail: "high",
};

const VERDICT_KEY: Record<HealthVerdict, string> = {
	ready: "selfcheck.summary.ready",
	degraded: "selfcheck.summary.degraded",
	blocked: "selfcheck.summary.blocked",
};

const ICON: Record<HealthStatus, string> = {
	pass: "check",
	warn: "alert",
	fail: "close",
};

/**
 * 自检页：每一项都真跑一次，结论来自运行结果而不是静态清单。
 *
 * 呈现方式照搬上游体检脚本的分组结构（一组一张卡、逐项 PASS / OPT / FAIL、
 * 顶部一条汇总），但检查对象换成插件自己的东西：随包文档索引、解码引擎、
 * 工具注册表、宿主桥接。kit 的目录结构不在这里，因为它不归插件管。
 */
export function SelfCheckPage({ model }: PageProps) {
	const { t } = useTranslation();
	const { state: lab } = model.lab;

	const report = useMemo(
		() =>
			buildHealthReport({
				cwd: model.cwd,
				persisted: model.persisted,
				chatStatus: model.chat.state.status,
				lab,
			}),
		[model.cwd, model.persisted, model.chat.state.status, lab],
	);

	// 组级结论看最差一项；整体结论在 health.ts 里算，页面只负责呈现。
	const groupsPassing = report.groups.filter(group => statusOfTally(tallyOf(group.items)) === "pass").length;
	const verdictTone = TAG_TONE[report.verdict === "ready" ? "pass" : report.verdict === "degraded" ? "warn" : "fail"];

	return (
		<>
			<PageHeader
				title={t("page.selfcheck.title")}
				description={t("page.selfcheck.lead")}
				actions={<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={model.chat.sending} />}
			/>
			<div className="space-y-3 p-4">
				<div className="flex flex-wrap items-center gap-2 rounded-md border border-line-subtle bg-surface-2 px-3.5 py-2.5">
					<Tag tone={verdictTone}>{t(VERDICT_KEY[report.verdict], { passed: report.passed, total: report.total, optional: report.optional })}</Tag>
					<span className="font-mono text-[10.5px] text-text-3">{t("selfcheck.summary.groups", { passed: groupsPassing, total: report.groups.length })}</span>
					<span className="text-[10.5px] text-text-3">{t("selfcheck.summary.optional", { count: report.optional })}</span>
					{report.failed > 0 ? <span className="text-[10.5px] text-risk-high">{t("selfcheck.summary.failed", { count: report.failed })}</span> : null}
					<span className="ml-auto font-mono text-[10px] text-text-4">{t("selfcheck.summary.basis")}</span>
				</div>

				{report.groups.map(group => {
					const tally = tallyOf(group.items);
					return (
						<Card
							key={group.id}
							title={t(`selfcheck.group.${group.id}`)}
							actions={
								<Tag tone={TAG_TONE[statusOfTally(tally)]}>
									{t("selfcheck.group.tally", { passed: tally.passed, total: tally.total })}
								</Tag>
							}
							bodyClassName="divide-y divide-line-subtle"
						>
							{group.items.map(entry => (
								<HealthRow key={entry.id} entry={entry} label={t(`selfcheck.item.${entry.id}`)} />
							))}
						</Card>
					);
				})}

				<Card title={t("selfcheck.tools.title")} bodyClassName="p-3.5">
					<p className="text-[10.5px] leading-relaxed text-text-3">{t("selfcheck.tools.body")}</p>
					<div className="mt-2 flex items-center gap-2">
						<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={model.chat.sending} />
						<span className="text-[10px] text-text-4">{t("selfcheck.tools.hint")}</span>
					</div>
				</Card>
			</div>
		</>
	);
}

function HealthRow({ entry, label }: { entry: HealthItem; label: string }) {
	return (
		<div className="flex items-start gap-2.5 px-3.5 py-2">
			<Icon name={ICON[entry.status]} className={`mt-0.5 size-3.5 shrink-0 ${TONE[entry.status]}`} />
			<div className="min-w-0 flex-1">
				<div className="text-[11.5px] text-text">{label}</div>
				<div className="mt-0.5 break-words font-mono text-[10px] leading-relaxed text-text-4">{entry.detail}</div>
			</div>
			<span className={`shrink-0 font-mono text-[9.5px] uppercase tracking-wide ${TONE[entry.status]}`}>{entry.status}</span>
		</div>
	);
}
