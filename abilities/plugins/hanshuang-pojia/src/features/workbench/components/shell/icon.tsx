import { createElement, type ReactNode } from "react";
import { ICON_PATHS, type IconNode } from "./icon-paths";

/**
 * 面板图标。图形不手写：从 @iconify-json 生成到 icon-paths.ts，
 * 由 scripts/sync-icons.mjs 维护，测试会核对与上游是否一致。
 *
 * 取图规则：导航用 solar bold（实心、小尺寸下更清晰），
 * 其余按钮与状态用 lucide 线性图标；颜色一律由 currentColor 决定。
 */

function renderNode(node: IconNode, key: number): ReactNode {
	const children = node.children?.map((child, index) => renderNode(child, index));
	return createElement(node.tag, { ...node.attrs, key }, ...(children ?? []));
}

export interface IconProps {
	name: keyof typeof ICON_PATHS | string;
	className?: string;
}

export function Icon({ name, className }: IconProps) {
	const nodes = ICON_PATHS[name] ?? ICON_PATHS.info!;
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? "size-4"}>
			{nodes.map((node, index) => renderNode(node, index))}
		</svg>
	);
}
