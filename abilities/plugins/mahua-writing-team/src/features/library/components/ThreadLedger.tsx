import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ArbitrationScenario, NovelBook, StoryThread, ThreadWeight } from "../../../domain/novel-types.js";
import { PageBar, PAGE_META, PAGE_TITLE } from "../../shared/components/PageBar.js";
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

const CARD = "rounded-[18px] bg-card shadow-xs";

/**
 * 伏笔账本（ADR 0021 §2 / 0026 §6 / 0027 §9）：台账 + 决策日志 + 一致性体检，一页只读。
 *
 * 设计稿 `ledger` 帧是「四格统计 + 左台账、右决策日志」。台账行在 `min-[760px]` 才铺开成
 * 「序号 / 正文 / 章 / 权重 / 状态」五列；窄面板里正文是句子，句子塞进 84px 的列只会被截断，
 * 所以降级成「正文 + 一行事实」，章号与权重写在第二行，任何时候都不会被挤掉。
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

	const unresolvedPercent = Math.round(audit.unresolvedRate * 100);

	const stats = [
		{ label: t("ledger.stat.total"), value: String(threads.length), tone: "text-foreground" },
		{ label: t("ledger.stat.open"), value: String(openCount), tone: "text-foreground" },
		{
			label: t("ledger.stat.overdue"),
			value: String(audit.overdue),
			tone: audit.overdue > 0 ? "text-destructive" : "text-foreground",
		},
		{
			label: t("ledger.stat.unresolved"),
			value: `${unresolvedPercent}%`,
			tone: unresolvedPercent === 0 ? "text-primary" : "text-foreground",
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageBar
				back={{ label: t("book.back"), onClick: onBack }}
				actions={
					<span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
						<span
							aria-hidden="true"
							className={`size-1 rounded-full ${findings.length === 0 ? "bg-primary" : "bg-destructive"}`}
						/>
						{t("ledger.audit", { count: findings.length })}
					</span>
				}
			>
				<h1 className={PAGE_TITLE}>{t("ledger.title")}</h1>
				<p className={PAGE_META}>
					<span className="truncate">{t("ledger.subtitle", { title: book.title })}</span>
				</p>
			</PageBar>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
				{error ? (
					<p className="mb-3 rounded-[9px] bg-destructive/15 px-3 py-2 text-[11px] text-destructive [overflow-wrap:anywhere]">
						{error}
					</p>
				) : null}

				<div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
					{stats.map((stat) => (
						<div
							key={stat.label}
							className="flex min-w-0 flex-col gap-1 rounded-[13px] border border-border/50 bg-card px-2.5 py-2"
						>
							<span className={`font-serif text-[19px] font-semibold leading-none tabular-nums ${stat.tone}`}>
								{stat.value}
							</span>
							<span className="truncate text-[10px] text-muted-foreground/70">{stat.label}</span>
						</div>
					))}
				</div>

				<div className="flex flex-col gap-4 xl:flex-row xl:items-start">
					<div className="flex min-w-0 flex-1 flex-col gap-4">
						<section className="flex flex-col overflow-hidden rounded-[13px] border border-border/50 bg-card">
							<header className="flex items-baseline justify-between gap-2 border-b border-border/50 bg-muted/50 px-3.5 pb-2 pt-2.5">
								<h2 className="font-serif text-[15px] font-semibold text-foreground">{t("ledger.threads")}</h2>
								<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
									{t("ledger.threadsMeta", { count: threads.length })}
								</span>
							</header>
							{loading ? (
								<p className="px-3.5 py-3 text-[11px] text-muted-foreground">{t("studio.loading")}</p>
							) : threads.length === 0 ? (
								<p className="px-3.5 py-3 text-[11px] text-muted-foreground">{t("ledger.empty")}</p>
							) : (
								<ul className="flex flex-col">
									{threads.map((thread) => (
										<ThreadRow key={thread.id} thread={thread} overdue={overdue.has(thread.id)} />
									))}
								</ul>
							)}
						</section>

						{audit.findings.length > 0 ? (
							<section className="flex flex-col overflow-hidden rounded-[13px] border border-border/50 bg-card">
								<header className="flex items-baseline justify-between gap-2 border-b border-border/50 bg-muted/50 px-3.5 pb-2 pt-2.5">
									<h2 className="font-serif text-[15px] font-semibold text-foreground">{t("ledger.warnings")}</h2>
									<span className="font-mono text-[10px] tabular-nums text-muted-foreground">{audit.findings.length}</span>
								</header>
								<ul className="flex flex-col gap-1 p-2">
									{audit.findings.map((finding, index) => (
										<li
											key={`${finding.code}-${index}`}
											className="flex min-w-0 items-baseline gap-2 rounded-[9px] border border-dashed border-border px-2 py-1.5 text-[10px]"
										>
											<span className="shrink-0 font-mono text-destructive">{finding.code}</span>
											<span className="min-w-0 truncate text-muted-foreground">
												{Object.entries(finding.detail)
													.map(([key, value]) => `${key}=${value}`)
													.join(" · ")}
											</span>
										</li>
									))}
								</ul>
							</section>
						) : null}
					</div>

					<div className="flex w-full shrink-0 flex-col gap-4 xl:w-[340px]">
						<Panel title={t("ledger.decisions")} meta={t("ledger.decisionsMeta")}>
							{decisions.length === 0 ? (
								<p className="text-[11px] text-muted-foreground">{t("ledger.decisionsEmpty")}</p>
							) : (
								<ol className="flex flex-col gap-3">
									{decisions
										.slice()
										.reverse()
										.map((record, index) => (
											<li
												key={`${record.at}-${index}`}
												className="flex min-w-0 flex-col gap-1 rounded-[13px] border border-border/50 bg-card px-3 py-2.5"
											>
												<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
													<span className="rounded-[6px] bg-muted px-1.5 text-[10px] leading-[17px] text-muted-foreground">
														{SCENARIOS.includes(record.scenario)
															? t(`ledger.scenario.${record.scenario}`)
															: record.scenario}
													</span>
													<span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
														{dateOf(record.at)}
													</span>
												</span>
												<p className="text-[11.5px] leading-[19px] text-muted-foreground [overflow-wrap:anywhere]">
													{record.question}
												</p>
												<p className="text-[11.5px] leading-[19px] font-medium text-foreground [overflow-wrap:anywhere]">
													{record.decision}
												</p>
												{record.rationale ? (
													<p className="mt-0.5 border-t border-border/40 pt-1.5 text-[10px] leading-relaxed text-muted-foreground/70 [overflow-wrap:anywhere]">
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
								<p className="text-[11px] text-muted-foreground">{t("ledger.consistencyOk")}</p>
							) : (
								<ul className="flex flex-col gap-1.5">
									{findings.map((finding, index) => (
										<li key={`${finding.code}-${index}`} className="flex min-w-0 flex-col gap-0.5 text-[11px]">
											<span className="shrink-0 font-mono text-[10px] text-muted-foreground">{finding.code}</span>
											{finding.detail ? (
												<span className="text-muted-foreground [overflow-wrap:anywhere]">{finding.detail}</span>
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
		<li
			className={`flex min-w-0 flex-col gap-1 border-b border-border/40 px-3.5 py-2 transition-colors last:border-b-0 min-[760px]:flex-row min-[760px]:items-baseline min-[760px]:gap-3 ${
				overdue ? "bg-destructive/5" : "hover:bg-muted/40"
			}`}
		>
			<span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-foreground [overflow-wrap:anywhere]">
				{thread.content}
			</span>
			<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] tabular-nums text-muted-foreground min-[760px]:shrink-0">
				<span className="hidden min-[760px]:inline">{thread.id}</span>
				<span>{t("ledger.planted", { chapter: thread.plantedIn })}</span>
				<span>
					{closed && thread.closedIn !== null
						? t("ledger.closedIn", { chapter: thread.closedIn })
						: t("ledger.dueIn", { chapter: thread.dueIn })}
				</span>
			</span>
			<span
				className={`shrink-0 self-start rounded-[6px] px-1.5 text-[10px] leading-[17px] font-medium ${WEIGHT_TONE[thread.weight]}`}
			>
				{t(`ledger.weight.${thread.weight}`)}
			</span>
			<span
				className={`shrink-0 self-start rounded-[6px] px-1.5 py-0.5 text-[9px] font-medium ${
					closed
						? "bg-muted text-muted-foreground"
						: overdue
							? "bg-destructive/15 text-destructive"
							: "bg-primary/15 text-primary"
				}`}
			>
				{closed ? t("ledger.state.closed") : overdue ? t("ledger.state.overdue") : t("ledger.state.open")}
			</span>
		</li>
	);
}
