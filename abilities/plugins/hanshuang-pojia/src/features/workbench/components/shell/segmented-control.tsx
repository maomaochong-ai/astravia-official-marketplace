import { useId } from "react";

export interface SegmentedControlItem<T extends string> {
	value: T;
	label: string;
}

export interface SegmentedControlProps<T extends string> {
	value: T;
	onValueChange(value: T): void;
	items: readonly SegmentedControlItem<T>[];
	/** 可访问名称。 */
	ariaLabel?: string;
	/** 尺寸：sm 更紧凑。 */
	size?: "sm" | "md";
}

/**
 * 分段控件：在几个互斥选项之间切换。
 * 用于提示词库的注入模式、注入方式切换等场景。
 */
export function SegmentedControl<T extends string>({
	value,
	onValueChange,
	items,
	ariaLabel,
	size = "md",
}: SegmentedControlProps<T>) {
	const id = useId();
	const padding = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]";
	return (
		<div
			role="radiogroup"
			aria-label={ariaLabel}
			className="inline-flex items-center rounded-md border border-line bg-surface-3 p-0.5"
		>
			{items.map(item => {
				const active = item.value === value;
				return (
					<button
						key={item.value}
						type="button"
						role="radio"
						aria-checked={active}
						id={`${id}-${item.value}`}
						onClick={() => onValueChange(item.value)}
						className={`rounded-[4px] font-medium transition-colors ${padding} ${
							active ? "bg-text text-surface" : "text-text-3 hover:text-text"
						}`}
					>
						{item.label}
					</button>
				);
			})}
		</div>
	);
}
