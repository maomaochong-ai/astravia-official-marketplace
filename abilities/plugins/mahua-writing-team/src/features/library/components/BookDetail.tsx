import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ChapterStatus, Instruction, NovelBook } from "../../../domain/novel-types.js";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";
import { STUDIO_MEMBERS } from "../../../studio-members.js";
import { PageBar, PAGE_META } from "../../shared/components/PageBar.js";
import { PhaseBadge } from "../../shared/components/PhaseBadge.js";
import { BookHead } from "../../studio/components/BookHead.js";
import { CredentialChip } from "../../studio/components/CredentialChip.js";
import { InstructionCard } from "../../studio/components/InstructionCard.js";
import { MemberRoster } from "../../studio/components/MemberRoster.js";
import { dateOf } from "../bookshelf-model.js";
import { ChapterIndex } from "./ChapterIndex.js";

interface BookDetailProps {
	book: NovelBook;
	instruction: Instruction | null;
	entitlement: EntitlementState;
	selectedChapter: number | null;
	busy: boolean;
	handoffBusy: boolean;
	onBack: () => void;
	onContinue: () => void;
	onOpenChapter: (n: number) => void;
	/** 进伏笔账本：台账、决策日志、一致性体检都在那一页（ADR 0026 §6）。 */
	onOpenLedger: () => void;
	onCopyManuscript: () => void;
	onInvite: (member: (typeof STUDIO_MEMBERS)[number]) => void;
	onOpenCredential: () => void;
	onAcceptBrief: () => void;
	onStartDrafting: () => void;
	onCommit: (n: number) => void;
	onCloseArc: () => void;
	onFinalize: () => void;
	/** 「看运行台」：章节脊柱与落盘时间线在那一页（ADR 0027 §1）。 */
	onOpenConsole: () => void;
}

/** 设计稿那条 40 格的弧进度带：只统计当前弧，弧外的章不上带子。 */
const MAX_TICKS = 40;

const TICK: Record<ChapterStatus, string> = {
	planned: "bg-muted-foreground/20",
	drafting: "bg-primary",
	reviewed: "bg-primary/45",
	committed: "bg-primary/80",
	blocked: "bg-destructive",
};

const CARD = "rounded-[18px] bg-card shadow-xs";
const LEGEND: { status: ChapterStatus; key: string }[] = [
	{ status: "committed", key: "book.legendCommitted" },
	{ status: "reviewed", key: "book.legendReviewed" },
	{ status: "drafting", key: "book.legendDrafting" },
	{ status: "planned", key: "book.legendPlanned" },
];

/** 当前章所在的弧；没有弧（还没规划）时返回本书前 40 章，免得页面上留一块空白。 */
function arcOf(book: NovelBook, current: number) {
	const arcs = book.volumes.flatMap((volume) => volume.arcs);
	const hit = arcs.find((arc) => current >= arc.from && current <= arc.to) ?? null;
	if (hit) return { title: hit.title, goal: hit.goal, from: hit.from, to: Math.min(hit.to, hit.from + MAX_TICKS - 1) };
	return { title: "", goal: "", from: 1, to: Math.min(book.targetChapters, MAX_TICKS) };
}

/**
 * 书页（ADR 0013 §2.3 / 0026 §2 / 0027 §6）。
 *
 * 版面照设计稿 `book` 帧：页头是「书名 + 阶段 + 章数 + 字数」，左边一条弧进度带、
 * 一张当前章 brief、指令卡与最近落盘，右边是分卷目录、伏笔账本入口与成员行。
 *
 * 左栏那三块的设计稿原件（`ChapterBrief` 的 elapsed / worker）插件没有真实数据，
 * 所以 brief 只用 `book.plans` 里的目标 / 冲突 / 钩子与章状态、字数——写出去的每个字都能对上账。
 *
 * 主按钮**只负责翻到阅读页**（ADR 0025 §1）。要对话的那一步由指令卡与第二个按钮承担
 * （`action.handoffContinue`），不再靠同一颗按钮兼职。
 */
export function BookDetail({
	book,
	instruction,
	entitlement,
	selectedChapter,
	busy,
	handoffBusy,
	onBack,
	onContinue,
	onOpenChapter,
	onOpenLedger,
	onInvite,
	onOpenCredential,
	onAcceptBrief,
	onStartDrafting,
	onCommit,
	onCloseArc,
	onFinalize,
	onCopyManuscript,
	onOpenConsole,
}: BookDetailProps) {
	const { t } = useTranslation();
	const current = book.progress.currentChapter;
	const arc = arcOf(book, current);
	const arcChapters = Array.from({ length: Math.max(1, arc.to - arc.from + 1) }, (_, index) => {
		const n = arc.from + index;
		return book.chapters.find((chapter) => chapter.n === n)?.status ?? "planned";
	});
	const arcDone = book.chapters.filter(
		(chapter) => chapter.n >= arc.from && chapter.n <= arc.to && chapter.status === "committed",
	).length;
	const recent = [...book.checkpoints].slice(-4).reverse();
	const chapter = book.chapters.find((entry) => entry.n === current) ?? null;
	const plan = book.plans.find((entry) => entry.n === current) ?? null;
	const totalWords = book.chapters.reduce((sum, entry) => sum + entry.words, 0);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageBar
				back={{ label: t("book.back"), onClick: onBack }}
				actions={
					<>
						<button
							type="button"
							onClick={() => onOpenChapter(current)}
							className="rounded-[9px] bg-foreground px-3 py-1.5 text-[11px] font-medium text-background transition-opacity hover:opacity-90"
						>
							{t("book.continueAt", { chapter: current })}
						</button>
						{/* 次按钮才是「让团队接着写」：它经 `use-agent-handoff` 发话，不碰阅读位置（ADR 0025 §1）。 */}
						<button
							type="button"
							onClick={onContinue}
							disabled={handoffBusy}
							className="rounded-[9px] border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
						>
							{t("action.handoffContinue")}
						</button>
						<button
							type="button"
							onClick={onOpenConsole}
							className="rounded-[9px] border border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							{t("shelf.openConsole")}
						</button>
					</>
				}
			>
				<BookHead book={book} />
				<p className={PAGE_META}>
					<span className="truncate">{book.genre.trim() || t("library.card.noGenre")}</span>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">{t("book.indexCount", { count: book.targetChapters })}</span>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">{t("board.words", { count: totalWords })}</span>
				</p>
			</PageBar>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start">
					<div className="flex min-w-0 flex-1 flex-col gap-4">
						<section className={`${CARD} px-4 py-3.5`}>
							<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
								<span className="min-w-0 truncate font-serif text-[15px] font-semibold text-foreground">
									{arc.title || t("book.arcGoalNone")}
								</span>
								<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
									{t("book.arcRange", { from: arc.from, to: arc.to })}
								</span>
								<span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
									{arcDone} / {arc.to - arc.from + 1}
								</span>
							</div>
							<div className="mt-2.5 flex gap-[3px]" aria-hidden="true">
								{arcChapters.map((status, index) => (
									<span
										key={arc.from + index}
										className={`h-1.5 flex-1 rounded-[1px] ${TICK[status]}`}
									/>
								))}
							</div>
							<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
								{LEGEND.map((entry) => (
									<span key={entry.status} className="flex items-center gap-1 text-[10px] text-muted-foreground">
										<span aria-hidden="true" className={`size-1.5 rounded-[1px] ${TICK[entry.status]}`} />
										{t(entry.key)}
									</span>
								))}
							</div>
							{arc.goal ? (
								<p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{arc.goal}</p>
							) : null}
						</section>

						<section className={`${CARD} px-4 py-3.5`}>
							<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
								<span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
									{t("book.brief")}
								</span>
								<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
									{t("board.chapterLabel", { chapter: current })}
								</span>
								{chapter ? <PhaseBadge phase={book.phase} /> : null}
								<span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
									{chapter ? t("board.words", { count: chapter.words }) : t("book.briefEmpty")}
								</span>
							</div>
							<h3 className="mt-1.5 min-w-0 truncate font-serif text-[18px] font-semibold text-foreground">
								{chapter?.title || t("book.briefNoTitle")}
							</h3>
							{plan ? (
								<dl className="mt-2 flex flex-col gap-1.5">
									{[
										{ key: "book.briefGoal", value: plan.goal },
										{ key: "book.briefConflict", value: plan.conflict },
										{ key: "book.briefHook", value: plan.hook },
									].map((row) => (
										<div key={row.key} className="flex gap-2 text-[11px] leading-relaxed">
											<dt className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
												{t(row.key)}
											</dt>
											<dd className="min-w-0 flex-1 text-foreground">{row.value}</dd>
										</div>
									))}
								</dl>
							) : (
								<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t("book.briefNoPlan")}</p>
							)}
							<p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
								{chapter ? t("reader.updatedAt", { date: dateOf(chapter.updatedAt) }) : t("book.briefEmpty")}
							</p>
						</section>

						<InstructionCard
							instruction={instruction}
							busy={busy || handoffBusy}
							book={book}
							onContinue={onContinue}
							onAcceptBrief={onAcceptBrief}
							onStartDrafting={onStartDrafting}
							onCommit={onCommit}
							onCloseArc={onCloseArc}
							onFinalize={onFinalize}
						/>

						<section className={`${CARD} px-2 py-2`}>
							<header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 px-2 pb-1.5 pt-1">
								<span className="text-[11px] font-medium text-foreground">{t("book.activity")}</span>
								<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
									{t("book.activityMeta", { count: recent.length })}
								</span>
							</header>
							{recent.length === 0 ? (
								<p className="px-2 pb-2 text-[11px] text-muted-foreground">{t("book.activityEmpty")}</p>
							) : (
								<ol className="flex flex-col">
									{recent.map((checkpoint) => (
										<li
											key={`${checkpoint.at}-${checkpoint.chapter}`}
											className="flex min-w-0 items-baseline gap-2 rounded-[9px] px-2 py-1.5 text-[11px] transition-colors hover:bg-muted/50"
										>
											<span className="w-12 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
												{t("board.chapterLabel", { chapter: checkpoint.chapter })}
											</span>
											<span className="min-w-0 flex-1 truncate text-foreground">
												{t(checkpoint.noteKey, checkpoint.noteParams)}
											</span>
											<span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground/70">
												{dateOf(checkpoint.at)}
											</span>
										</li>
									))}
								</ol>
							)}
						</section>
					</div>

					<div className="flex w-full shrink-0 flex-col gap-4 xl:w-[340px]">
						{/* 目录自带表头（章数与「目录」），Panel 不再挂重复的一层。 */}
						<section className={`${CARD} px-2 py-2`}>
							<ChapterIndex
								chapters={book.chapters}
								volumes={book.volumes}
								currentChapter={current}
								selectedChapter={selectedChapter}
								onOpen={onOpenChapter}
							/>
						</section>

						<button
							type="button"
							onClick={onOpenLedger}
							className="flex min-w-0 items-center justify-between gap-2 rounded-[11px] border border-dashed border-border px-3.5 py-2.5 text-left transition-colors hover:bg-card"
						>
							<span className="flex min-w-0 flex-col gap-0.5">
								<span className="text-[12px] font-medium text-foreground">{t("book.ledger")}</span>
								<span className="text-[10px] text-muted-foreground">{t("book.ledgerHint")}</span>
							</span>
							<span aria-hidden="true" className="shrink-0 text-muted-foreground">
								→
							</span>
						</button>

						<div className="flex flex-wrap items-center gap-2">
							<MemberRoster members={STUDIO_MEMBERS} busy={handoffBusy} onInvite={onInvite} />
							<button
								type="button"
								onClick={onCopyManuscript}
								className="rounded-[9px] border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							>
								{t("action.copyManuscript")}
							</button>
							<CredentialChip entitlement={entitlement} onOpen={onOpenCredential} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
