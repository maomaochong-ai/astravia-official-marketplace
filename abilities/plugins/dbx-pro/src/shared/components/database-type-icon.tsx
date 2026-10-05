/**
 * 数据库类型品牌图标 — 连接编辑器类型卡片 / 连接管理仪表盘共用。
 *
 * 走本地内置品牌图形（resolveDatabaseIcon，零网络依赖）；找不到品牌 logo 时
 * 回退到中性的通用数据库图标，不伪造彩色字母块。
 * 纯展示组件：只接收 props，不读服务 / 持久化状态。
 */

import { useState, type JSX } from "react";
import { resolveDatabaseIcon } from "../../domain/database-icons";

export type DatabaseTypeIconSize = "small" | "medium" | "large";

const CLASS_BY_SIZE: Record<DatabaseTypeIconSize, string> = {
	small: "h-5 w-5",
	medium: "h-8 w-8",
	large: "h-10 w-10",
};

/** 按插件根背景亮度判断当前是否深色主题（兼容宿主强制主题）。 */
function detectDark(): boolean {
	const root = document.querySelector('[data-astravia-plugin-root="dbx-pro"]');
	const bg = root ? getComputedStyle(root).backgroundColor : "";
	const m = bg.match(/\d+(?:\.\d+)?/g);
	if (!m || m.length < 3) return true;
	const [r, g, b] = m.slice(0, 3).map(Number);
	return 0.299 * r + 0.587 * g + 0.114 * b < 90;
}

export function DatabaseTypeIcon({
	dbType,
	size = "medium",
}: {
	dbType: string;
	size?: DatabaseTypeIconSize | number;
}): JSX.Element {
	const [isDark] = useState(detectDark);
	const icon = resolveDatabaseIcon(dbType, isDark);

	if (!icon) {
		// 通用数据库图形：明确的中性兜底，不伪造品牌
		const cls = typeof size === "number" ? "" : CLASS_BY_SIZE[size];
		const innerCls = size === "small" ? "h-4 w-4" : "h-5 w-5";
		return (
			<span
				className={`${cls} flex items-center justify-center text-muted-foreground`}
				style={typeof size === "number" ? { width: size, height: size } : undefined}
			>
				<span className={`icon-[lucide--database] ${innerCls}`} />
			</span>
		);
	}

	const cls = typeof size === "number" ? "" : CLASS_BY_SIZE[size];
	return (
		<span
			className={`${cls} flex items-center justify-center overflow-hidden`}
			style={typeof size === "number" ? { width: size, height: size } : undefined}
		>
			<img
				src={icon.src}
				alt=""
				aria-hidden="true"
				className="h-full w-full object-contain"
				style={{
					transform: `scale(${icon.scale ?? 1})`,
					...(icon.darkFilter ? { filter: icon.darkFilter } : {}),
				}}
			/>
		</span>
	);
}
