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
 *
 * 子菜单：与父项保持 1px 重叠（零间隙），并用共享定时器 ——
 * 鼠标移入子菜单时取消父项的延迟关闭，杜绝"展开后移不过去"。
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
/** 父项 → 子菜单的延迟关闭时长（留出抖动余量）。 */
const SUBMENU_CLOSE_DELAY = 140;

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }): JSX.Element | null {
	const ref = useRef<HTMLDivElement>(null);
	// 隐藏锚点：随组件渲染在插件树内，用来向上找到面板根作为 portal 目标。
	const anchorRef = useRef<HTMLSpanElement>(null);
	const [panelRoot, setPanelRoot] = useState<Element | null>(null);
	const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
	const [submenuState, setSubmenuState] = useState<{ index: number; y: number; flipLeft: boolean } | null>(null);
	// 父子项共享的关闭定时器：进入任一区域都能取消另一个区域排定的关闭。
	const closeTimerRef = useRef<number | null>(null);

	function cancelCloseTimer(): void {
		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	}

	function scheduleClose(): void {
		cancelCloseTimer();
		closeTimerRef.current = window.setTimeout(() => setSubmenuState(null), SUBMENU_CLOSE_DELAY);
	}

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
			cancelCloseTimer();
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
						className="dbx-context-menu absolute z-[300] min-w-0 rounded-lg border border-border bg-popover py-1 shadow-xl shadow-black/40"
						style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
						onContextMenu={(e) => e.preventDefault()}
					>
						{menu.items.map((entry, index) => {
							if (entry.type === "separator") {
								return <div key={`sep-${index}`} className="mx-1 my-1 h-px bg-border" />;
							}

							if (entry.type === "submenu") {
								const subOpen = submenuState?.index === index;
								return (
									<div key={`submenu-${index}`} className="relative">
										<button
											type="button"
											role="menuitem"
											aria-haspopup="true"
											aria-expanded={subOpen}
											className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] transition-colors ${
												subOpen
													? "bg-accent text-accent-foreground"
													: "text-foreground hover:bg-accent hover:text-accent-foreground"
											}`}
											onClick={(e) => {
											const rect = e.currentTarget.getBoundingClientRect();
											const rootRect = panelRoot?.getBoundingClientRect();
											const submenuWidth = 172;
											const wouldOverflow = rootRect && (rect.right + submenuWidth > rootRect.right - VIEWPORT_MARGIN);
											setSubmenuState(submenuState?.index === index ? null : { index, y: rect.top, flipLeft: !!wouldOverflow });
										}}
										onMouseEnter={(e) => {
											cancelCloseTimer();
											const rect = e.currentTarget.getBoundingClientRect();
											const rootRect = panelRoot?.getBoundingClientRect();
											const submenuWidth = 172;
											// Check if submenu would overflow on the right
											const wouldOverflow = rootRect && (rect.right + submenuWidth > rootRect.right - VIEWPORT_MARGIN);
											setSubmenuState({ index, y: rect.top, flipLeft: !!wouldOverflow });
										}}
											onMouseLeave={scheduleClose}
										>
											{entry.icon && <span className={`h-3.5 w-3.5 shrink-0 ${entry.icon}`} />}
											<span className="min-w-0 flex-1 truncate">{entry.label}</span>
											<span className={`h-3 w-3 text-muted-foreground ${submenuState?.flipLeft ? "icon-[lucide--chevron-left]" : "icon-[lucide--chevron-right]"}`} />
										</button>

										{/* 子菜单：根据空间决定向左或向右展开 */}
										{subOpen && (
											<div
												role="menu"
												className={`absolute top-0 z-[301] min-w-[172px] rounded-lg border border-border bg-popover py-1 shadow-xl shadow-black/40 ${
													submenuState.flipLeft ? "right-full -mr-px" : "left-full -ml-px"
												}`}
												onMouseEnter={cancelCloseTimer}
												onMouseLeave={scheduleClose}
											>
												{entry.items.map((subEntry, subIndex) => {
													if (subEntry.type === "separator") {
														return <div key={`sub-sep-${subIndex}`} className="mx-1 my-1 h-px bg-border" />;
													}
													if (subEntry.type === "submenu") {
														// 不支持三级嵌套，忽略
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
																	? "text-red-500 hover:bg-red-500/15"
																	: "text-foreground hover:bg-accent hover:text-accent-foreground"
															}`}
															onClick={() => {
																// 先执行 onClick，再关闭菜单，避免菜单卸载后 onClick 无法执行
																try {
																	subEntry.onClick();
																} catch (err) {
																	console.error("[ContextMenu] 子菜单项 onClick 执行失败:", err);
																}
																onClose();
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
											? "text-red-500 hover:bg-red-500/15"
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
