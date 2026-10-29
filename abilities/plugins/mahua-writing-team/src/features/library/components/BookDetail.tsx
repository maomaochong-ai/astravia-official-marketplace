import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ChapterStatus, Instruction, NovelBook } from "../../../domain/novel-types.js";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";
import { STUDIO_MEMBERS } from "../../../studio-members.js";
import { PageBar } from "../../shared/components/PageBar.js";
import { Panel } from "../../shared/components/Panel.js";
import { BookHead } from "../../studio/components/BookHead.js";
import { CredentialChip } from "../../studio/components/CredentialChip.js";
import { InstructionCard } from "../../studio/components/InstructionCard.js";
import { MemberRoster } from "../../studio/components/MemberRoster.js";
import { dateOf, progressPercent } from "../bookshelf-model.js";
import { BookCover } from "./BookCover.js";
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
}

/** 设计稿那条 40 格的弧进度带：只统计当前弧，弧外的章不上带子。 */
const MAX_TICKS = 40;

const TICK: Record<ChapterStatus, string> = {
	planned: "bg-muted",
	drafting: "bg-primary",
	reviewed: "bg-primary/45",
	committed: "bg-primary/80",
	blocked: "bg-destructive",
};

/** 当前章所在的弧；没有弧（还没规划）时返回本书前 40 章，免得页面上留一块空白。 */
function arcOf(book: NovelBook, current: number) {
	const arcs = book.volumes.flatMap((volume) => volume.arcs);
	const hit = arcs.find((arc) => current >= arc.from && current <= arc.to) ?? null;
	if (hit) return { title: hit.title, goal: hit.goal, from: hit.from, to: Math.min(hit.to, hit.from + MAX_TICKS - 1) };
	return { title: "", goal: "", from: 1, to: Math.min(book.targetChapters, MAX_TICKS) };
}

/**
 * 书页（ADR 0013 §2.3 / ADR 0026 §2）：页头是「书名 + 阶段 + 下一步」，正文两栏。
 *
 * 左栏按设计稿 `book` 帧排：弧进度带 → 指令卡 → 最近发生；右栏是目录、伏笔账本入口与成员行。
 * 设计帧右栏固定 366px，这里 `xl` 才并排——标签页窄的时候右栏落到下面，目录不会把正文挤成一条。
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
}: BookDetailProps) {
	const { t } = useTranslation();
	const current = book.progress.currentChapter;
	const arc = arcOf(book, current);
	const arcChapters = Array.from({ length: Math.max(1, arc.to - arc.from + 1) }, (_, index) => {
		const n = arc.from + index;
		return book.chapters.find((chapter) => chapter.n === n)?.status ?? "planned";
	});
	const recent = [...book.checkpoints].slice(-4).reverse();

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageBar
				back={{ label: t("book.back"), onClick: onBack }}
				actions={
					<>
						<button
							type="button"
							onClick={() => onOpenChapter(current)}
							className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
						>
							{t("book.continueAt", { chapter: current })}
						</button>
						<button
							type="button"
							onClick={onContinue}
							disabled={handoffBusy}
							className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
						>
							{t("action.handoffContinue")}
						</button>
					</>
				}
			>
				<BookHead book={book} />
			</PageBar>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start">
					<div className="flex min-w-0 flex-1 flex-col gap-4">
						<Panel bodyClassName="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
							<BookCover
								seed={book.id}
								title={book.title}
								caption={book.genre}
								progress={progressPercent({
									committedCount: book.progress.committedCount,
									targetChapters: book.targetChapters,
								})}
								variant="headline"
							/>
							<div className="flex min-w-0 flex-1 flex-col gap-3">
								<p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
									{book.premise.trim() || t("library.card.noPremise")}
								</p>

								<div className="flex flex-col gap-1.5">
									<div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
										<span className="min-w-0 truncate">
											{arc.title || t("book.arcGoalNone")}
										</span>
										<span className="shrink-0 tabular-nums">
											{t("book.arcRange", { from: arc.from, to: arc.to })}
										</span>
									</div>
									<div className="flex flex-wrap gap-0.5" aria-hidden="true">
										{arcChapters.map((status, index) => (
											<span
												key={arc.from + index}
												className={`h-2 w-1.5 rounded-[1px] ${TICK[status]}`}
											/>
										))}
									</div>
									{arc.goal ? (
										<p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
											{arc.goal}
										</p>
									) : null}
								</div>
							</div>
						</Panel>

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

						<Panel title={t("book.activity")} meta={t("book.activityMeta", { count: recent.length })}>
							{recent.length === 0 ? (
								<p className="text-xs text-muted-foreground">{t("book.activityEmpty")}</p>
							) : (
								<ol className="flex flex-col gap-2">
									{recent.map((checkpoint) => (
										<li
											key={`${checkpoint.at}-${checkpoint.chapter}`}
											className="flex min-w-0 items-baseline gap-2 text-xs"
										>
											<span className="w-14 shrink-0 tabular-nums text-muted-foreground">
												{t("board.chapterLabel", { chapter: checkpoint.chapter })}
											</span>
											<span className="min-w-0 flex-1 truncate text-foreground">
												{t(checkpoint.noteKey, checkpoint.noteParams)}
											</span>
											<span className="shrink-0 tabular-nums text-muted-foreground/70">
												{dateOf(checkpoint.at)}
											</span>
										</li>
									))}
								</ol>
							)}
						</Panel>
					</div>

					<div className="flex w-full shrink-0 flex-col gap-4 xl:w-[340px]">
						<Panel
							title={t("book.index")}
							meta={t("book.indexCount", { count: book.chapters.length })}
							bodyClassName="px-2 py-2"
						>
							<ChapterIndex
								chapters={book.chapters}
								currentChapter={current}
								selectedChapter={selectedChapter}
								onOpen={onOpenChapter}
							/>
						</Panel>

						<button
							type="button"
							onClick={onOpenLedger}
							className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-left transition-colors hover:bg-muted/60"
						>
							<span className="flex min-w-0 flex-col gap-0.5">
								<span className="text-sm font-medium text-foreground">{t("book.ledger")}</span>
								<span className="text-xs text-muted-foreground">{t("book.ledgerHint")}</span>
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
								className="rounded-lg border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
