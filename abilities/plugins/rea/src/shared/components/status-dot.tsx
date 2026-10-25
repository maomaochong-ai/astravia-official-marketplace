/**
 * 状态圆点：一行里最省地方的「现在怎么样」。
 *
 * 设计稿的六种 tone 对应宿主里真实存在的六种结论：
 *   success 就绪 / 已命中   warning 缺失 / 待确认   danger 失败
 *   primary 进行中          agent 由 Agent 侧驱动   idle 没有信号
 *
 * 只有 primary 和 agent 允许呼吸（pulse），其余保持静止 —— 会动的东西
 * 必须真的在动，否则一排圆点全闪会让人分不清哪个在跑。
 */

import type { JSX } from "react";

export type StatusDotTone = "success" | "warning" | "danger" | "primary" | "agent" | "idle";

const TONE_CLASS: Record<StatusDotTone, string> = {
	success: "bg-sage-dark",
	warning: "bg-honey",
	danger: "bg-danger",
	primary: "bg-primary",
	agent: "bg-agent",
	idle: "bg-faint/50",
};

export interface StatusDotProps {
	readonly tone: StatusDotTone;
	readonly pulse?: boolean;
	readonly ring?: boolean;
	readonly className?: string;
	readonly title?: string;
}

export function StatusDot({ tone, pulse = false, ring = false, className, title }: StatusDotProps): JSX.Element {
	const parts = ["size-2 shrink-0 rounded-pill", TONE_CLASS[tone]];
	if (ring) parts.push("ring-2 ring-current/20");
	if (pulse) parts.push("motion-safe:animate-pulse");
	if (className) parts.push(className);
	return <span aria-hidden className={parts.join(" ")} title={title} />;
}
