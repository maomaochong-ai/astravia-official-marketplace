import { coverMark } from "../bookshelf-model.js";
import { DefaultCover } from "./DefaultCover.js";

interface BookCoverProps {
	/** 封面哈希种子：书 id，缺省时退回书名（书页的大封面只拿到 title）。 */
	seed?: string;
	title: string;
	/** 封面下沿的说明行：架子上显示阶段，书页显示题材。不给就不占位。 */
	caption?: string;
	/** 0–100，只画一条进度，不写数字（数字在名字旁边）。不给就不画——书库卡片自己有一条。 */
	progress?: number;
	/** grid：架子上的一格；list：书库卡左侧；headline：书页左上的大封面。 */
	variant?: "grid" | "list" | "headline";
}

const SHAPE = {
	grid: "aspect-[3/4] w-full px-2.5 py-2.5",
	// 书库卡片的封面按番茄的 100×130 取整（ADR 0024 §2），不参与栅格拉伸。
	list: "h-[130px] w-[100px] shrink-0 px-2.5 py-2.5",
	headline: "h-32 w-24 px-2 py-2",
} as const;

const MARK = {
	grid: "text-2xl",
	list: "text-xl",
	headline: "text-xl",
} as const;

/**
 * 排版型封面（ADR 0013 §2.2 / 0020 §4 / 0024 §3）：书名首字 + 水墨底版 + 进度条。
 * 不塞占位插画，也不上色卡——底版先灰度再 multiply 到 `accent`，颜色仍只来自宿主 token。
 */
export function BookCover({ seed, title, caption, progress, variant = "grid" }: BookCoverProps) {
	// 书库卡片已经把题材、阶段写在右侧，封面里再来一行小字就是重复。
	const showCaption = variant !== "list" && Boolean(caption);
	const showProgress = typeof progress === "number";
	return (
		<div
			aria-hidden="true"
			className={`relative flex flex-col justify-between overflow-hidden rounded-lg border border-border/60 bg-accent text-accent-foreground ${SHAPE[variant]}`}
		>
			<DefaultCover seed={seed ?? title} />
			<span className={`relative font-semibold leading-none ${MARK[variant]}`}>{coverMark(title)}</span>
			<div className="relative flex min-w-0 flex-col gap-1">
				{showCaption ? (
					<span className="truncate text-[0.625rem] uppercase tracking-wide text-accent-foreground/60">
						{caption}
					</span>
				) : null}
				{showProgress ? (
					<span className="block h-0.5 w-full overflow-hidden rounded-full bg-foreground/15">
						<span
							className="block h-full rounded-full bg-foreground/40"
							style={{ width: `${progress}%` }}
						/>
					</span>
				) : null}
			</div>
		</div>
	);
}
