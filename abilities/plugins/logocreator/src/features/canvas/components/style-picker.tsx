import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STYLE_ENTRIES } from "../../../domain/catalog";
import { styleSampleUrl } from "../../../domain/sample-mark";
import { FOCUS_RING } from "../../../shared/styles/tokens";
import type { StyleId } from "../../../domain/spec";

export interface StylePickerProps {
	value: StyleId;
	onChange: (value: StyleId) => void;
}

/**
 * 八个风格，每格是**同一枚中性徽标**在该风格下的真实渲染。
 *
 * 上一版每格画一只动物：差异来自「动物画得好不好」，看起来像手绘（用户原话）。
 * 现在固定图形、只变风格配方，差别落在笔画重量、圆角与渐变上 —— 那才是这一格要回答的问题。
 *
 * 样张是引擎的产物而不是下载的图：外部图片不会是「这个风格做出来的东西」，
 * 用它预览等于骗选择。渲染结果按风格缓存一次，切表单不重算。
 */
export function StylePicker({ value, onChange }: StylePickerProps): JSX.Element {
	const { t } = useTranslation();
	const [hovered, setHovered] = useState<StyleId | null>(null);

	const previews = useMemo(
		() => STYLE_ENTRIES.map(entry => ({ id: entry.id, url: styleSampleUrl(entry.id) })),
		[],
	);

	return (
		<div role="radiogroup" aria-label={t("label.style")} className="grid grid-cols-4 gap-1.5">
			{STYLE_ENTRIES.map((entry, index) => {
				const active = entry.id === value;
				const preview = previews[index];
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
						<span className="block aspect-square w-full">
							<img src={preview?.url} alt="" className="size-full object-contain p-1.5" draggable={false} />
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
