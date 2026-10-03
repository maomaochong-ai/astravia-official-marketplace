/**
 * 通用右键菜单 — 连接树、结果网格等共用。
 *
 * 纯受控：调用方给出屏幕坐标和菜单项；点击外部 / Esc / 滚动时关闭。
 * 用 fixed 定位 + portal，避免被父级 overflow 裁剪；边界自动翻转。
 */

import { useEffect, useLayoutEffect, useRef, type JSX, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
	type: "item";
	label: string;
	icon?: string;
	disabled?: boolean;
	danger?: boolean;
	onClick: () => void;
}
export interface ContextMenuSeparator {
	type: "separator";
}
export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

export interface ContextMenuState {
	x: number;
	y: number;
	items: ContextMenuEntry[];
}

const MENU_WIDTH = 208;

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }): JSX.Element {
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ left: menu.x, top: menu.y });

	// 边界检测：超出视口则翻转 / 贴边。
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const { height } = el.getBoundingClientRect();
		const left = Math.max(4, Math.min(menu.x, window.innerWidth - MENU_WIDTH - 4));
		const top = Math.max(4, Math.min(menu.y, window.innerHeight - height - 4));
		setPos({ left, top });
	}, [menu.x, menu.y]);

	useEffect(() => {
		const close = onClose;
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) close();
		};
		// 页面滚动 / 窗口失焦时菜单已无意义。
		const onScroll = () => close();
		document.addEventListener("keydown", onKey, true);
		document.addEventListener("mousedown", onDown, true);
		document.addEventListener("scroll", onScroll, true);
		window.addEventListener("blur", close);
		return () => {
			document.removeEventListener("keydown", onKey, true);
			document.removeEventListener("mousedown", onDown, true);
			document.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("blur", close);
		};
	}, [onClose]);

	return createPortal(
		<div
			ref={ref}
			role="menu"
			className="dbx-context-menu fixed z-[9999] min-w-0 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl shadow-black/40"
			style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
			onContextMenu={(e) => e.preventDefault()}
		>
			{menu.items.map((entry, index) =>
				entry.type === "separator" ? (
					<div key={`sep-${index}`} className="my-1 h-px bg-border" />
				) : (
					<button
						key={entry.label}
						type="button"
						role="menuitem"
						disabled={entry.disabled}
						className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
							entry.danger
								? "text-red-400 hover:bg-red-500/15"
								: "text-zinc-200 hover:bg-accent hover:text-accent-foreground"
						}`}
						onClick={() => {
							onClose();
							entry.onClick();
						}}
					>
						{entry.icon && <span className={`h-3.5 w-3.5 shrink-0 ${entry.icon}`} />}
						<span className="min-w-0 flex-1 truncate">{entry.label}</span>
					</button>
				),
			)}
		</div>,
		document.body,
	);
}
