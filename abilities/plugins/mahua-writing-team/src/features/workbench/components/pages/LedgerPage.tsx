import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import { auditThreads } from "../../../../domain/threads.js";
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

/**
 * 伏笔与决策：账本不合并，决定不重写。
 *
 * 三个东西并排放着——在册的伏笔、裁定日志、跨章检查——因为它们都是**追加**的：
 * 一条伏笔只能被关上，不能被改写；一条裁定进日志之后不再动。这一页因此也只有读。
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

	return (
		<div className="flex min-h-0 flex-1 gap-5 px-7 pb-5 pt-6 @max-[720px]:px-4 @max-[980px]:flex-col @max-[980px]:overflow-y-auto">
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<PageHeader
					title={t("page.ledger.title")}
					meta={
						<span className="truncate text-body-sm text-ink-soft">
							{book ? t("ledger.subtitle", { title: book.title }) : t("ledger.subtitleEmpty")}
						</span>
					}
				/>

				<div className="grid shrink-0 grid-cols-4 gap-3">
					{[
						{ label: t("ledger.stat.total"), value: String(data.threads.length) },
						{ label: t("ledger.stat.open"), value: String(audit.open) },
						{ label: t("ledger.stat.overdue"), value: String(audit.overdue) },
						{ label: t("ledger.stat.unresolved"), value: `${Math.round(audit.unresolvedRate * 100)}%` },
					].map((tile) => (
						<div key={tile.label} className="rounded-panel bg-raised px-3 py-2.5 shadow-raise">
							<div className="text-micro-up font-semibold uppercase text-ink-faint">
								{tile.label}
							</div>
							<div className="mt-1 font-mono text-heading tabular-nums leading-none text-ink">{tile.value}</div>
						</div>
					))}
				</div>

				<section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-sheet bg-raised shadow-raise">
					<div className="grid shrink-0 grid-cols-[38px_1fr_84px_84px_56px] items-center gap-2 border-b border-line px-4 pb-2 pt-3 text-micro-up font-semibold uppercase text-ink-faint">
						<span />
						<span>{t("ledger.threads")}</span>
						<span>{t("ledger.plantedShort")}</span>
						<span>{t("ledger.dueShort")}</span>
						<span className="text-right">{t("ledger.stateShort")}</span>
					</div>
					{data.threads.length === 0 ? (
						<div className="flex min-h-0 flex-1 p-4">
							<EmptySheet icon="icon-[lucide--git-branch]" title={t("ledger.empty")} />
						</div>
					) : (
						<ul className="min-h-0 flex-1 overflow-y-auto px-4 py-1">
							{data.threads.map((thread) => {
								const state = threadStateOf(thread, committedMax);
								const closedChapter = thread.closedIn;
								return (
									<li
										key={thread.id}
										className="grid grid-cols-[38px_1fr_84px_84px_56px] items-center gap-2 border-b border-line-soft py-2 text-[11px]"
									>
										<span
											className={`w-fit rounded-tile px-1.5 text-[10px] leading-[17px] ${
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
										<span className="font-mono text-[10px] text-ink-soft">
											{t("ledger.planted", { chapter: thread.plantedIn })}
										</span>
										<span className="font-mono text-[10px] text-ink-soft">
											{closedChapter
												? t("ledger.closedIn", { chapter: closedChapter })
												: t("ledger.dueIn", { chapter: thread.dueIn })}
										</span>
										<span className={`text-right text-[10px] ${THREAD_TONE[state]}`}>
											{t(`ledger.state.${state}`)}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</section>

				<section className="mt-3 shrink-0 rounded-sheet bg-raised p-3 shadow-raise">
					<div className="flex items-baseline gap-2">
						<span className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("ledger.decisions")}
						</span>
						<span className="text-[10px] text-ink-faint">{t("ledger.decisionsMeta")}</span>
					</div>
					{data.decisions.length === 0 ? (
						<p className="mt-2 text-[11px] text-ink-soft">{t("ledger.decisionsEmpty")}</p>
					) : (
						<ul className="mt-2 grid grid-cols-3 gap-2">
							{data.decisions.slice(-3).map((record) => {
								const ago = elapsedSince(record.at, now);
								return (
									<li key={`${record.at}-${record.question}`} className="rounded-panel bg-inset/70 p-2.5">
										<div className="flex items-center gap-1.5">
											<span className="rounded-tile bg-raised px-1.5 text-[10px] leading-[17px] font-medium text-ink-soft">
												{t(`ledger.scenario.${record.scenario}`)}
											</span>
											<span className="ml-auto font-mono text-[9.5px] text-ink-faint">
												{ago ? t(ago.key, { count: ago.count }) : ""}
											</span>
										</div>
										<p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-ink">{record.question}</p>
										<p className="mt-1 line-clamp-2 text-[10px] leading-4 text-ink-soft">{record.decision}</p>
									</li>
								);
							})}
						</ul>
					)}
				</section>
			</div>

			<aside className="flex min-h-0 w-[366px] shrink-0 flex-col gap-3 overflow-y-auto @max-[1180px]:w-[300px] @max-[980px]:w-full @max-[980px]:shrink">
				<section className="rounded-sheet bg-raised p-3.5 shadow-raise">
					<div className="flex items-baseline gap-2">
						<span className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("ledger.consistency")}
						</span>
						<span className="ml-auto font-mono text-[10px] text-ink-faint">
							{lastRun
								? t("ledger.checkedAt", { ago: elapsedText(elapsedSince(lastRun.at, now), t) })
								: t("ledger.checkedNever")}
						</span>
					</div>
					<ul className="mt-2 space-y-1">
						{CHECKS.map((code) => {
							const hits = data.findings.filter((finding) => finding.code === code).length;
							return (
								<li key={code} className="flex items-center gap-2 text-[11px]">
									<span
										className={`size-1.5 rounded-pill ${hits === 0 ? "bg-pass" : "bg-fail"}`}
									/>
									<span className={`min-w-0 flex-1 truncate ${hits === 0 ? "text-ink-soft" : "text-ink"}`}>
										{t(`ledger.check.${code}`)}
									</span>
									<span className="font-mono text-[10px] text-ink-faint">{hits}</span>
								</li>
							);
						})}
					</ul>
					{data.findings.length === 0 && (
						<p className="mt-2 text-[10px] text-ink-faint">{t("ledger.consistencyOk")}</p>
					)}
				</section>

				<section className="rounded-sheet bg-raised p-3.5 shadow-raise">
					<div className="text-micro-up font-semibold uppercase text-ink-faint">
						{t("ledger.audit", { count: audit.findings.length })}
					</div>
					{audit.findings.length === 0 ? (
						<p className="mt-2 text-[11px] leading-5 text-ink-soft">{t("ledger.auditOk")}</p>
					) : (
						<ul className="mt-2 space-y-1.5">
							{audit.findings.map((finding, index) => (
								<li key={`${finding.code}-${index}`} className="flex gap-2 text-[11px] leading-5">
									<span className="icon-[lucide--alert-triangle] mt-0.5 size-3 shrink-0 text-wait" />
									<span className="min-w-0 flex-1 text-ink">{t(`ledger.finding.${finding.code}`)}</span>
								</li>
							))}
						</ul>
					)}
				</section>

				<div className="mt-auto rounded-panel border border-dashed border-line px-3 py-2.5 text-[10px] leading-4 text-ink-soft">
					{t("ledger.footerNote")}
				</div>

				<button
					type="button"
					onClick={() => onNavigate("book")}
					className="flex h-8 items-center justify-center gap-1.5 rounded-control border border-line-strong text-[10px] font-medium text-ink transition-colors hover:bg-raised"
				>
					<span className="icon-[lucide--book-open] size-3" />
					{t("ledger.backToBook")}
				</button>
			</aside>
		</div>
	);
}
