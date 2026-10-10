/**
 * 三栏可拖拽布局 — 连接树 / 编辑器 / 右栏。
 *
 * 对齐设计稿 frames/index.tsx：三栏**齐平**，没有缝隙与卡片边框，
 * 区域边界只由 1px 发丝分隔线表达（左栏 248px / 右栏 300px）。
 *
 * 拖拽自己实现（不引外部依赖）：pointerdown 记录起点与两侧当前像素宽，
 * pointermove 按像素夹逼，保证中栏始终留有可用宽度。
 * 首次挂载按容器实测宽度给设计稿默认宽；宿主面板过窄时退回比例分配。
 * 用户拖过之后改用像素值，容器尺寸变化不再强制缩放，保留用户的设定。
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { patchSession, readSession } from "../../../domain/workbench-session";

interface DragState {
	/** "left" = 左栏/中栏之间；"right" = 中栏/右栏之间 */
	side: "left" | "right";
	startX: number;
	/** 被拖动栏的起始宽度（px） */
	startW: number;
	/** 另一侧（不被拖动）栏的当前宽度（px） */
	otherW: number;
}

/** 设计稿画框的固定栏宽（frames/index.tsx：左树 248px、右历史栏 300px）。 */
const DESIGN_LEFT = 248;
const DESIGN_RIGHT = 300;
/** 宿主面板窄于此宽度时改用比例分配，避免中栏被挤没。 */
const NARROW_BREAKPOINT = 900;

function defaultWidths(total: number): { left: number; right: number } {
	if (total > 0 && total < NARROW_BREAKPOINT) {
		return { left: Math.round(total * 0.26), right: Math.round(total * 0.28) };
	}
	return { left: DESIGN_LEFT, right: DESIGN_RIGHT };
}

export function SplitLayout({ children, onDragStart, leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight: _onToggleRight }: { children: [JSX.Element, JSX.Element, JSX.Element]; onDragStart?: (side: "left" | "right") => void; leftCollapsed?: boolean; rightCollapsed?: boolean; onToggleLeft?: () => void; onToggleRight?: () => void }): JSX.Element {
	// 三栏宽度（px）。0 表示首次按容器尺寸用默认比例初始化。
	const [leftW, setLeftW] = useState(0);
	const [rightW, setRightW] = useState(0);
	const dragRef = useRef<DragState | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState<"left" | "right" | null>(null);

	// 各栏像素约束（中栏始终保留，分隔线无法拖到不合理的大小）
	const MIN_LEFT = 180;
	const MAX_LEFT_RATIO = 0.4;
	const MIN_RIGHT = 260;
	const MAX_RIGHT_RATIO = 0.5;
	const MIN_MID = 344;

	const onPointerMove = useCallback((e: PointerEvent) => {
		const drag = dragRef.current;
		const el = containerRef.current;
		if (!drag || !el) return;
		const rect = el.getBoundingClientRect();
		const total = rect.width;
		const delta = e.clientX - drag.startX;

		// 运行时边界（像素）
		const maxLeft = Math.round(total * MAX_LEFT_RATIO);
		const maxRight = Math.round(total * MAX_RIGHT_RATIO);

		if (drag.side === "left") {
			// 左栏宽度受自身上下限约束，并保证中栏 ≥ MIN_MID、右栏 ≥ MIN_RIGHT。
			const upperByRight = Math.max(MIN_LEFT, total - MIN_MID - drag.otherW);
			const next = Math.max(MIN_LEFT, Math.min(maxLeft, upperByRight, drag.startW + delta));
			setLeftW(next);
		} else {
			// 右栏：向左拖增大。受自身上下限约束，保证中栏 ≥ MIN_MID、左栏 ≥ MIN_LEFT。
			const upperByLeft = Math.max(MIN_RIGHT, total - MIN_MID - drag.otherW);
			const next = Math.max(MIN_RIGHT, Math.min(maxRight, upperByLeft, drag.startW - delta));
			setRightW(next);
		}
	}, []);

	const onPointerUp = useCallback(() => {
		dragRef.current = null;
		setDragging(null);
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
	}, [onPointerMove]);

	function startDrag(side: "left" | "right", e: React.PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		const el = containerRef.current;
		if (!el) return;
		const total = el.getBoundingClientRect().width;
		const { left: defLeft, right: defRight } = defaultWidths(total);
		const curLeft = leftW || defLeft;
		const curRight = rightW || defRight;
		if (!leftW) setLeftW(curLeft);
		if (!rightW) setRightW(curRight);
		dragRef.current = {
			side,
			startX: e.clientX,
			startW: side === "left" ? curLeft : curRight,
			otherW: side === "left" ? curRight : curLeft,
		};
		setDragging(side);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		onDragStart?.(side);
	}

	// 首次渲染按设计稿固定栏宽（左 248 / 右 300）；宿主面板过窄时退回比例分配。
	// 挂载后按容器真实宽度测量一次；用户拖动后改用像素值，容器尺寸变化时不再强制缩放。
	const [measuredWidth, setMeasuredWidth] = useState(0);
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const update = () => setMeasuredWidth(el.getBoundingClientRect().width);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	const baseWidth = measuredWidth || 1000;

	// 恢复上次三栏宽度（仅在用户拖过时有效）。
	// 恢复完成前 leftW/rightW 仍是初始值，直接写回会覆盖磁盘上用户拖过的宽度，
	// 故用 hydration 门闩把「首次落盘」推迟到读取结束。
	const [widthsHydrated, setWidthsHydrated] = useState(false);
	useEffect(() => {
		let alive = true;
		void readSession().then((s) => {
			if (!alive) return;
			if (s && Number.isFinite(s.leftW)) setLeftW(s.leftW as number);
			if (s && Number.isFinite(s.rightW)) setRightW(s.rightW as number);
		}).catch(() => { /* ignore */ }).finally(() => {
			if (alive) setWidthsHydrated(true);
		});
		return () => { alive = false; };
	}, []);

	// 拖拽结束（dragging 回 null）后把最终宽度并入会话，重载后保持同样布局。
	// 只提交本写入方维护的字段：整份覆盖会抹掉会话里其它写入方（tab 自动保存、
	// 左栏折叠态）刚写入的值。
	useEffect(() => {
		if (!widthsHydrated || dragging || (!leftW && !rightW)) return;
		void patchSession({ leftW, rightW }).catch(() => { /* ignore */ });
	}, [widthsHydrated, dragging, leftW, rightW]);

	const defaults = defaultWidths(baseWidth);
	const effectiveLeft = leftW || defaults.left;
	const effectiveRight = rightW || defaults.right;

	return (
		<div ref={containerRef} className="relative flex min-h-0 flex-1 overflow-hidden bg-surface">
			{/* 左栏：连接树。收起时退化为 36px 图标列（设计稿 ConnectionTree 的收起态）。 */}
			<div className="flex min-h-0 shrink-0 flex-col" style={{ width: leftCollapsed ? 36 : effectiveLeft }}>
				{leftCollapsed ? (
					<div className="flex h-full w-full flex-col items-center gap-1 bg-surface-raised py-1.5">
						<button
							type="button"
							onClick={() => onToggleLeft?.()}
							title="展开连接树"
							className="flex size-7 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-neutral-muted hover:text-surface-foreground"
						>
							<span className="icon-[lucide--panel-left-open] size-3.5" />
						</button>
						<span className="my-1 h-px w-5 shrink-0 bg-border" />
						<span
							title="连接"
							className="flex size-7 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent"
						>
							<span className="icon-[lucide--database] size-3.5" />
						</span>
						<span title="表" className="flex size-7 shrink-0 items-center justify-center rounded-control text-muted">
							<span className="icon-[lucide--table-2] size-3.5" />
						</span>
						<span title="选择" className="flex size-7 shrink-0 items-center justify-center rounded-control text-muted">
							<span className="icon-[lucide--square-check-big] size-3.5" />
						</span>
						<span title="导入" className="flex size-7 shrink-0 items-center justify-center rounded-control text-muted">
							<span className="icon-[lucide--folder-input] size-3.5" />
						</span>
					</div>
				) : (
					children[0]
				)}
			</div>

			{/* 左分隔线：1px 发丝线本身即拖拽区（隐形热区外延 4px） */}
			<div
				onPointerDown={(e) => startDrag("left", e)}
				className={`dbx-splitbar dbx-splitbar-v ${dragging === "left" ? "is-dragging" : ""}`}
			>
				<div className="dbx-split-hit" />
			</div>

			{/* 中栏：SQL 编辑器 + 结果面板（自身负责底色与纵向接缝） */}
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children[1]}</div>

			{/* 右栏：查询历史 / 详情。可通过顶栏按钮收起。 */}
			{!rightCollapsed && (
				<>
					<div
						onPointerDown={(e) => startDrag("right", e)}
						className={`dbx-splitbar dbx-splitbar-v ${dragging === "right" ? "is-dragging" : ""}`}
					>
						<div className="dbx-split-hit" />
					</div>
					<div className="flex min-h-0 shrink-0 flex-col bg-surface-raised" style={{ width: effectiveRight }}>
						{children[2]}
					</div>
				</>
			)}
		</div>
	);
}
