/**
 * REA 官方标记（与插件 assets/icon.svg 同一条路径）。
 *
 * 直接内联而不是 <img src>：面板可能在 320px 宽下渲染，
 * 内联 SVG 不额外发一次请求，也能跟着 sizeClass 精确缩放。
 * 底色与字形是品牌位图的一部分，不随宿主明暗主题变化。
 */

import type { JSX } from "react";

export interface ReaMarkProps {
	readonly sizeClass?: string;
	readonly className?: string;
	readonly title?: string;
}

export function ReaMark({ sizeClass = "size-8", className, title }: ReaMarkProps): JSX.Element {
	const parts = [sizeClass, "shrink-0", className ?? ""].filter(Boolean).join(" ");
	return (
		<svg viewBox="0 0 32 32" className={parts} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
			{title ? <title>{title}</title> : null}
			<rect width="32" height="32" rx="5" fill="#20252b" />
			<path
				fill="#fff"
				d="M9 7h7.5c5 0 7.5 2.3 7.5 6.2 0 2.8-1.4 4.7-4 5.6L25 25h-5l-4.5-5.8H13V25H9zm4 3.5v5.2h3.5c2.3 0 3.5-.8 3.5-2.6s-1.2-2.6-3.5-2.6z"
			/>
		</svg>
	);
}
