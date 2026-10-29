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
			<div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
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
						className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
					>
						{t("action.commit", { chapter: instruction.chapter ?? 0 })}
					</button>
				);
			case "close-arc":
				return (
					<button
						type="button"
						disabled={busy}
						onClick={onCloseArc}
						className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
					>
						{t("action.closeArc")}
					</button>
				);
			case "finalize":
				return (
					<button
						type="button"
						disabled={busy}
						onClick={onFinalize}
						className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
					>
						{t("action.finalize")}
					</button>
				);
			case "outline-chapter":
				return (
					<button
						type="button"
						disabled={busy}
						onClick={onStartDrafting}
						className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60 disabled:opacity-50"
					>
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
				className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
			>
				{t("action.acceptBrief")}
			</button>
		) : deterministic ? null : (
			<button
				type="button"
				disabled={busy}
				onClick={onContinue}
				className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
			>
				{t("action.continue")}
			</button>
		);

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4">
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
