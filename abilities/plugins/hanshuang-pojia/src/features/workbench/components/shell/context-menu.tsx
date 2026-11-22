import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { MENU_WIDTH, clampMenu, estimateMenuHeight, type PanelMenu } from "../../hooks/use-panel-menu";
import { Icon } from "./icon";

export interface ContextMenuProps {
	menu: PanelMenu | null;
	onClose(): void;
}

/**
 * 面板内的右键菜单。
 *
 * 定位基准是面板根（`[data-panel-root]`）：菜单是面板的兄弟节点，不在任何滚动容器里，
 * 所以既不会被列表的 `overflow` 裁掉，也不会画到宿主界面上。
 *
 * 坐标先按估算高度钳一次（第一帧就落在面板内，不会闪到外面去），
 * 挂载后再按**实测**高度修正一次 —— 行数是调用方给的，估算与实际差一行就会越界。
 */
export function ContextMenu({ menu, onClose }: ContextMenuProps) {
	const { t } = useTranslation();
	const panel = useRef<HTMLDivElement | null>(null);
	const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

	useLayoutEffect(() => {
		if (!menu) {
			setPos(null);
			return;
		}
		const node = panel.current;
		if (!node) return;
		const root = node.closest<HTMLElement>("[data-panel-root]");
		const rect = root?.getBoundingClientRect();
		setPos(
			clampMenu(
				{ left: menu.left, top: menu.top },
				{ width: node.offsetWidth || MENU_WIDTH, height: node.offsetHeight || estimateMenuHeight(menu) },
				{ width: rect?.width ?? 360, height: rect?.height ?? 520 },
			),
		);
		// 打开即聚焦第一项：右键之后直接用方向键走，不用先 Tab 一次。
		node.querySelector<HTMLElement>("[role='menuitem']")?.focus();
	}, [menu]);

	if (!menu) return null;

	/**
	 * 方向键在项之间移动。菜单是可点的一串按钮，但「键盘用户右键后无法选择」
	 * 是这类浮层最常见的缺陷，所以显式接管上下键与 Home/End。
	 */
	const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const items = [...(panel.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])];
		if (items.length === 0) return;
		const index = items.indexOf(document.activeElement as HTMLElement);
		if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
			event.preventDefault();
			items[(index + 1 + items.length) % items.length]?.focus();
		} else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
			event.preventDefault();
			items[(index - 1 + items.length) % items.length]?.focus();
		} else if (event.key === "Home") {
			event.preventDefault();
			items[0]?.focus();
		} else if (event.key === "End") {
			event.preventDefault();
			items[items.length - 1]?.focus();
		} else if (event.key === "Escape") {
			event.stopPropagation();
			onClose();
		}
	};

	return (
		<>
			{/* 遮罩只负责关闭：右键落在遮罩上也收起，不叠第二层菜单。 */}
			<div
				className="absolute inset-0 z-40"
				data-testid="context-menu-scrim"
				onClick={onClose}
				onContextMenu={event => {
					event.preventDefault();
					onClose();
				}}
			/>
			<div
				ref={panel}
				role="menu"
				aria-label={menu.heading ?? t("menu.label")}
				data-testid="context-menu"
				onKeyDown={onKeyDown}
				style={{ left: pos?.left ?? menu.left, top: pos?.top ?? menu.top, width: MENU_WIDTH, visibility: pos ? "visible" : "hidden" }}
				className="absolute z-50 max-h-[min(420px,80%)] overflow-y-auto rounded-lg bg-surface-2 py-1 shadow-lg ring-1 ring-line-strong"
			>
				{menu.heading ? (
					<div className="truncate px-3 pb-1 pt-1.5 text-[9.5px] uppercase tracking-wider text-text-4" title={menu.heading}>
						{menu.heading}
					</div>
				) : null}
				{menu.groups.map((group, groupIndex) => (
					<div key={group.id} role="group" className={groupIndex > 0 ? "mt-1 border-t border-line-subtle pt-1" : ""}>
						{group.items.map(item => (
							<button
								key={item.id}
								type="button"
								role="menuitem"
								onClick={() => {
									onClose();
									item.run();
								}}
								className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] transition-colors focus-visible:outline-none ${
									item.tone === "danger"
										? "text-risk-high hover:bg-risk-high/12"
										: "text-text-2 hover:bg-accent-soft hover:text-accent focus-visible:bg-accent-soft focus-visible:text-accent"
								}`}
							>
								{item.icon ? <Icon name={item.icon} className="size-3 shrink-0 text-text-4" /> : null}
								<span className="min-w-0 flex-1 fb-wrap">{item.label}</span>
								{item.hint ? <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-4">{item.hint}</span> : null}
							</button>
						))}
					</div>
				))}
			</div>
		</>
	);
}
