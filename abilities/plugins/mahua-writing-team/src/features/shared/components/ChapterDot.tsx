import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ChapterStatus } from "../../../domain/novel-types.js";

/**
 * 目录树里的一枚状态点。设计稿用绿/绿空心/墨/虚线四档区分「已提交 / 已评审 / 在写 / 待写」，
 * 宿主没有绿色令牌，于是改成同一支强调色的四个浓淡：实心 = 已落盘，半实心 = 评审过，
 * 带光圈 = 正在写，空心 = 还没排到（ADR 0026 §3）。
 */
const DOT: Record<ChapterStatus, string> = {
	planned: "border border-border bg-transparent",
	drafting: "bg-primary ring-2 ring-primary/25",
	reviewed: "bg-primary/45",
	committed: "bg-primary",
	blocked: "bg-destructive",
};

/** 只表达状态，不做装饰：颜色全部来自宿主语义令牌，跟随用户主题（ADR 0006）。 */
export function ChapterDot({ status }: { status: ChapterStatus }) {
	const { t } = useTranslation();
	const label = t(`status.${status}`);
	return (
		<span
			role="img"
			aria-label={label}
			title={label}
			className={`inline-block size-1.5 shrink-0 self-center rounded-full ${DOT[status]}`}
		/>
	);
}
