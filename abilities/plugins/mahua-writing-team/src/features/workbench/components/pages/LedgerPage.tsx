import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import { auditThreads } from "../../../../domain/thread-ledger.js";
import type { WorkbenchPage } from "../../workbench-pages";
import { committedFrontier, elapsedSince, threadStateOf } from "../../workbench-model";
import type { ThreadState } from "../../workbench-model";
import { elapsedText, lastEvent } from "../../workbench-feed";
import { EmptySheet } from "../shell/EmptySheet";
import { PageHeader } from "../shell/PageHeader";
import { useConsoleTimeline } from "../../console-timeline/use-console-timeline.js";

/** 四条跨章检查：与 `checkConsistency` 的 code 一一对应，顺序固定。 */
const CHECKS = [
	"consistency.chapterOutsideArc",
	"consistency.unknownCharacter",
	"consistency.arcOverlap",
	"consistency.rewriteOnCommitted",
] as const;

const THREAD_TONE: Record<ThreadState, string> = {
	closed: "text-ink-faint",
	overdue: "text-fail",
	open: "text-ink",
};

/** 表格列宽：重量 / 埋了什么 / 埋于 / 应还 / 状态。表头与行共用一条，不许各写一份。 */
const THREAD_COLUMNS = "grid-cols-[38px_1fr_76px_76px_52px]";

/**
 * 伏笔与决策：账本不合并，决定不重写。
 *
 * 两张等高的通高圆角纸——左账本、右决策日志——因为这两样都是**追加**的：
 * 一条伏笔只能被关上，不能被改写；一条裁定进日志之后不再动。这一页因此也只有读。
 *
 * 版面按设计稿的纪律来：两张纸各自 `overflow-hidden` 并吃满剩余高度，滚动的只有纸里面的
 * 那一层；统计、表格头、钉底提醒都是 `shrink-0`。右侧不再是「一摞小卡」——一摞卡总和矮过
 * 左栏时，纸面下方会空出一条 canvas，两栏也就不等高了。
 */
export function LedgerPage({
	data,
	onNavigate,
}: {
	data: StudioState;
	onNavigate: (page: WorkbenchPage, chapter?: number) => void;
}) {
	const t = useTranslator();
	const events = useConsoleTimeline();
	const now = Date.now();
	const book = data.book;
	const committedMax = book ? committedFrontier(book) : 0;
	const audit = auditThreads(data.threads, committedMax);
	const lastRun = lastEvent(events);
	const findings = data.findings;

	return (
		<div className="flex min-h-0 flex-1 flex-col px-7 pb-5 pt-6 @max-[720px]:px-4">
			<PageHeader
				title={t("page.ledger.title")}
				meta={
					<span className="truncate text-body-sm text-ink-soft">
						{book ? t("ledger.subtitle", { title: book.title }) : t("ledger.subtitleEmpty")}
					</span>
				}
				right={
					<span className="flex shrink-0 items-center gap-1.5 text-[10px] text-ink-soft">
						<span className={`size-1 rounded-pill ${findings.length === 0 ? "bg-pass" : "bg-fail"}`} />
						{lastRun
							? t("ledger.checkedAt", { ago: elapsedText(elapsedSince(lastRun.at, now), t) })
							: t("ledger.checkedNever")}
					</span>
				}
			/>

			<div className="mt-4 flex min-h-0 flex-1 gap-5 @max-[980px]:flex-col @max-[980px]:overflow-y-auto">
				<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-sheet bg-raised px-4 py-4 shadow-raise @max-[980px]:shrink-0">
					<div className="flex shrink-0 items-baseline justify-between gap-3">
						<h2 className="font-display text-section font-semibold text-ink">{t("ledger.title")}</h2>
						<span className="shrink-0 text-[10px] text-ink-faint">
							{t("ledger.threadsMeta", { count: data.threads.length })}
						</span>
					</div>

					<div className="mt-3 grid shrink-0 grid-cols-4 gap-2">
						{[
							{ label: t("ledger.stat.total"), value: String(data.threads.length) },
							{ label: t("ledger.stat.open"), value: String(audit.open) },
							{ label: t("ledger.stat.overdue"), value: String(audit.overdue) },
							{ label: t("ledger.stat.unresolved"), value: `${Math.round(audit.unresolvedRate * 100)}%` },
						].map((tile) => (
							<div key={tile.label} className="rounded-control border border-line-soft bg-inset/50 px-2.5 py-2">
								<div className="font-display text-heading font-semibold leading-none text-ink">{tile.value}</div>
								<div className="mt-1 truncate text-[10px] text-ink-faint">{tile.label}</div>
							</div>
						))}
					</div>

					<div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-line">
						<div
							className={`grid ${THREAD_COLUMNS} shrink-0 items-center gap-2 border-b border-line bg-inset px-3 py-2 text-[10px] font-semibold uppercase text-ink-faint`}
						>
							<span className="min-w-0 truncate">{t("ledger.weight.heavy")}</span>
							<span className="min-w-0 truncate">{t("ledger.threads")}</span>
							<span className="min-w-0 truncate">{t("ledger.plantedShort")}</span>
							<span className="min-w-0 truncate">{t("ledger.dueShort")}</span>
							<span className="min-w-0 truncate text-right">{t("ledger.stateShort")}</span>
						</div>
						{data.threads.length === 0 ? (
							<div className="flex min-h-0 flex-1 p-4">
								<EmptySheet icon="icon-[lucide--git-branch]" title={t("ledger.empty")} />
							</div>
						) : (
							<ul className="min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto">
								{data.threads.map((thread) => {
									const state = threadStateOf(thread, committedMax);
									const closedChapter = thread.closedIn;
									return (
										<li
											key={thread.id}
											className={`grid ${THREAD_COLUMNS} items-center gap-2 px-3 py-2 text-[11px] ${
												state === "overdue" ? "bg-fail-soft/40" : ""
											}`}
										>
											<span
												className={`w-6 rounded-tile text-center text-[10px] leading-[17px] ${
													thread.weight === "heavy"
														? "bg-cinnabar-soft text-cinnabar-ink"
														: thread.weight === "medium"
															? "bg-wait-soft text-wait"
															: "bg-inset text-ink-soft"
												}`}
											>
												{t(`ledger.weight.${thread.weight}`)}
											</span>
											<span className={`min-w-0 truncate ${THREAD_TONE[state]}`}>{thread.content}</span>
											<span className="min-w-0 truncate font-mono text-[10px] text-ink-soft">
												{t("ledger.planted", { chapter: thread.plantedIn })}
											</span>
											<span className={`min-w-0 truncate font-mono text-[10px] ${state === "overdue" ? "text-fail" : "text-ink-soft"}`}>
												{closedChapter
													? t("ledger.closedIn", { chapter: closedChapter })
													: t("ledger.dueIn", { chapter: thread.dueIn })}
											</span>
											<span className={`min-w-0 truncate text-right text-[10px] ${THREAD_TONE[state]}`}>
												{t(`ledger.state.${state}`)}
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</div>

					{/* 钉底：一条逾期就是下一章要还的钩子，滚到最后一行也该看见它。 */}
					<div className="mt-3 shrink-0 rounded-control border border-dashed border-line-strong px-3 py-2.5">
						<div className="flex items-start gap-2">
							<span
								className={`mt-0.5 shrink-0 ${
									audit.findings.length === 0 ? "icon-[lucide--check] text-pass" : "icon-[lucide--alert-triangle] text-wait"
								} size-3.5`}
							/>
							<div className="min-w-0 flex-1 space-y-1">
								{audit.findings.length === 0 ? (
									<p className="text-[10px] leading-4 text-ink-soft">{t("ledger.auditOk")}</p>
								) : (
									audit.findings.map((finding, index) => (
										<p key={`${finding.code}-${index}`} className="text-[10px] leading-4 text-ink">
											{t(`ledger.finding.${finding.code}`)}
										</p>
									))
								)}
							</div>
						</div>
					</div>
				</section>

				<aside className="flex min-h-0 w-[366px] shrink-0 flex-col overflow-hidden rounded-sheet bg-raised px-4 py-4 shadow-raise @max-[1180px]:w-[300px] @max-[980px]:w-full @max-[980px]:shrink-0">
					<div className="flex shrink-0 items-baseline justify-between gap-3">
						<h2 className="font-display text-section font-semibold text-ink">{t("ledger.decisions")}</h2>
						<span className="shrink-0 font-mono text-[10px] text-ink-faint">{t("ledger.decisionsMeta")}</span>
					</div>

					{data.decisions.length === 0 ? (
						<p className="mt-3 text-[11px] leading-5 text-ink-soft">{t("ledger.decisionsEmpty")}</p>
					) : (
						<ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
							{data.decisions
								.slice()
								.reverse()
								.map((record) => {
									const ago = elapsedSince(record.at, now);
									return (
										<li
											key={`${record.at}-${record.question}`}
											className="rounded-control border border-line bg-surface px-3 py-2.5"
										>
											<div className="flex items-center gap-1.5">
												<span className="rounded-tile bg-inset px-1.5 text-[10px] leading-[17px] text-ink-soft">
													{t(`ledger.scenario.${record.scenario}`)}
												</span>
												<span className="ml-auto shrink-0 font-mono text-[10px] text-ink-faint">
													{ago ? t(ago.key, { count: ago.count }) : ""}
												</span>
											</div>
											<p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-ink-soft">{record.question}</p>
											<p className="mt-1 line-clamp-2 text-[11px] leading-5 font-medium text-ink">{record.decision}</p>
										</li>
									);
								})}
						</ul>
					)}

					<div className="mt-3 shrink-0 border-t border-line pt-3">
						<div className="flex items-baseline justify-between gap-3">
							<h3 className="font-display text-body font-semibold text-ink">{t("ledger.consistency")}</h3>
							<span className={`shrink-0 text-[10px] ${findings.length === 0 ? "text-pass" : "text-fail"}`}>
								{findings.length === 0 ? t("ledger.consistencyOk") : t("ledger.audit", { count: findings.length })}
							</span>
						</div>
						<dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
							{CHECKS.map((code) => {
								const hits = findings.filter((finding) => finding.code === code).length;
								return (
									<div key={code} className="flex min-w-0 items-center gap-1.5">
										<span
											className={`shrink-0 ${
												hits === 0 ? "icon-[lucide--check] text-pass" : "icon-[lucide--alert-triangle] text-fail"
											} size-3`}
										/>
										<span className="min-w-0 flex-1 truncate text-[10px] text-ink-soft">{t(`ledger.check.${code}`)}</span>
										<span className="shrink-0 font-mono text-[10px] text-ink-faint">{hits}</span>
									</div>
								);
							})}
						</dl>
						<p className="mt-2 text-[10px] leading-4 text-ink-faint">{t("ledger.footerNote")}</p>
						<button
							type="button"
							onClick={() => onNavigate("book")}
							className="mt-2.5 flex h-8 w-full shrink-0 items-center justify-center gap-1.5 rounded-control border border-line-strong text-[10px] font-medium text-ink transition-colors hover:bg-surface"
						>
							<span className="icon-[lucide--book-open] size-3" />
							{t("ledger.backToBook")}
						</button>
					</div>
				</aside>
			</div>
		</div>
	);
}
