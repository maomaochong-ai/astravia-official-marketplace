/**
 * PageSizeMenu — 结果网格底栏「每页 N 行」选择器。
 *
 * 对标 dbx 桌面壳 DataGridPagination 的 LightDropdown：
 * 触发按钮显示「N 行/页」，弹层内含预设值 + 自定义输入（本次查询 / 设为默认）。
 *
 * 定位约束与 ContextMenu 相同：底栏是 h-7 + overflow:hidden，绝对定位的弹层
 * 会被直接裁掉，因此 portal 到面板根（.dbx-root），按触发器矩形向上展开、
 * 右对齐；上方空间不足时翻向下展开。
 */

import { useLayoutEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
	MAX_RESULT_PAGE_SIZE,
	MIN_RESULT_PAGE_SIZE,
	parsePageSizeInput,
} from "../../../domain/workbench-settings";
import { pageSizeNotice } from "../services/page-size-notice";

const MENU_WIDTH = 224;
const VIEWPORT_MARGIN = 4;

interface Props {
	/** 当前生效的每页行数。 */
	pageSize: number;
	/** 预设项（调用方负责把当前自定义值去重合并后排好序）。 */
	options: readonly number[];
	/** 工作台默认行数，用于自定义区提示与「设为默认」。 */
	defaultPageSize: number;
	/** 取数中：禁用交互。 */
	disabled?: boolean;
	/** 仅本次查询生效。 */
	onApply: (pageSize: number) => void;
	/** 写入工作台默认设置。 */
	onSetDefault: (pageSize: number) => void;
}

export function PageSizeMenu({
	pageSize,
	options,
	defaultPageSize,
	disabled,
	onApply,
	onSetDefault,
}: Props): JSX.Element {
	const [open, setOpen] = useState(false);
	const [customInput, setCustomInput] = useState(String(pageSize));
	// 自定义行数的解析结果：越界时不静默改数，而是照实说明会取哪个值。
	const parsedCustom = parsePageSizeInput(customInput, pageSize);
	const customNotice = pageSizeNotice(parsedCustom);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const anchorRef = useRef<HTMLSpanElement>(null);
	const [panelRoot, setPanelRoot] = useState<Element | null>(null);
	const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

	// 弹层每次打开时用当前行数预填自定义输入。
	useLayoutEffect(() => {
		if (open) setCustomInput(String(pageSize));
	}, [open, pageSize]);

	useLayoutEffect(() => {
		const root = anchorRef.current?.closest(".dbx-root") ?? null;
		setPanelRoot(root);
	}, []);

	// 触发器矩形（面板根坐标系）定位：默认向上展开、右对齐；上方不够则向下。
	useLayoutEffect(() => {
		if (!open || !panelRoot) return;
		const rootRect = panelRoot.getBoundingClientRect();
		const triggerRect = triggerRef.current?.getBoundingClientRect();
		const menuRect = menuRef.current?.getBoundingClientRect();
		if (!triggerRect) return;
		const left = Math.max(
			VIEWPORT_MARGIN,
			Math.min(triggerRect.right - MENU_WIDTH - rootRect.left, rootRect.width - MENU_WIDTH - VIEWPORT_MARGIN),
		);
		const spaceAbove = triggerRect.top - rootRect.top;
		const menuH = menuRect?.height ?? 190;
		const openUp = spaceAbove >= menuH + 4 || spaceAbove > rootRect.bottom - triggerRect.bottom;
		const top = openUp
			? triggerRect.top - rootRect.top - menuH - 4
			: triggerRect.bottom - rootRect.top + 4;
		setPos({ left, top: Math.max(VIEWPORT_MARGIN, top) });
	}, [open, panelRoot]);

	// 点击外部 / Esc 关闭；菜单 portal 在面板根上，判定以 menuRef 为准。
	useLayoutEffect(() => {
		if (!open) return;
		function onDown(e: MouseEvent): void {
			const t = e.target as Node;
			if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
			setOpen(false);
		}
		function onKey(e: KeyboardEvent): void {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onDown, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("mousedown", onDown, true);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [open]);

	function applyCustom(): void {
		onApply(parsedCustom.value);
		setOpen(false);
	}

	function applyCustomAsDefault(): void {
		onSetDefault(parsedCustom.value);
		setOpen(false);
	}

	const footer: ReactNode = (
		<>
			<button
				type="button"
				onClick={applyCustom}
				className="flex-1 whitespace-nowrap rounded-control border border-border px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-neutral-muted hover:text-foreground"
			>
				本次查询
			</button>
			<button
				type="button"
				onClick={applyCustomAsDefault}
				className="flex-1 whitespace-nowrap rounded-control bg-primary px-2 py-1.5 text-[12px] text-primary-fg hover:opacity-90"
			>
				设为默认
			</button>
		</>
	);

	return (
		<>
			<span ref={anchorRef} style={{ display: "none" }} aria-hidden="true" />
			<button
				ref={triggerRef}
				type="button"
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
				aria-haspopup="menu"
				aria-expanded={open}
				title="每页显示行数"
				className="inline-flex h-6 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-control px-1.5 text-[12px] text-muted-foreground hover:bg-neutral-muted hover:text-foreground disabled:opacity-40"
			>
				<span className="tabular-nums">{pageSize}</span>
				<span>行/页</span>
				<span className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""} icon-[lucide--chevron-down]`} />
			</button>
			{open &&
				panelRoot &&
				createPortal(
					<div
						ref={menuRef}
						role="menu"
						className="dbx-menu absolute z-[300]"
						style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
					>
						{options.map((n) => {
							const active = n === pageSize;
							return (
								<button
									key={n}
									type="button"
									role="menuitem"
									onClick={() => {
										onApply(n);
										setOpen(false);
									}}
									className="dbx-menu-item"
								>
									<span
									className={"size-3.5 shrink-0 " + (active ? "icon-[lucide--check] text-accent" : "")}
									/>
									<span className="tabular-nums">{n.toLocaleString()}</span>
									<span className="text-faint">行/页</span>
								</button>
							);
						})}

						<div className="dbx-menu-sep" />
						<div className="px-2.5 pt-1 text-[11px] font-medium text-foreground">自定义每页行数</div>
						<div className="px-2.5 pb-1.5 pt-0.5 text-[10px] text-muted-foreground tabular-nums">
							当前 {pageSize.toLocaleString()} · 默认 {defaultPageSize.toLocaleString()}（≤ {MAX_RESULT_PAGE_SIZE.toLocaleString()}）
						</div>
						<div className="flex items-center gap-1.5 px-2.5 pb-2">
							<input
								type="number"
								inputMode="numeric"
								aria-label="自定义每页行数"
								min={MIN_RESULT_PAGE_SIZE}
								max={MAX_RESULT_PAGE_SIZE}
								value={customInput}
								onChange={(e) => setCustomInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										e.stopPropagation();
										applyCustom();
									}
								}}
								onMouseDown={(e) => e.stopPropagation()}
								className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1.5 text-[11px] tabular-nums text-foreground outline-none focus:border-foreground/40"
							/>
							<button
								type="button"
								onClick={applyCustom}
								title="应用于本次查询"
								className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control border border-border text-foreground hover:bg-neutral-muted"
							>
								<span className="icon-[lucide--check] h-3.5 w-3.5" />
							</button>
						</div>
						{customNotice ? (
							<div className="px-2.5 pb-2 text-[11px] leading-relaxed text-warning">{customNotice}</div>
						) : null}
						<div className="flex gap-1.5 border-t border-border px-2.5 py-2">{footer}</div>
					</div>,
					panelRoot,
				)}
		</>
	);
}
