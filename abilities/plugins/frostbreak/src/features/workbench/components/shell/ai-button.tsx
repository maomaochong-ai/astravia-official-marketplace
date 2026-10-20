import { Icon } from "./icon";

export interface AiButtonProps {
	label: string;
	onClick(): void;
	/** 发送中：按钮禁用并换成转圈，避免连点发出多条一样的指令。 */
	busy?: boolean;
	disabled?: boolean;
	/** 只要图标，用于表格行内的「让 AI 解释」。 */
	compact?: boolean;
}

/**
 * 面板里唯一的紫色元素：所有「让 AI …」入口都用它。
 * 紫色是设计稿里 AI 协作的专用语义色，不用于风险等级。
 */
export function AiButton({ label, onClick, busy, disabled, compact }: AiButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || busy}
			aria-busy={busy || undefined}
			title={label}
			className={`inline-flex items-center gap-1.5 rounded-md border border-purple/40 bg-purple/10 font-medium text-purple transition-colors hover:bg-purple/20 disabled:opacity-50 ${
				compact ? "px-1.5 py-1 text-[10px]" : "px-2.5 py-1 text-[11px]"
			}`}
		>
			<Icon name={busy ? "refresh" : "sparkle"} className={`size-3 ${busy ? "motion-safe:animate-spin" : ""}`} />
			<span className={compact ? "sr-only" : "whitespace-nowrap"}>{label}</span>
		</button>
	);
}
