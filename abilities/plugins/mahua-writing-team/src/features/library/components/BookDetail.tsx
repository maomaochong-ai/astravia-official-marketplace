import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Instruction, NovelBook } from "../../../domain/novel-types.js";
import { STUDIO_MEMBERS } from "../../../studio-members.js";
import { progressPercent } from "../bookshelf-model.js";
import { BookCover } from "./BookCover.js";
import { BookHead } from "../../studio/components/BookHead.js";
import { ChapterIndex } from "./ChapterIndex.js";
import { CredentialChip } from "../../studio/components/CredentialChip.js";
import { InstructionCard } from "../../studio/components/InstructionCard.js";
import { MemberRoster } from "../../studio/components/MemberRoster.js";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";

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
	onInvite: (member: (typeof STUDIO_MEMBERS)[number]) => void;
	onOpenCredential: () => void;
	onAcceptBrief: () => void;
	onStartDrafting: () => void;
	onCommit: (n: number) => void;
	onCloseArc: () => void;
	onFinalize: () => void;
}

/**
 * 书页（ADR 0013 §2.3）：封面 + 元信息 + 「继续阅读」+ 成员胶囊 + 指令卡 + 目录。
 * 番茄在这个位置放的是「开始阅读」；我们放的是「继续阅读到第 N 章」——N 是路由给出的下一件事。
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
	onInvite,
	onOpenCredential,
	onAcceptBrief,
	onStartDrafting,
	onCommit,
	onCloseArc,
	onFinalize,
}: BookDetailProps) {
	const { t } = useTranslation();
	const current = book.progress.currentChapter;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-2">
				<button
					type="button"
					onClick={onBack}
					className="rounded-md border border-border/60 px-2 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
				>
					← {t("book.back")}
				</button>
				<MemberRoster members={STUDIO_MEMBERS} busy={handoffBusy} onInvite={onInvite} />
				<CredentialChip entitlement={entitlement} onOpen={onOpenCredential} />
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
				<section className="flex flex-wrap items-start gap-4">
					<BookCover
						title={book.title}
						caption={book.genre}
						progress={progressPercent({
							committedCount: book.progress.committedCount,
							targetChapters: book.targetChapters,
						})}
						variant="headline"
					/>
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<BookHead book={book} />
						<p className="max-w-prose text-sm text-muted-foreground">{book.premise}</p>
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={onContinue}
								className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
							>
								{t("book.continueAt", { chapter: current })}
							</button>
							<button
								type="button"
								onClick={() => onOpenChapter(current)}
								className="rounded-md border border-border/60 px-3 py-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
							>
								{t("book.read")}
							</button>
						</div>
					</div>
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

				<ChapterIndex
					chapters={book.chapters}
					currentChapter={current}
					selectedChapter={selectedChapter}
					onOpen={onOpenChapter}
				/>
			</div>
		</div>
	);
}
