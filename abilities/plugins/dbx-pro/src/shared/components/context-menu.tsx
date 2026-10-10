/**
 * 通用右键菜单 — 连接树、结果网格等共用。
 *
 * 纯受控：调用方给出屏幕坐标和菜单项；点击外部 / Esc / 滚动时关闭。
 *
 * 定位约束（宿主插件样式规则）：
 * - 不 portal 到 document.body：会逃出插件 @scope，样式全部失效；
 *   全屏时 body 上的节点也不会被渲染。
 * - 不使用 fixed：面板类 UI 必须留在面板矩形内。
 * 做法：portal 到本面板根（.dbx-root），按面板根矩形算屏幕坐标，再减去 rootRect 得到
 * 面板内相对坐标。注意 `.dbx-root` 本身没有 position（style.css 只定义 --dbx-* 变量），
 * 绝对定位实际以插件初始包含块为基准，两者原点一致才成立 —— `.dbx-root` 是
 * h-full w-full 且位于文档左上角时成立。若将来在插件根外再包一层有偏移的容器，
 * 需要给 `.dbx-root` 补 position: relative，否则菜单会整体跟着偏移。
 *
 * 边界：主菜单与子菜单都按实测尺寸摆进面板矩形（计算见 utils/menu-placement.ts）。
 * 子菜单与主菜单同为面板根的 portal 子节点，因此点击外部判定要同时看两个 ref。
 *
 * 子菜单：与父项保持 1px 重叠（零间隙），并用共享定时器 ——
 * 鼠标移入子菜单时取消父项的延迟关闭，杜绝"展开后移不过去"。
 * 与父项顶对齐；下方放不下时整体上移（例如表菜单底部的「更多」），仍放不下才限高滚动。
 */

import { useEffect, useLayoutEffect, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import {
	CONTEXT_MENU_WIDTH,
	SUBMENU_MIN_WIDTH,
	placeContextMenu,
	placeSubmenu,
	type MenuBox,
	type PlacementRect,
	type SubmenuBox,
} from "../utils/menu-placement";

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

/** 父项 → 子菜单的延迟关闭时长（留出抖动余量）。 */
const SUBMENU_CLOSE_DELAY = 140;

/** 当前展开的子菜单：锚点用父项的屏幕矩形，定位在布局阶段实测完成。 */
interface OpenSubmenu {
	index: number;
	items: ContextMenuEntry[];
	anchor: PlacementRect;
}

function toRect(rect: DOMRect): PlacementRect {
	return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
}

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }): JSX.Element | null {
	const ref = useRef<HTMLDivElement>(null);
	const submenuRef = useRef<HTMLDivElement>(null);
	// 隐藏锚点：随组件渲染在插件树内，用来向上找到面板根作为 portal 目标。
	const anchorRef = useRef<HTMLSpanElement>(null);
	const [panelRoot, setPanelRoot] = useState<Element | null>(null);
	// 未定位前保持隐藏：先渲染才能实测尺寸，实测在同一帧的布局阶段完成，不会闪。
	const [pos, setPos] = useState<MenuBox | null>(null);
	const [submenu, setSubmenu] = useState<OpenSubmenu | null>(null);
	const [submenuBox, setSubmenuBox] = useState<SubmenuBox | null>(null);
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
		closeTimerRef.current = window.setTimeout(() => setSubmenu(null), SUBMENU_CLOSE_DELAY);
	}

	function openSubmenu(index: number, items: ContextMenuEntry[], trigger: HTMLElement): void {
		cancelCloseTimer();
		setSubmenu({ index, items, anchor: toRect(trigger.getBoundingClientRect()) });
		// 锚点变了，旧位置作废；新位置由布局阶段实测后给出。
		setSubmenuBox(null);
	}

	useLayoutEffect(() => {
		const root = anchorRef.current?.closest(".dbx-root") ?? null;
		setPanelRoot(root);
	}, []);

	// 边界检测：屏幕坐标 → 面板根相对坐标；超出面板则翻转 / 贴边 / 限高。
	// 行数变化会改变菜单高度，跟着重算一次，避免用旧高度贴边。
	useLayoutEffect(() => {
		const rootRect = panelRoot?.getBoundingClientRect();
		const menuRect = ref.current?.getBoundingClientRect();
		if (!rootRect || !menuRect) return;
		setPos(
			placeContextMenu({
				root: toRect(rootRect),
				x: menu.x,
				y: menu.y,
				// 用实测宽度而不是常量：边框/滚动条会让实际占位略大于 CONTEXT_MENU_WIDTH。
				size: { width: menuRect.width, height: menuRect.height },
				width: menuRect.width,
			}),
		);
	}, [menu.x, menu.y, menu.items.length, panelRoot]);

	// 子菜单用实测尺寸定位：父项在面板下缘时整体上移，避免被面板/屏幕裁掉。
	useLayoutEffect(() => {
		if (!submenu || !panelRoot) {
			setSubmenuBox(null);
			return;
		}
		const rootRect = panelRoot.getBoundingClientRect();
		const submenuRect = submenuRef.current?.getBoundingClientRect();
		if (!submenuRect) return;
		setSubmenuBox(
			placeSubmenu({
				root: toRect(rootRect),
				anchor: submenu.anchor,
				size: { width: submenuRect.width, height: submenuRect.height },
				minWidth: SUBMENU_MIN_WIDTH,
			}),
		);
	}, [submenu, panelRoot]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (submenu) setSubmenu(null); else onClose(); } };
		const onDown = (e: MouseEvent) => {
			const target = e.target as Node;
			// 子菜单与主菜单同为面板根的 portal 子节点，两个都要认，否则点子菜单会被当成「点外部」。
			if (ref.current?.contains(target) || submenuRef.current?.contains(target)) return;
			onClose();
		};
		// 页面滚动 / 窗口失焦时菜单已无意义。但两个菜单在面板装不下时是自带内部滚动的，
		// 那种滚动不能把自己关掉：子菜单自身滚动直接忽略；主菜单滚动会带着父项一起移动，
		// 先收起子菜单（它的锚点位置已经变了）。
		const onScroll = (e: Event) => {
			const target = e.target as Node | null;
			if (target && submenuRef.current?.contains(target)) return;
			if (target && ref.current?.contains(target)) {
				setSubmenu(null);
				return;
			}
			onClose();
		};
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
	}, [onClose, submenu]);

	// 锚点始终占位；菜单内容在找到面板根后 portal 进去。
	return (
		<>
			<span ref={anchorRef} style={{ display: "none" }} aria-hidden="true" />
			{panelRoot &&
				createPortal(
					<div
						ref={ref}
						role="menu"
						className="dbx-menu absolute z-[300] overflow-y-auto"
						style={{
							left: pos?.left ?? 0,
							top: pos?.top ?? 0,
							width: CONTEXT_MENU_WIDTH,
							maxWidth: pos?.maxWidth ?? undefined,
							maxHeight: pos?.maxHeight ?? undefined,
							// 面板内不导 Tailwind preflight（见 style.css），box-sizing 由宿主决定；
							// 显式声明 border-box，定位计算里的限高/限宽才是元素的实际占位。
							boxSizing: "border-box",
							visibility: pos ? undefined : "hidden",
						}}
						onContextMenu={(e) => e.preventDefault()}
					>
						{menu.items.map((entry, index) => {
							if (entry.type === "separator") {
								return <div key={"sep-" + index} className="dbx-menu-sep" />;
							}

							if (entry.type === "submenu") {
								const subOpen = submenu?.index === index;
								return (
									<div key={"submenu-" + index} className="relative">
										<button
											type="button"
											role="menuitem"
											aria-haspopup="true"
											aria-expanded={subOpen}
											className={"dbx-menu-item" + (subOpen ? " dbx-menu-item--open" : "")}
											onClick={(e) => {
												// 已展开则收起；否则按实测尺寸重新摆位。
												if (subOpen) setSubmenu(null);
												else openSubmenu(index, entry.items, e.currentTarget);
											}}
											onMouseEnter={(e) => {
												cancelCloseTimer();
												// 同一项重复进入不重置，避免位置重算造成抖动。
												if (!subOpen) openSubmenu(index, entry.items, e.currentTarget);
											}}
											onMouseLeave={scheduleClose}
										>
											{entry.icon && <span className={"size-4 shrink-0 text-muted " + entry.icon} />}
											<span className="min-w-0 flex-1 truncate">{entry.label}</span>
											{/* 箭头只反映当前展开项的实际方向；未展开的一律朝右，避免给出错误的展开预期 */}
											<span
												className={
													"size-4 shrink-0 text-faint " +
													(subOpen && submenuBox?.flipLeft ? "icon-[lucide--chevron-left]" : "icon-[lucide--chevron-right]")
												}
											/>
										</button>
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
									className={"dbx-menu-item" + (entry.danger ? " dbx-menu-item--danger" : "")}
									onClick={() => {
										onClose();
										entry.onClick();
									}}
								>
									{entry.icon && (
										<span className={"size-4 shrink-0 " + (entry.danger ? "text-danger" : "text-muted") + " " + entry.icon} />
									)}
									<span className="min-w-0 flex-1 truncate">{entry.label}</span>
								</button>
							);
						})}
					</div>,
					panelRoot,
				)}

			{/* 子菜单：独立 portal 到面板根，才能用面板坐标整体翻转 / 上移而不出界 */}
			{submenu &&
				panelRoot &&
				createPortal(
					<div
						ref={submenuRef}
						role="menu"
						className="dbx-menu absolute z-[301] overflow-y-auto"
						style={{
							left: submenuBox?.left ?? 0,
							top: submenuBox?.top ?? 0,
							minWidth: SUBMENU_MIN_WIDTH,
							maxWidth: submenuBox?.maxWidth ?? undefined,
							maxHeight: submenuBox?.maxHeight ?? undefined,
							boxSizing: "border-box",
							visibility: submenuBox ? undefined : "hidden",
						}}
						onMouseEnter={cancelCloseTimer}
						onMouseLeave={scheduleClose}
					>
						{submenu.items.map((subEntry, subIndex) => {
							if (subEntry.type === "separator") {
								return <div key={"sub-sep-" + subIndex} className="dbx-menu-sep" />;
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
									className={"dbx-menu-item" + (subEntry.danger ? " dbx-menu-item--danger" : "")}
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
									{subEntry.icon && (
										<span className={"size-4 shrink-0 " + (subEntry.danger ? "text-danger" : "text-muted") + " " + subEntry.icon} />
									)}
									<span className="min-w-0 flex-1 truncate">{subEntry.label}</span>
								</button>
							);
						})}
					</div>,
					panelRoot,
				)}
		</>
	);
}
