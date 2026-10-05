/**
 * 通用右键菜单 — 连接树、结果网格等共用。
 *
 * 纯受控：调用方给出屏幕坐标和菜单项；点击外部 / Esc / 滚动时关闭。
 *
 * 定位约束（宿主插件样式规则）：
 * - 不 portal 到 document.body：会逃出插件 @scope，样式全部失效；
 *   全屏时 body 上的节点也不会被渲染。
 * - 不使用 fixed：面板类 UI 必须留在面板矩形内。
 * 做法：portal 到本面板根（.dbx-root，position: relative），
 * 用相对面板根的绝对坐标定位，边界翻转也按面板根矩形计算。
 */

import { useEffect, useLayoutEffect, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
	type: "item";
	label: string;
	icon?: string;
	disabled?: boolean;
	danger?: boolean;
	onClick: () => void;
}

export interface ContextMenuSubmenu {
	type: "submenu";
	label: string;
	icon?: string;
	items: ContextMenuEntry[];
}

export interface ContextMenuSeparator {
	type: "separator";
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSubmenu | ContextMenuSeparator;

export interface ContextMenuState {
	x: number;
	y: number;
	items: ContextMenuEntry[];
}

const MENU_WIDTH = 208;
const VIEWPORT_MARGIN = 4;

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }): JSX.Element | null {
	const ref = useRef<HTMLDivElement>(null);
	// 隐藏锚点：它随组件渲染在插件树内，用来向上找到面板根作为 portal 目标。
	const anchorRef = useRef<HTMLSpanElement>(null);
	const [panelRoot, setPanelRoot] = useState<Element | null>(null);
	const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
	const [submenuState, setSubmenuState] = useState<{ index: number; y: number } | null>(null);

	useLayoutEffect(() => {
		const root = anchorRef.current?.closest(".dbx-root") ?? null;
		setPanelRoot(root);
	}, []);

	// 边界检测：屏幕坐标 → 面板根相对坐标；超出面板则翻转 / 贴边。
	useLayoutEffect(() => {
		const rootRect = panelRoot?.getBoundingClientRect();
		const menuRect = ref.current?.getBoundingClientRect();
		if (!rootRect || !menuRect) return;
		const leftWithin = Math.max(
			VIEWPORT_MARGIN,
			Math.min(menu.x, rootRect.right - MENU_WIDTH - VIEWPORT_MARGIN),
		);
		const topWithin = Math.max(
			VIEWPORT_MARGIN,
			Math.min(menu.y, rootRect.bottom - menuRect.height - VIEWPORT_MARGIN),
		);
		setPos({ left: leftWithin - rootRect.left, top: topWithin - rootRect.top });
	}, [menu.x, menu.y, panelRoot]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (submenuState) setSubmenuState(null); else onClose(); } };
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		// 页面滚动 / 窗口失焦时菜单已无意义。
		const onScroll = () => onClose();
		document.addEventListener("keydown", onKey, true);
		document.addEventListener("mousedown", onDown, true);
		document.addEventListener("scroll", onScroll, true);
		window.addEventListener("blur", onClose);
		return () => {
			document.removeEventListener("keydown", onKey, true);
			document.removeEventListener("mousedown", onDown, true);
			document.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("blur", onClose);
		};
	}, [onClose, submenuState]);

	// 锚点始终占位；菜单内容在找到面板根后 portal 进去。
	return (
		<>
			<span ref={anchorRef} style={{ display: "none" }} aria-hidden="true" />
			{panelRoot &&
				createPortal(
					<div
						ref={ref}
						role="menu"
						className="dbx-context-menu absolute z-[300] min-w-0 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl shadow-black/40"
						style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
						onContextMenu={(e) => e.preventDefault()}
					>
						{menu.items.map((entry, index) => {
							if (entry.type === "separator") {
								return <div key={`sep-${index}`} className="my-1 h-px bg-border" />;
							}
							
							if (entry.type === "submenu") {
								return (
									<div key={`submenu-${index}`} className="relative">
										<button
											type="button"
											role="menuitem"
											className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
											onMouseEnter={(e) => {
												const rect = e.currentTarget.getBoundingClientRect();
												setSubmenuState({ index, y: rect.top });
											}}
											onMouseLeave={() => {
												// 延迟关闭，让用户有时间移动到子菜单
												setTimeout(() => {
													setSubmenuState((current) => current?.index === index ? null : current);
												}, 100);
											}}
										>
											{entry.icon && <span className={`h-3.5 w-3.5 shrink-0 ${entry.icon}`} />}
											<span className="min-w-0 flex-1 truncate">{entry.label}</span>
											<span className="icon-[lucide--chevron-right] h-3 w-3 text-muted-foreground" />
										</button>
										
										{/* 子菜单 */}
										{submenuState?.index === index && (
											<div
												className="absolute left-full top-0 z-[301] min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl shadow-black/40"
												style={{ marginLeft: 2 }}
												onMouseEnter={() => setSubmenuState({ index, y: submenuState.y })}
												onMouseLeave={() => setSubmenuState(null)}
											>
												{entry.items.map((subEntry, subIndex) => {
													if (subEntry.type === "separator") {
														return <div key={`sub-sep-${subIndex}`} className="my-1 h-px bg-border" />;
													}
													if (subEntry.type === "submenu") {
														// 不支持嵌套子菜单，忽略
														return null;
													}
													return (
														<button
															key={subEntry.label}
															type="button"
															role="menuitem"
															disabled={subEntry.disabled}
															className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
																subEntry.danger
																	? "text-red-400 hover:bg-red-500/15"
																	: "text-foreground hover:bg-accent hover:text-accent-foreground"
															}`}
															onClick={() => {
																onClose();
																subEntry.onClick();
															}}
														>
															{subEntry.icon && <span className={`h-3.5 w-3.5 shrink-0 ${subEntry.icon}`} />}
															<span className="min-w-0 flex-1 truncate">{subEntry.label}</span>
														</button>
													);
												})}
											</div>
										)}
									</div>
								);
							}
							
							// 普通菜单项
							return (
								<button
									key={entry.label}
									type="button"
									role="menuitem"
									disabled={entry.disabled}
									className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
										entry.danger
											? "text-red-400 hover:bg-red-500/15"
											: "text-foreground hover:bg-accent hover:text-accent-foreground"
									}`}
									onClick={() => {
										onClose();
										entry.onClick();
									}}
								>
									{entry.icon && <span className={`h-3.5 w-3.5 shrink-0 ${entry.icon}`} />}
									<span className="min-w-0 flex-1 truncate">{entry.label}</span>
								</button>
							);
						})}
					</div>,
					panelRoot,
				)}
		</>
	);
}
