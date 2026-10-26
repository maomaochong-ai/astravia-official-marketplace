/**
 * 引擎详情：doctor 报告里「除 checks 之外」的事实。
 *
 * 为什么单独一块：checks 只回答「哪一项没通过」，回答不了「我看的是哪个 rea」。
 * 版本、安装位置、Skill 与客户端注册来自同一次 doctor 输出，放出来才能解释
 * 版本过旧 / 装了多份 / Skill 没装这三种最容易被误读成「面板坏了」的情况。
 *
 * 字段缺就显示「—」，不用默认值编一个看起来正常的数字。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DoctorSummary } from "../live/doctor-summary";
import { Panel, PanelHeader } from "../../../shared/components/panel";

interface EngineIdentityProps {
	readonly summary: DoctorSummary | null;
	readonly onAskAgent: () => void;
	readonly askingAgent: boolean;
}

interface IdentityRow {
	readonly key: string;
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
	readonly warn?: boolean;
}

export function ReaEngineIdentity({ summary, onAskAgent, askingAgent }: EngineIdentityProps): JSX.Element {
	const { t } = useTranslation();

	const rows: IdentityRow[] = [];
	if (summary !== null) {
		rows.push({
			key: "version",
			label: t("ui.engine.identity.version"),
			value: summary.cliVersion ?? t("ui.engine.identity.missing"),
			mono: true,
		});
		rows.push({
			key: "install",
			label: t("ui.engine.identity.install"),
			value:
				summary.installPaths.length === 0
					? t("ui.engine.identity.missing")
					: summary.installPaths.join(" · "),
			mono: true,
			warn: summary.installPaths.length > 1,
		});
		rows.push({
			key: "installState",
			label: t("ui.engine.identity.installState"),
			value: summary.installState ?? t("ui.engine.identity.missing"),
			warn: summary.installState === "multiple",
		});
		rows.push({
			key: "skill",
			label: t("ui.engine.identity.skill"),
			value: summary.skillState ?? t("ui.engine.identity.missing"),
			warn: summary.skillState !== null && summary.skillState !== "installed",
		});
		rows.push({
			key: "catalog",
			label: t("ui.engine.identity.catalog"),
			value: t("ui.engine.identity.catalogValue", {
				commands: summary.catalog.cliCommands ?? 0,
				tools: summary.catalog.mcpTools ?? 0,
				prompts: summary.catalog.mcpPrompts ?? 0,
			}),
		});
		const aligned = summary.registrations.filter((row) => row.state === "aligned").length;
		rows.push({
			key: "registrations",
			label: t("ui.engine.identity.registrations"),
			value:
				summary.registrations.length === 0
					? t("ui.engine.identity.missing")
					: t("ui.engine.identity.registrationsValue", {
							aligned,
							total: summary.registrations.length,
						}),
			warn: summary.registrations.length > 0 && aligned < summary.registrations.length,
		});
	}

	const multipleInstalls = summary !== null && summary.installPaths.length > 1;

	return (
		<Panel>
			<PanelHeader
				title={t("ui.engine.identity.title")}
				hint={summary === null ? t("ui.engine.identity.hint") : undefined}
				actions={
					<button
						type="button"
						onClick={onAskAgent}
						disabled={askingAgent}
						title={t("ui.engine.askAgentHint")}
						className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-surface-3 px-2 text-micro text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className={`icon-[lucide--bot] size-3 ${askingAgent ? "motion-safe:animate-pulse" : ""}`} />
						{t("ui.engine.askAgent")}
					</button>
				}
			/>

			{summary === null ? (
				<p className="px-4 py-3 text-micro text-text-4">{t("ui.engine.identity.empty")}</p>
			) : (
				<dl className="flex flex-col divide-y divide-border-subtle">
					{rows.map((row) => (
						<div key={row.key} className="flex min-w-0 items-baseline gap-3 px-4 py-2">
							<dt className="w-[86px] shrink-0 text-micro text-text-4">{row.label}</dt>
							<dd
								className={[
									"min-w-0 flex-1 break-words text-micro leading-relaxed",
									row.mono ? "font-mono" : "",
									row.warn === true ? "text-risk-medium" : "text-text-2",
								]
									.filter(Boolean)
									.join(" ")}
							>
								{row.value}
							</dd>
						</div>
					))}
				</dl>
			)}

			{multipleInstalls ? (
				<p className="border-t border-border-subtle px-4 py-2 text-micro-up leading-relaxed text-risk-medium">
					{t("ui.engine.identity.multipleInstalls", { count: summary === null ? 0 : summary.installPaths.length })}
				</p>
			) : null}
		</Panel>
	);
}
