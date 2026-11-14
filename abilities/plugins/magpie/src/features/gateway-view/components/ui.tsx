/**
 * 面板自己的几个小件：按钮、字段、状态点、卡片。
 *
 * 为什么不用 `@astravia-org/ui`：那个包现在只导出主题视图（`ActivityStatusDot`、
 * `ContextMenuView` …），`Button` / `Input` / `cn` 已经不在顶层导出了 —— 0.1.3 的面板
 * 一直在 import 三个不存在的成员，这既是类型错误，也是它看起来「不像宿主」的原因之一。
 *
 * 所以这里只用宿主的**主题令牌**（`bg-card` / `border-border` / `text-muted-foreground` /
 * `bg-primary` …，由 `@astravia-org/plugin-sdk/tailwind-theme.css` 暴露），不依赖任何
 * 宿主组件实现。换主题（亮/暗、不同主题包）时这些类跟着变量走，不需要改代码。
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Tone = "primary" | "outline" | "ghost" | "danger";

const TONE: Record<Tone, string> = {
	primary: "bg-primary text-primary-foreground hover:bg-primary/90 border-primary",
	outline: "border-border bg-card text-foreground hover:bg-muted/60",
	ghost: "border-transparent bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
	danger: "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
};

export function Button({
	tone = "primary",
	size = "md",
	className = "",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" }): ReactNode {
	const sizing = size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm";
	return (
		<button
			type="button"
			{...props}
			className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${TONE[tone]} ${className}`}
		/>
	);
}

export function Field({
	label,
	hint,
	className = "",
	...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }): ReactNode {
	return (
		<label className="block">
			<span className="mb-1 block text-xs font-medium text-foreground">{label}</span>
			<input
				{...props}
				className={`h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-foreground/40 ${className}`}
			/>
			{hint ? <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span> : null}
		</label>
	);
}

/** 状态点：绿=在线、琥珀=进行中、红=失败、灰=未知。 */
export type DotTone = "ok" | "working" | "bad" | "idle";

const DOT: Record<DotTone, string> = {
	ok: "bg-emerald-500",
	working: "bg-amber-500",
	bad: "bg-destructive",
	idle: "bg-muted-foreground/50",
};

export function StatusDot({ tone, pulse = false }: { tone: DotTone; pulse?: boolean }): ReactNode {
	return (
		<span
			aria-hidden="true"
			className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]} ${pulse ? "animate-pulse" : ""}`}
		/>
	);
}

export function Card({
	title,
	aside,
	children,
	className = "",
}: {
	title?: ReactNode;
	aside?: ReactNode;
	children: ReactNode;
	className?: string;
}): ReactNode {
	return (
		<section className={`rounded-xl border border-border bg-card p-4 text-card-foreground ${className}`}>
			{title || aside ? (
				<div className="mb-3 flex items-start justify-between gap-3">
					<div className="min-w-0 text-sm font-medium">{title}</div>
					{aside ? <div className="shrink-0">{aside}</div> : null}
				</div>
			) : null}
			{children}
		</section>
	);
}

/** 一行 key/value，右对齐的值可以是等宽字体（版本、路径、pid）。 */
export function Fact({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }): ReactNode {
	return (
		<div className="min-w-0">
			<dt className="text-[11px] text-muted-foreground">{label}</dt>
			<dd className={`mt-0.5 truncate text-xs ${mono ? "font-mono" : ""}`} title={typeof value === "string" ? value : undefined}>
				{value}
			</dd>
		</div>
	);
}
