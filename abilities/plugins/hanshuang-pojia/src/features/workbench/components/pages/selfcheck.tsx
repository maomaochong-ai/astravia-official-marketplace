import { useTranslation } from "@astravia-org/plugin-sdk";
import { CORE_TOOL_IDS } from "../../../../tools/gate";
import { TOOL_IDS } from "../../../../tools/ids";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadDocsLibrary, type DocsLibrary } from "../../services/docs";
import { buildHealthReport, statusOfTally, tallyOf, type HealthItem, type HealthStatus, type HealthVerdict } from "../../services/health";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { Spinner } from "../shell/spinner";
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

type Load =
	| { phase: "loading" }
	| { phase: "ready"; library: DocsLibrary }
	| { phase: "failed"; reason: string };

/**
 * 自检页：每一项都真跑一次，结论来自运行结果而不是静态清单。
 *
 * 呈现方式照搬上游体检脚本的分组结构（一组一张卡、逐项 PASS / OPT / FAIL、顶部一条汇总），
 * 检查对象换成插件自己的东西：随包文档索引、解码引擎、工具注册表、宿主桥接。
 *
 * **失败必须说出来**。之前这里只有「加载中」一种非就绪状态：索引读不到时页面永远停在
 * 「正在载入文档索引…」，用户无法分辨「慢」与「坏了」。现在三种状态各有各的呈现，
 * 失败带原因与重试按钮，并把最可能的原因（资源路径）直接写出来。
 */
export function SelfCheckPage({ model }: PageProps) {
	const { t } = useTranslation();
	const { state: lab } = model.lab;

	const [load, setLoad] = useState<Load>({ phase: "loading" });

	const run = useCallback(() => {
		let cancelled = false;
		setLoad({ phase: "loading" });
		void loadDocsLibrary().then(
			library => {
				if (!cancelled) setLoad({ phase: "ready", library });
			},
			(error: unknown) => {
				if (!cancelled) setLoad({ phase: "failed", reason: error instanceof Error ? error.message : String(error) });
			},
		);
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => run(), [run]);

	const report = useMemo(
		() =>
			load.phase === "ready"
				? buildHealthReport(
						{ cwd: model.cwd, persisted: model.persisted, chatStatus: model.chat.state.status, lab },
						{ entries: load.library.entries, totals: load.library.totals },
					)
				: null,
		[load, model.cwd, model.persisted, model.chat.state.status, lab],
	);

	if (load.phase === "loading") {
		return (
			<>
				<PageHeader title={t("page.selfcheck.title")} description={t("page.selfcheck.lead")} />
				<div className="fb-page">
					<Card bodyClassName="p-3.5">
						<div className="flex items-center gap-2 text-[11.5px] text-text-3">
							<Spinner className="size-3.5" />
							{t("docs.index.loading")}
						</div>
					</Card>
				</div>
			</>
		);
	}

	if (load.phase === "failed" || !report) {
		return (
			<>
				<PageHeader title={t("page.selfcheck.title")} description={t("page.selfcheck.lead")} />
				<div className="fb-page">
					<Card title={t("selfcheck.failed.title")} bodyClassName="flex flex-col gap-2 p-3.5">
						<div className="flex items-start gap-2">
							<Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-risk-high" />
							<p className="min-w-0 flex-1 break-words text-[11.5px] leading-relaxed text-text-2">
								{load.phase === "failed" ? load.reason : t("selfcheck.failed.empty")}
							</p>
						</div>
						<p className="text-[10.5px] leading-relaxed text-text-4">{t("selfcheck.failed.hint")}</p>
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => run()}
								className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-2.5 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
							>
								<Icon name="refresh" className="size-3" />
								{t("selfcheck.failed.retry")}
							</button>
							<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={model.chat.sending} />
						</div>
					</Card>
				</div>
			</>
		);
	}

	// 组级结论看最差一项；整体结论在 health.ts 里算，页面只负责呈现。
	const groupsPassing = report.groups.filter(group => statusOfTally(tallyOf(group.items)) === "pass").length;
	const verdictTone = TAG_TONE[report.verdict === "ready" ? "pass" : report.verdict === "degraded" ? "warn" : "fail"];

	return (
		<>
			<PageHeader
				title={t("page.selfcheck.title")}
				description={t("page.selfcheck.lead")}
				actions={
					<>
						<button
							type="button"
							onClick={() => run()}
							className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
						>
							<Icon name="refresh" className="size-3" />
							{t("selfcheck.failed.retry")}
						</button>
						<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={model.chat.sending} />
					</>
				}
			/>
			<div className="fb-page">
				<div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 ring-1 ring-line-subtle">
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
							actions={<Tag tone={TAG_TONE[statusOfTally(tally)]}>{t("selfcheck.group.tally", { passed: tally.passed, total: tally.total })}</Tag>}
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
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={model.chat.sending} />
						<AiButton label={t("selfcheck.tools.installAll")} onClick={() => model.ask("install")} busy={model.chat.sending} />
						<span className="text-[10px] text-text-4">{model.chat.sending ? t("selfcheck.tools.running") : t("selfcheck.tools.hint")}</span>
					</div>
				</Card>

				{/* 工具清单：每项标明闸门等级与本次会话是否真的被调用过。 */}
				<Card title={t("selfcheck.tools.table")} bodyClassName="p-0" actions={<span className="font-mono text-[10px] text-text-4">{TOOL_IDS.length}</span>}>
					<div className="fb-scroll max-h-[280px] divide-y divide-line-subtle overflow-y-auto">
						{TOOL_IDS.map(id => {
							const called = model.activity.entries.find(entry => entry.toolId === id);
							const core = CORE_TOOL_IDS.includes(id);
							return (
								<div key={id} className="flex items-center gap-2 px-3.5 py-1.5">
									<span className={`size-1.5 shrink-0 rounded-full ${called ? "bg-accent" : "bg-text-4"}`} />
									<span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-text-2">{id}</span>
									<span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-3">
										{t(core ? "selfcheck.tools.core" : "selfcheck.tools.labOnly")}
									</span>
									<span className={`shrink-0 font-mono text-[9.5px] ${called ? "text-text-3" : "text-text-4"}`}>
										{called ? called.at.slice(11, 19) : t("selfcheck.tools.uncalled")}
									</span>
								</div>
							);
						})}
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
