import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STYLE_ENTRIES } from "../../../domain/catalog";
import { FOCUS_RING } from "../../../shared/styles/tokens";
import type { StyleId } from "../../../domain/spec";

// 风格占位图标：来自 Iconify 的 Lucide 集合（ISC 许可），随包分发、离线可用。
// 上一版每格用本地引擎渲染同一枚徽标：差异落在笔画与圆角上，看着像手绘草图，
// 也无法说明「这个风格是哪一类」。这里换成有语义的线性图标。
import minimalUrl from "../../../../assets/style/minimal.svg?url";
import geometricUrl from "../../../../assets/style/geometric.svg?url";
import luxuryUrl from "../../../../assets/style/luxury.svg?url";
import retroUrl from "../../../../assets/style/retro.svg?url";
import handDrawnUrl from "../../../../assets/style/hand-drawn.svg?url";
import threeDUrl from "../../../../assets/style/3d.svg?url";
import mascotUrl from "../../../../assets/style/mascot.svg?url";
import gradientUrl from "../../../../assets/style/gradient.svg?url";

const STYLE_ICONS: Record<StyleId, string> = {
	minimal: minimalUrl,
	geometric: geometricUrl,
	luxury: luxuryUrl,
	retro: retroUrl,
	"hand-drawn": handDrawnUrl,
	"3d": threeDUrl,
	mascot: mascotUrl,
	gradient: gradientUrl,
};

export interface StylePickerProps {
	value: StyleId;
	onChange: (value: StyleId) => void;
}

/**
 * 八个风格，每格一个语义图标 + 名称。
 *
 * 图标表示风格的**取向**（几何 / 奢华 / 复古 / 手绘 / 立体 / 吉祥物 / 渐变），
 * 不再假装是「这个风格渲染出来的样子」—— 真正的样子由宿主 AI 出图后出现在画布上。
 */
export function StylePicker({ value, onChange }: StylePickerProps): JSX.Element {
	const { t } = useTranslation();
	const [hovered, setHovered] = useState<StyleId | null>(null);

	return (
		<div role="radiogroup" aria-label={t("label.style")} className="grid grid-cols-4 gap-1.5">
			{STYLE_ENTRIES.map((entry) => {
				const active = entry.id === value;
				return (
					<button
						key={entry.id}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onChange(entry.id)}
						onMouseEnter={() => setHovered(entry.id)}
						onMouseLeave={() => setHovered(null)}
						title={t(entry.hintKey)}
						className={`${FOCUS_RING} overflow-hidden rounded-md border-0 transition-colors ${
							active ? "bg-primary/10 ring-1 ring-primary" : "bg-muted/40 hover:bg-muted/70"
						}`}
					>
						<span className="flex aspect-square w-full items-center justify-center">
							<img
								src={STYLE_ICONS[entry.id]}
								alt=""
								className={`size-1/2 object-contain ${active ? "opacity-100" : "opacity-70"}`}
								draggable={false}
							/>
						</span>
						<span
							className={`block truncate px-1 pb-1 text-[10px] font-medium ${
								active || hovered === entry.id ? "text-foreground" : "text-muted-foreground"
							}`}
						>
							{t(entry.labelKey)}
						</span>
					</button>
				);
			})}
		</div>
	);
}
