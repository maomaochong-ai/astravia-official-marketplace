/**
 * 上下可拖拽布局 — SQL 编辑器 / 结果面板。
 *
 * 与 SplitLayout 同一套做法：像素起点 + 上下限夹逼，中栏式的下限保护在这里
 * 变成「结果面板至少留 100px」，避免用户把结果区拖到看不见。
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";

export function HorizontalSplit({ top, bottom }: { top: JSX.Element; bottom: JSX.Element }): JSX.Element {
	const [topH, setTopH] = useState(0);
	const [dragging, setDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{ startY: number; startH: number } | null>(null);
	const [measuredHeight, setMeasuredHeight] = useState(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const update = () => setMeasuredHeight(el.getBoundingClientRect().height);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const onPointerMove = useCallback((e: PointerEvent) => {
		const drag = dragRef.current;
		const el = containerRef.current;
		if (!drag || !el) return;
		const total = el.getBoundingClientRect().height;
		const MIN_TOP = 120;
		const MIN_BOTTOM = 100;
		const next = Math.max(
			MIN_TOP,
			Math.min(total - MIN_BOTTOM, drag.startH + (e.clientY - drag.startY)),
		);
		setTopH(next);
	}, []);

	const onPointerUp = useCallback(() => {
		dragRef.current = null;
		setDragging(false);
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
	}, [onPointerMove]);

	function startDrag(e: React.PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		const el = containerRef.current;
		if (!el) return;
		const total = el.getBoundingClientRect().height;
		const curTop = topH || Math.round(total * 0.46);
		if (!topH) setTopH(curTop);
		dragRef.current = { startY: e.clientY, startH: curTop };
		setDragging(true);
		document.body.style.cursor = "row-resize";
		document.body.style.userSelect = "none";
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
	}

	const baseHeight = measuredHeight || 800;
	const effectiveTop = topH || Math.round(baseHeight * 0.46);

	return (
		<div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col">
			{/* 编辑器（固定当前高度） */}
			<div className="min-h-0 overflow-hidden" style={{ height: effectiveTop, flexShrink: 0 }}>
				{top}
			</div>

			{/* 水平分隔条：gutter 竖线在此收笔，形成清晰边界 */}
			<div
				onPointerDown={startDrag}
				className="relative h-1 shrink-0 cursor-row-resize"
				style={{ backgroundColor: dragging ? "var(--foreground)" : "var(--dbx-line)" }}
			>
				<div className="absolute inset-x-0 top-[-3px] bottom-[-3px]" />
			</div>

			{/* 结果面板（剩余高度） */}
			<div className="min-w-0 min-h-0 flex-1 overflow-hidden">{bottom}</div>

		</div>
	);
}
