import { coverMark } from "../bookshelf-model.js";
import { DefaultCover } from "./DefaultCover.js";

/** 五档尺寸照设计稿 `Cover`：书架大封、书库行封、书页详封、侧栏小封、台账微封。 */
export type CoverSize = "shelf" | "row" | "detail" | "mini" | "thumb";

interface BookCoverProps {
	/** 哈希种子：书 id，缺省时退回书名。改名不该换底纹。 */
	seed?: string;
	title: string;
	/** 封面下沿的说明行：架子上显示阶段，书页显示题材。不给就不占位。 */
	caption?: string;
	size?: CoverSize;
}

const SHAPE: Record<CoverSize, string> = {
	shelf: "h-[212px] w-[150px] gap-3 px-3 py-3",
	row: "h-[124px] w-[88px] gap-2 px-2 py-2",
	detail: "h-[184px] w-[132px] gap-2 px-2.5 py-2.5 sm:h-[262px] sm:w-[186px] sm:gap-3 sm:px-3.5 sm:py-3.5",
	mini: "h-[62px] w-[44px] gap-1 px-1 py-1",
	thumb: "h-[46px] w-[33px] px-0.5 py-0.5",
};

/** 首字的字号：设计稿 mark 62 / 34 / 76 / 17 / 12，按容器宽度档位缩放。 */
const MARK: Record<CoverSize, string> = {
	shelf: "text-[38px] sm:text-[48px]",
	row: "text-[24px]",
	detail: "text-[34px] sm:text-[52px]",
	mini: "text-[17px]",
	thumb: "text-[12px]",
};

/**
 * 排版型封面（ADR 0020 §4 / 0024 §3 / 0027 §3）。
 *
 * 设计稿的封面是「三层纸 + 一枚首字 + 一行说明」：不带插画，靠纸色与字重拉开层次。
 * 这里保留那个结构，只把设计稿的 `canvas / surface / card` 三级纸色换成宿主的中性档
 * （`bg-muted` → `bg-background`），底纹仍是 `COVER_PLATES` 里的公有领域水墨，
 * 用 `multiply` 压到很低的浓度——它提供纸纤维的质感，不抢首字。
 */
export function BookCover({ seed, title, caption, size = "row" }: BookCoverProps) {
	const showCaption = Boolean(caption) && size !== "thumb";
	return (
		<div
			aria-hidden="true"
			className={`relative flex shrink-0 flex-col overflow-hidden rounded-[3px] border border-border/70 bg-muted shadow-sm ${SHAPE[size]}`}
		>
			<span aria-hidden="true" className="absolute inset-0 opacity-[0.18]">
				<DefaultCover seed={seed ?? title} />
			</span>
			{size === "thumb" ? null : (
				<span
					aria-hidden="true"
					className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-background/40 to-transparent"
				/>
			)}
			<span
				className={`relative font-serif font-semibold leading-none text-foreground ${
					size === "thumb" ? "m-auto" : ""
				} ${size === "shelf" || size === "detail" ? "mt-auto" : ""} ${MARK[size]}`}
			>
				{coverMark(title)}
			</span>
			{showCaption ? (
				<span className="relative truncate font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
					{caption}
				</span>
			) : null}
		</div>
	);
}
