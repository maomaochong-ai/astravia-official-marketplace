/**
 * 面板自己的几个小件：按钮、字段、状态点、外框、外框里的一节。
 *
 * 为什么不用 `@astravia-org/ui`：那个包现在只导出主题视图（`ActivityStatusDot`、
 * `ContextMenuView` …），`Button` / `Input` / `cn` 已经不在顶层导出了。所以这里只用宿主的
 * **主题令牌**（`bg-card` / `border-border` / `text-muted-foreground` / `bg-primary` …，
 * 由 `@astravia-org/plugin-sdk/tailwind-theme.css` 暴露），不依赖任何宿主组件实现。
 *
 * 版面只有两层：
 *
 *  - `Panel`    —— 整页**唯一**的圆角容器。所有设置都在它里面，不再并排两张卡。
 *  - `PanelSection` —— 容器里的一节，用发丝线分隔；节内可以再放圆角输入框、表格等嵌套容器。
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
		<label className="block min-w-0">
			<span className="mb-1 block text-xs font-medium text-foreground">{label}</span>
			<input
				{...props}
				className={`h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-foreground/40 ${className}`}
			/>
			{hint ? <span className="mt-1 block truncate text-[11px] text-muted-foreground">{hint}</span> : null}
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

/**
 * 外框：整页唯一的圆角容器。
 *
 * 以前左列一张卡、右列一张卡，中间一条 gap —— 窄屏时那就是被浪费的高度，读起来也像两块
 * 互不相干的东西。现在只有一框，设置项在框内按节嵌套。
 */
export function Panel({
	title,
	subtitle,
	aside,
	children,
	className = "",
}: {
	title?: ReactNode;
	subtitle?: ReactNode;
	aside?: ReactNode;
	children: ReactNode;
	className?: string;
}): ReactNode {
	return (
		<section
			className={`@container flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground ${className}`}
		>
			{title || aside ? (
				<div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<div className="shrink-0">{title}</div>
						{subtitle ? <div className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{subtitle}</div> : null}
					</div>
					{aside ? <div className="flex shrink-0 items-center gap-1.5">{aside}</div> : null}
				</div>
			) : null}
			{children}
		</section>
	);
}

/** 外框里的一节：一条发丝线与上一节相隔，可再嵌输入框、表格等自己的圆角容器。 */
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
		<div className={`@container min-w-0 border-t border-border/70 first:border-t-0 ${padded ? "px-3 py-2.5" : ""} ${className}`}>
			{title || aside ? (
				<div className="mb-2 flex items-center justify-between gap-2">
					<span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						{title}
					</span>
					{aside ? <span className="flex shrink-0 items-center gap-1.5">{aside}</span> : null}
				</div>
			) : null}
			{children}
		</div>
	);
}

/** 一格 key/value：标签小字在上，值在下；值可以是等宽字体（版本、路径、pid）。 */
export function Fact({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }): ReactNode {
	return (
		<div className="min-w-0">
			<dt className="text-[11px] text-muted-foreground">{label}</dt>
			<dd
				className={`mt-0.5 truncate text-xs ${mono ? "font-mono" : ""}`}
				title={typeof value === "string" ? value : undefined}
			>
				{value}
			</dd>
		</div>
	);
}
