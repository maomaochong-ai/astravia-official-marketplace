/**
 * 三栏可拖拽布局 — 连接树 / 编辑器 / 右栏。
 *
 * 自己实现拖拽（不引外部依赖）：pointerdown 记录起点与两侧当前像素宽，
 * pointermove 按像素夹逼，保证中栏始终留有可用宽度。
 * 首次挂载按容器实测宽度算默认比例（18% / 20%），用户拖过之后改用像素值，
 * 容器尺寸变化不再强制缩放，保留用户的设定。
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

export function SplitLayout({ children, onDragStart, leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight }: { children: [JSX.Element, JSX.Element, JSX.Element]; onDragStart?: (side: "left" | "right") => void; leftCollapsed?: boolean; rightCollapsed?: boolean; onToggleLeft?: () => void; onToggleRight?: () => void }): JSX.Element {
	// 三栏宽度（px）。0 表示首次按容器尺寸用默认比例初始化。
	const [leftW, setLeftW] = useState(0);
	const [rightW, setRightW] = useState(0);
	const dragRef = useRef<DragState | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState<"left" | "right" | null>(null);

	// 各栏像素约束（中栏始终保留，分隔线无法拖到不合理的大小）
	// MIN_MID 补偿 gutter 的 p-1（8px）+ 两条 4px 竖向拖拽条（8px），
	// 约束按容器全宽换算时中栏实际可用宽度始终 ≥ 320。
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

	const effectiveLeft = leftW || Math.round(baseWidth * 0.18);
	const effectiveRight = rightW || Math.round(baseWidth * 0.2);

	return (
		<div ref={containerRef} className="dbx-gutter relative flex min-h-0 flex-1 p-1">
			{/* 左栏卡片（可收起为细条） */}
			<div
				className="dbx-panel-card min-h-0"
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

			{/* 左分隔条：卡片缝隙中的透明拖拽条；左栏收起时保留同宽缝隙 */}
			{leftCollapsed ? (
				<div style={{ width: 4, flexShrink: 0 }} />
			) : (
				<div
					onPointerDown={(e) => startDrag("left", e)}
					className={`dbx-splitbar dbx-splitbar-v ${dragging === "left" ? "is-dragging" : ""}`}
				>
					<div className="dbx-split-hit" />
				</div>
			)}

			{/* 中栏卡片 */}
			<div className="dbx-panel-card min-w-0 min-h-0 flex-1">
				{children[1]}
			</div>

			{/* 右分隔条 */}
			{!rightCollapsed && (
				<div
					onPointerDown={(e) => startDrag("right", e)}
					className={`dbx-splitbar dbx-splitbar-v ${dragging === "right" ? "is-dragging" : ""}`}
				>
					<div className="dbx-split-hit" />
				</div>
			)}

			{/* 右栏卡片（可通过顶栏按钮收起） */}
			{!rightCollapsed && (
				<div
					className="dbx-panel-card min-h-0"
					style={{ width: effectiveRight, flexShrink: 0 }}
				>
					{children[2]}
				</div>
			)}
		</div>
	);
}
