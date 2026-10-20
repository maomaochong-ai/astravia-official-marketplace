import type { ReactNode } from "react";

export interface ToggleProps {
	checked: boolean;
	onChange(checked: boolean): void;
	label: ReactNode;
	/** 一句说明；解释开关影响什么。 */
	hint?: string;
	/** 行内已经有文案时只保留可访问名称，不再重复渲染。 */
	hideLabel?: boolean;
	disabled?: boolean;
}

/** 设置页的开关；用 role="switch" 让键盘与读屏都能操作。 */
export function Toggle({ checked, onChange, label, hint, disabled, hideLabel }: ToggleProps) {
	return (
		<div className="flex items-start gap-3 px-3.5 py-2.5">
			<div className={hideLabel ? "sr-only" : "min-w-0 flex-1"}>
				<div className="text-[12px] text-text">{label}</div>
				{hint ? <div className="mt-0.5 text-[10.5px] leading-relaxed text-text-4">{hint}</div> : null}
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={typeof label === "string" ? label : undefined}
				disabled={disabled}
				onClick={() => onChange(!checked)}
				className={`relative mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
					checked ? "bg-purple" : "bg-surface-4"
				}`}
			>
				<span
					className={`absolute top-0.5 size-3 rounded-full bg-surface transition-[left] ${checked ? "left-3.5" : "left-0.5"}`}
				/>
			</button>
		</div>
	);
}
