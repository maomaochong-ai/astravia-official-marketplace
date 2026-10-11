/**
 * 插件根容器 — 面板级 UI（加载态 / 错误态 / 工作区）的最外层元素。
 *
 * 宿主只在 <html> 上写主题（data-mode），而插件样式被 plugin-vite 包进
 * @scope ([data-astravia-plugin-root="dbx-pro"])，作用域内匹配不到 html[data-mode]；
 * 宿主还会在插件根外面再包一层自建的同名容器。所以明暗结论只能由插件写到
 * 自己的根属性上（data-dbx-theme）。这里把它做成声明式渲染：首帧就带属性，
 * 并订阅宿主主题变化 —— 只靠挂载后的副作用补属性，首帧会先按默认/系统色板画一遍。
 */

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useDetectedTheme } from "../hooks/use-detected-theme";

export function PluginRoot({
	className,
	style,
	children,
}: {
	className: string;
	style?: CSSProperties;
	children: ReactNode;
}): ReactElement {
	const theme = useDetectedTheme();
	return (
		<div
			data-astravia-plugin-root="dbx-pro"
			data-dbx-theme={theme}
			className={className}
			style={style}
		>
			{children}
		</div>
	);
}
