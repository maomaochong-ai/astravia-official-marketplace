import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Instruction, NovelBook } from "../../../domain/novel-types.js";
import { InstructionSummary } from "../../shared/components/InstructionSummary.js";

interface InstructionCardProps {
	instruction: Instruction | null;
	book: NovelBook;
	/** 交给对话里的团队去做（ADR 0011）：写作与评审必须模型参与，界面不代劳。 */
	onContinue(): void;
	onAcceptBrief(): void;
	onStartDrafting(): void;
	onCommit(n: number): void;
	onCloseArc(): void;
	onFinalize(): void;
	busy: boolean;
}

/** 主按钮取设计稿的「墨底」：`bg-ink` → `bg-foreground`，文字用纸色 `text-background`。 */
const PRIMARY =
	"flex h-8 items-center gap-1.5 rounded-[9px] bg-foreground px-3 text-[11px] font-medium text-background transition-opacity disabled:opacity-40";

/** 次按钮是描边款，同高对齐，避免两个高度并排时的错位。 */
const SECONDARY =
	"flex h-8 items-center gap-1.5 rounded-[9px] border border-border px-3 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40";

/**
 * "下一步"卡片：内容与模型通过 `mahua_next_instruction` 看到的是同一条路由结果，
 * 行内渲染也复用同一个 {@link InstructionSummary}，两处措辞不会分叉。
 *
 * 两类按钮分得很清：需要模型的一律走 [继续]（对话桥）；确定性步骤（提交、收弧、收尾）
 * 直接调服务，因为那是一步状态迁移，让模型转述只会多一次出错机会。
 */
export function InstructionCard({
	instruction,
	book,
	onContinue,
	onAcceptBrief,
	onStartDrafting,
	onCommit,
	onCloseArc,
	onFinalize,
	busy,
}: InstructionCardProps) {
	const { t } = useTranslation();

	if (!instruction) {
		return (
			<div className="rounded-[13px] border border-dashed border-border bg-muted/30 px-3.5 py-3 text-[11px] text-muted-foreground">
				{t("instruction.none")}
			</div>
		);
	}

	const deterministic = (() => {
		if (instruction.worker !== "engine") return null;
		switch (instruction.task) {
			case "commit-chapter":
				return (
					<button
						type="button"
						disabled={busy}
						onClick={() => instruction.chapter && onCommit(instruction.chapter)}
						className={PRIMARY}
					>
						<span className="icon-[solar--check-circle-linear] size-3.5" />
						{t("action.commit", { chapter: instruction.chapter ?? 0 })}
					</button>
				);
			case "close-arc":
				return (
					<button type="button" disabled={busy} onClick={onCloseArc} className={PRIMARY}>
						<span className="icon-[solar--checklist-minimalistic-linear] size-3.5" />
						{t("action.closeArc")}
					</button>
				);
			case "finalize":
				return (
					<button type="button" disabled={busy} onClick={onFinalize} className={PRIMARY}>
						<span className="icon-[solar--flag-2-linear] size-3.5" />
						{t("action.finalize")}
					</button>
				);
			case "outline-chapter":
				return (
					<button type="button" disabled={busy} onClick={onStartDrafting} className={SECONDARY}>
						<span className="icon-[solar--document-add-linear] size-3.5" />
						{t("action.startDrafting")}
					</button>
				);
			default:
				return null;
		}
	})();

	const primary =
		book.phase === "briefing" ? (
			<button
				type="button"
				disabled={busy || !book.title || !book.genre || !book.premise}
				onClick={onAcceptBrief}
				className={PRIMARY}
			>
				<span className="icon-[solar--check-circle-linear] size-3.5" />
				{t("action.acceptBrief")}
			</button>
		) : deterministic ? null : (
			<button type="button" disabled={busy} onClick={onContinue} className={PRIMARY}>
				<span className="icon-[solar--arrow-right-linear] size-3.5" />
				{t("action.continue")}
			</button>
		);

	return (
		<div className="flex flex-col gap-2.5 rounded-[13px] bg-card p-3.5 shadow-xs">
			<div className="flex items-baseline justify-between gap-2">
				<span className="font-serif text-[15px] font-semibold leading-tight text-foreground">
					{t("instruction.title")}
				</span>
				<span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
					{t("board.step")}
				</span>
			</div>
			<InstructionSummary
				worker={instruction.worker}
				task={instruction.task}
				detail={t(instruction.reasonKey, instruction.reasonParams)}
				chapter={instruction.chapter}
			/>
			<div className="flex flex-wrap items-center gap-2">
				{primary}
				{deterministic}
			</div>
		</div>
	);
}
