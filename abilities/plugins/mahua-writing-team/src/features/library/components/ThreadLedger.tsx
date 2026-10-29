import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ArbitrationScenario, NovelBook, StoryThread, ThreadWeight } from "../../../domain/novel-types.js";
import { PageBar } from "../../shared/components/PageBar.js";
import { Panel } from "../../shared/components/Panel.js";
import { dateOf } from "../bookshelf-model.js";
import { useThreadLedger } from "../hooks/use-thread-ledger.js";

interface ThreadLedgerProps {
	book: NovelBook;
	onBack: () => void;
}

const WEIGHT_TONE: Record<ThreadWeight, string> = {
	light: "bg-muted text-muted-foreground",
	medium: "bg-primary/15 text-primary",
	heavy: "bg-primary text-primary-foreground",
};

const SCENARIOS: ArbitrationScenario[] = ["premise-conflict", "deadlock", "user-intervention"];

/**
 * 伏笔账本（ADR 0021 §2 / ADR 0026 §6）：台账 + 决策日志 + 一致性体检，一页只读。
 *
 * 设计稿 `ledger` 帧是「左台账、右决策日志」。这里同样按容器宽度折行，但行结构没有照抄
 * 五列网格：台账的正文是句子，句子在 400px 里塞进 84px 的列只会被截断，所以每行改成
 * 「正文 + 一行事实」，章号与权重写在第二行，任何时候都不会被挤掉。
 *
 * 这一页没有任何写操作：记伏笔、收伏笔、裁定都是模型的工具（`mahua_*`），
 * 人在这里是审阅者。所以也没有「收一笔」按钮——点了它也不知道该填哪一章。
 */
export function ThreadLedger({ book, onBack }: ThreadLedgerProps) {
	const { t } = useTranslation();
	const { loading, error, threads, audit, decisions, findings } = useThreadLedger(book.id);

	const overdue = new Set(
		audit.findings
			.filter((finding) => finding.code === "thread.overdue")
			.map((finding) => String(finding.detail.threadId ?? "")),
	);
	const openCount = threads.filter((thread) => thread.status === "open").length;

	const stats = [
		{ label: t("ledger.stat.total"), value: String(threads.length) },
		{ label: t("ledger.stat.open"), value: String(openCount) },
		{ label: t("ledger.stat.overdue"), value: String(audit.overdue) },
		{
			label: t("ledger.stat.unresolved"),
			value: `${Math.round(audit.unresolvedRate * 100)}%`,
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageBar back={{ label: t("book.back"), onClick: onBack }}>
				<h1 className="text-lg font-medium text-foreground">{t("ledger.title")}</h1>
				<p className="text-xs text-muted-foreground">{t("ledger.subtitle", { title: book.title })}</p>
			</PageBar>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				{error ? (
					<p className="mb-3 rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive [overflow-wrap:anywhere]">
						{error}
					</p>
				) : null}

				<div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
					{stats.map((stat) => (
						<div key={stat.label} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/50 px-3 py-2">
							<span className="truncate text-xs text-muted-foreground">{stat.label}</span>
							<span className="text-lg font-medium tabular-nums text-foreground">{stat.value}</span>
						</div>
					))}
				</div>

				<div className="flex flex-col gap-4 xl:flex-row xl:items-start">
					<div className="flex min-w-0 flex-1 flex-col gap-4">
						<Panel title={t("ledger.threads")} meta={t("ledger.threadsMeta", { count: threads.length })}>
							{loading ? (
								<p className="text-xs text-muted-foreground">{t("studio.loading")}</p>
							) : threads.length === 0 ? (
								<p className="text-xs text-muted-foreground">{t("ledger.empty")}</p>
							) : (
								<ul className="flex flex-col gap-2.5">
									{threads.map((thread) => (
										<ThreadRow key={thread.id} thread={thread} overdue={overdue.has(thread.id)} />
									))}
								</ul>
							)}
						</Panel>

						{audit.findings.length > 0 ? (
							<Panel title={t("ledger.warnings")} meta={String(audit.findings.length)}>
								<ul className="flex flex-col gap-1.5">
									{audit.findings.map((finding, index) => (
										<li
											key={`${finding.code}-${index}`}
											className="flex min-w-0 items-baseline gap-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
										>
											<span className="shrink-0 font-mono text-[11px]">{finding.code}</span>
											<span className="min-w-0 truncate text-destructive/80">
												{Object.entries(finding.detail)
													.map(([key, value]) => `${key}=${value}`)
													.join(" · ")}
											</span>
										</li>
									))}
								</ul>
							</Panel>
						) : null}
					</div>

					<div className="flex w-full shrink-0 flex-col gap-4 xl:w-[340px]">
						<Panel title={t("ledger.decisions")} meta={t("ledger.decisionsMeta")}>
							{decisions.length === 0 ? (
								<p className="text-xs text-muted-foreground">{t("ledger.decisionsEmpty")}</p>
							) : (
								<ol className="flex flex-col gap-3">
									{decisions
										.slice()
										.reverse()
										.map((record, index) => (
											<li key={`${record.at}-${index}`} className="flex min-w-0 flex-col gap-1">
												<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
													<span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
														{SCENARIOS.includes(record.scenario)
															? t(`ledger.scenario.${record.scenario}`)
															: record.scenario}
													</span>
													<span className="text-[11px] tabular-nums text-muted-foreground/70">
														{dateOf(record.at)}
													</span>
												</span>
												<p className="text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
													{record.question}
												</p>
												<p className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
													{record.decision}
												</p>
												{record.rationale ? (
													<p className="text-[11px] leading-relaxed text-muted-foreground/70 [overflow-wrap:anywhere]">
														{record.rationale}
													</p>
												) : null}
											</li>
										))}
								</ol>
							)}
						</Panel>

						<Panel title={t("ledger.consistency")} meta={String(findings.length)}>
							{findings.length === 0 ? (
								<p className="text-xs text-muted-foreground">{t("ledger.consistencyOk")}</p>
							) : (
								<ul className="flex flex-col gap-1.5">
									{findings.map((finding, index) => (
										<li
											key={`${finding.code}-${index}`}
											className="flex min-w-0 flex-col gap-0.5 text-xs"
										>
											<span className="shrink-0 font-mono text-[11px] text-muted-foreground">
												{finding.code}
											</span>
											{finding.detail ? (
												<span className="text-muted-foreground [overflow-wrap:anywhere]">
													{finding.detail}
												</span>
											) : null}
										</li>
									))}
								</ul>
							)}
						</Panel>
					</div>
				</div>
			</div>
		</div>
	);
}

function ThreadRow({ thread, overdue }: { thread: StoryThread; overdue: boolean }) {
	const { t } = useTranslation();
	const closed = thread.status === "closed";
	return (
		<li className="flex min-w-0 flex-col gap-1 border-b border-border/40 pb-2.5 last:border-b-0 last:pb-0">
			<div className="flex min-w-0 items-start gap-2">
				<span className="min-w-0 flex-1 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
					{thread.content}
				</span>
				<span
					className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
						closed
							? "bg-muted text-muted-foreground"
							: overdue
								? "bg-destructive/15 text-destructive"
								: "bg-primary/15 text-primary"
					}`}
				>
					{closed ? t("ledger.state.closed") : overdue ? t("ledger.state.overdue") : t("ledger.state.open")}
				</span>
			</div>
			<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
				<span className={`rounded px-1 py-0.5 font-medium ${WEIGHT_TONE[thread.weight]}`}>
					{t(`ledger.weight.${thread.weight}`)}
				</span>
				<span className="tabular-nums">{t("ledger.planted", { chapter: thread.plantedIn })}</span>
				<span className="tabular-nums">
					{closed && thread.closedIn !== null
						? t("ledger.closedIn", { chapter: thread.closedIn })
						: t("ledger.dueIn", { chapter: thread.dueIn })}
				</span>
			</div>
		</li>
	);
}
