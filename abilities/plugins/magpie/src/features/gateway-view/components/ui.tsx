/**
 * 面板自己的几个小件：按钮、字段、状态点、外框、外框里的一节。
 *
 * 为什么不用 `@astravia-org/ui`：那个包现在只导出主题视图（`ActivityStatusDot`、
 * `ContextMenuView` …），`Button` / `Input` / `cn` 已经不在顶层导出了。所以这里只用宿主的
 * **主题令牌**（`--card` / `--border` / `--muted-foreground` / `--primary` …，由
 * `@astravia-org/plugin-sdk/tailwind-theme.css` 暴露），不依赖任何宿主组件实现。
 *
 * 样式全部落在 `style.css` 的 `mp-*` 类里，而不是散在组件里的原子类：
 * 深浅两套主题的对比关系要一处算清（浅色主题的 border 压在卡面上几乎看不见），
 * 字号也只有一个出处。组件这一层只负责结构与语义。
 *
 * 版面只有两层：
 *
 *  - `Panel`    —— 整页**唯一**的圆角容器。所有设置都在它里面，不再并排两张卡。
 *  - `PanelSection` —— 容器里的一节，用发丝线分隔；节内可以再嵌输入框、表格等嵌套容器。
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Tone = "primary" | "outline" | "ghost";

export function Button({
	tone = "primary",
	className = "",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" }): ReactNode {
	return <button type="button" data-tone={tone} {...props} className={`mp-btn ${className}`} />;
}

export function Field({
	label,
	hint,
	className = "",
	...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }): ReactNode {
	return (
		<label className="block min-w-0">
			<span className="mp-label mb-1 block normal-case tracking-normal">{label}</span>
			<input {...props} className={`mp-field ${className}`} />
			{hint ? <span className="mp-meta mp-faint mt-1 block truncate">{hint}</span> : null}
		</label>
	);
}

/** 状态点：绿=在线、琥珀=进行中、红=失败、灰=未知。颜色由 `style.css` 的 token 决定。 */
export type DotTone = "ok" | "working" | "bad" | "idle";

export function StatusDot({ tone, pulse = false }: { tone: DotTone; pulse?: boolean }): ReactNode {
	return <span aria-hidden="true" data-tone={tone} className={`mp-dot ${pulse ? "animate-pulse" : ""}`} />;
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
		<section className={`mp-panel @container flex min-w-0 flex-col overflow-hidden ${className}`}>
			{title || aside ? (
				<header
					className="flex shrink-0 items-center justify-between gap-3 border-b px-3"
					style={{ borderColor: "var(--mp-rule-strong)", minHeight: 40 }}
				>
					<div className="flex min-w-0 flex-1 items-baseline gap-2">
						<div className="shrink-0">{title}</div>
						{subtitle ? <div className="mp-meta min-w-0 flex-1 truncate">{subtitle}</div> : null}
					</div>
					{aside ? <div className="flex shrink-0 items-center gap-1.5">{aside}</div> : null}
				</header>
			) : null}
			{children}
		</section>
	);
}

/**
 * 外框里的一节。
 *
 * 标题行是「小字标签 + 右侧元信息」；内容区留 8px 的节奏。`@container` 让节内的栅格
 * 按**本节**宽度决定，而不是按窗口——面板拖到 420px 时窗口往往还有 1400px。
 */
export function PanelSection({
	title,
	titleExtra,
	aside,
	children,
	className = "",
	padded = true,
}: {
	title?: ReactNode;
	titleExtra?: ReactNode;
	aside?: ReactNode;
	children: ReactNode;
	className?: string;
	padded?: boolean;
}): ReactNode {
	return (
		<div
			className={`@container min-w-0 border-t first:border-t-0 ${padded ? "px-3 py-2.5" : ""} ${className}`}
			style={{ borderColor: "var(--mp-rule)" }}
		>
			{title || aside ? (
				<div className="mb-2 flex min-w-0 items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						{title ? <span className="mp-label truncate">{title}</span> : null}
						{titleExtra ? <span className="flex min-w-0 items-center gap-1.5">{titleExtra}</span> : null}
					</div>
					{aside ? <span className="mp-meta flex shrink-0 items-center gap-1.5">{aside}</span> : null}
				</div>
			) : null}
			{children}
		</div>
	);
}

/** 一格 key/value：标签在上、值在下；值默认等宽（版本、路径、pid），可关掉。 */
export function Fact({
	label,
	value,
	mono = true,
}: {
	label: ReactNode;
	value: ReactNode;
	mono?: boolean;
}): ReactNode {
	return (
		<div className="min-w-0 px-2.5 py-1.5">
			<dt className="mp-label truncate">{label}</dt>
			<dd
				className={`mt-0.5 truncate ${mono ? "mp-mono" : "mp-body"}`}
				title={typeof value === "string" ? value : undefined}
			>
				{value}
			</dd>
		</div>
	);
}
