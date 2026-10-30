import { useTranslation } from "@astravia-org/plugin-sdk";
import { DEFAULT_READER_SCALE, READER_SCALES } from "../bookshelf-model.js";

interface ReaderControlsProps {
	scale: number;
	canPrev: boolean;
	canNext: boolean;
	onScale: (next: number) => void;
	onPrev: () => void;
	onNext: () => void;
}

/**
 * 阅读页底栏（ADR 0013 §2.4，样式按设计稿 `reader` 帧的页头条再收一版）。
 *
 * 设计稿的字号组是一块「槽里嵌纸片」的分段控件：`bg-inset p-px` 的槽，选中那格是
 * `bg-card shadow-card` 的纸片，中间夹一个等宽数字读数——不是五个圆点。
 * 圆点只能看出「到第几档」，看不出「正文现在几号字」，所以这里换成读数。
 * 翻页按钮仍贴着正文列两侧；番茄的夜间开关不复刻，明暗归宿主主题管（ADR 0006）。
 */
export function ReaderControls({ scale, canPrev, canNext, onScale, onPrev, onNext }: ReaderControlsProps) {
	const { t } = useTranslation();

	const moveClass =
		"flex-1 rounded-[9px] border border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40";
	const stepClass =
		"flex size-7 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground";
	const resetClass =
		"flex h-7 items-center rounded-[7px] px-2 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground";

	return (
		<div className="flex shrink-0 items-center gap-3 border-t border-border/60 bg-background px-3 py-2">
			<button type="button" onClick={onPrev} disabled={!canPrev} className={moveClass}>
				{t("reader.prev")}
			</button>

			<div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={t("reader.font")}>
				<div className="flex h-7 items-center rounded-[9px] bg-muted p-px">
					<button
						type="button"
						onClick={() => onScale(scale - 1)}
						disabled={scale <= 0}
						className={stepClass}
						aria-label={t("reader.fontSmaller")}
					>
						<span aria-hidden="true" className="icon-[solar--minus-linear] size-3" />
					</button>
					<span className="w-9 text-center font-mono text-[10px] tabular-nums text-foreground" aria-live="polite">
						{READER_SCALES[scale] ?? READER_SCALES[DEFAULT_READER_SCALE]}
					</span>
					<button
						type="button"
						onClick={() => onScale(scale + 1)}
						disabled={scale >= READER_SCALES.length - 1}
						className={stepClass}
						aria-label={t("reader.fontLarger")}
					>
						<span aria-hidden="true" className="icon-[solar--add-linear] size-3" />
					</button>
				</div>
				<button
					type="button"
					onClick={() => onScale(DEFAULT_READER_SCALE)}
					disabled={scale === DEFAULT_READER_SCALE}
					className={resetClass}
				>
					{t("reader.fontReset")}
				</button>
			</div>

			<button type="button" onClick={onNext} disabled={!canNext} className={moveClass}>
				{t("reader.next")}
			</button>
		</div>
	);
}
