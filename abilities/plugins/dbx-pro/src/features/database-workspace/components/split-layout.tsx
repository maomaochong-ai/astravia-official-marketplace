/**
 * 三栏可拖拽布局 — 连接树 / 编辑器 / 右栏。
 *
 * 自己实现拖拽（不引外部依赖）：pointerdown 记录起点与两侧当前像素宽，
 * pointermove 按像素夹逼，保证中栏始终留有可用宽度。
 * 首次挂载按容器实测宽度算默认比例（18% / 20%），用户拖过之后改用像素值，
 * 容器尺寸变化不再强制缩放，保留用户的设定。
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";

interface DragState {
	/** "left" = 左栏/中栏之间；"right" = 中栏/右栏之间 */
	side: "left" | "right";
	startX: number;
	/** 被拖动栏的起始宽度（px） */
	startW: number;
	/** 另一侧（不被拖动）栏的当前宽度（px） */
	otherW: number;
}

export function SplitLayout({ children, onDragStart, leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight }: { children: [JSX.Element, JSX.Element, JSX.Element]; onDragStart?: (side: "left" | "right") => void; leftCollapsed?: boolean; rightCollapsed?: boolean; onToggleLeft?: () => void; onToggleRight?: () => void }): JSX.Element {
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
	const MIN_MID = 320;

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
		// 首次拖动（初始为 0）前，按当前默认比例换算成像素起点。
		const curLeft = leftW || Math.round(total * 0.18);
		const curRight = rightW || Math.round(total * 0.2);
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

	// 首次渲染：左 18%、右 20%，中栏剩余。挂载后按容器真实宽度测量一次；
	// 用户拖动后改用像素值，容器尺寸变化时不再强制缩放（保留用户设定）。
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
	const effectiveLeft = leftW || Math.round(baseWidth * 0.18);
	const effectiveRight = rightW || Math.round(baseWidth * 0.2);

	return (
		<div ref={containerRef} className="relative flex min-h-0 flex-1">
			{/* 左栏（可收起为细条） */}
			<div
				className="min-h-0 overflow-hidden"
				style={{ width: leftCollapsed ? 36 : effectiveLeft, flexShrink: 0 }}
			>
				{leftCollapsed ? (
					<button
						type="button"
						onClick={() => onToggleLeft?.()}
						title="展开连接树"
						className="flex h-full w-full flex-col items-center gap-1 pt-3 text-muted-foreground hover:text-foreground"
					>
						<span className="icon-[lucide--panel-left] h-4 w-4" />
						<span className="icon-[lucide--database] h-4 w-4 opacity-60" />
					</button>
				) : (
					children[0]
				)}
			</div>

			{/* 左分隔条 */}
			{!leftCollapsed && (
				<div
					onPointerDown={(e) => startDrag("left", e)}
					className="group relative w-1 shrink-0 cursor-col-resize"
					style={{ backgroundColor: dragging === "left" ? "var(--foreground)" : "var(--dbx-line)" }}
				>
					<div className="absolute inset-y-0 left-[-3px] right-[-3px]" />
				</div>
			)}

			{/* 中栏 */}
			<div className="min-w-0 min-h-0 flex-1 overflow-hidden">
				{children[1]}
			</div>

			{/* 右分隔条 */}
			{!rightCollapsed && (
				<div
					onPointerDown={(e) => startDrag("right", e)}
					className="group relative w-1 shrink-0 cursor-col-resize"
					style={{ backgroundColor: dragging === "right" ? "var(--foreground)" : "var(--dbx-line)" }}
				>
					<div className="absolute inset-y-0 left-[-3px] right-[-3px]" />
				</div>
			)}

			{/* 右栏（可通过顶栏按钮收起） */}
			{!rightCollapsed && (
				<div
					className="min-h-0 overflow-hidden"
					style={{ width: effectiveRight, flexShrink: 0 }}
				>
					{children[2]}
				</div>
			)}
		</div>
	);
}
