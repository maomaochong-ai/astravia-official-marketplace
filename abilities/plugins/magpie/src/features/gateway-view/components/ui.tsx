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
		/* 0.3.0：卡片变成「外框里的一节」——不再自带圆角与边框，
		   只留内边距与一条上分隔线。嵌进 gateway-view 的列容器后，视觉上是同一条面板里的几段。 */
		<section className={`border-t border-border/70 bg-transparent p-3 text-card-foreground first:border-t-0 ${className}`}>
			{title || aside ? (
				<div className="mb-2 flex items-start justify-between gap-3">
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

/**
 * 外框：一张面板里放多段内容，用发丝线分隔。
 *
 * 为什么不再用一堆 Card：卡与卡之间的 gap 是纯留白，越窄越明显。嵌套容器把留白变成
 * **分隔线**——同样的信息占更少的像素，读起来也更像一个工具而不是一排便签。
 */
export function Panel({
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
		<section className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground ${className}`}>
			{title || aside ? (
				<div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
					<div className="min-w-0 truncate text-xs font-medium">{title}</div>
					{aside ? <div className="flex shrink-0 items-center gap-1.5">{aside}</div> : null}
				</div>
			) : null}
			{children}
		</section>
	);
}

/** 面板里的一节：与上一条发丝线相隔，内边距一致（3 = 12px，比 Card 的 16 更紧凑）。 */
export function PanelSection({
	title,
	aside,
	children,
	className = "",
	padded = true,
}: {
	title?: ReactNode;
	aside?: ReactNode;
	children: ReactNode;
	className?: string;
	padded?: boolean;
}): ReactNode {
	return (
		<div className={`min-w-0 border-t border-border/70 first:border-t-0 ${padded ? "px-3 py-2.5" : ""} ${className}`}>
			{title || aside ? (
				<div className="mb-1.5 flex items-center justify-between gap-2">
					<span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
					{aside ? <span className="flex shrink-0 items-center gap-1.5">{aside}</span> : null}
				</div>
			) : null}
			{children}
		</div>
	);
}
