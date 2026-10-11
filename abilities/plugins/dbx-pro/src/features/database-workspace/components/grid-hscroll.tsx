/**
 * GridHScroll — 网格顶部水平滚动条（设计稿 frames/scrollbars.tsx）。
 *
 * 规格：轨道 10px / 4px 圆角 / 底色；滑块 6px / 3px 圆角 / 最短 24px；
 * 静止 neutral-muted、悬停 border-strong、拖拽 accent 70% 并临时显示列区间。
 * 位置：网格顶部（紧贴冻结表头），与底部分页栏上沿的原生条共用同一 scrollLeft，
 * 拖动 / 滚轮任意一条另一条跟随；内容不足一屏时整条隐藏，不留空轨道。
 */

import { useCallback, useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type RefObject, type WheelEvent as ReactWheelEvent } from "react";

interface GridHScrollProps {
	/** 网格滚动容器（ResultTable 的 overflow 容器）。 */
	scrollRef: RefObject<HTMLDivElement | null>;
	columns: string[];
	/** 当前列宽（含用户拖拽调整后的宽度），用于拖拽时计算可见列区间。 */
	colWidth: (col: string) => number;
	/** 行号列占位宽度（显示行号时才有）。 */
	gutterWidth?: number;
}

interface Metrics {
	scrollLeft: number;
	scrollWidth: number;
	clientWidth: number;
}

export function GridHScroll({ scrollRef, columns, colWidth, gutterWidth = 0 }: GridHScrollProps): JSX.Element | null {
	const [metrics, setMetrics] = useState<Metrics>({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
	const [hover, setHover] = useState(false);
	const [drag, setDrag] = useState(false);
	const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);

	const measure = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setMetrics((prev) =>
			prev.scrollLeft === el.scrollLeft && prev.scrollWidth === el.scrollWidth && prev.clientWidth === el.clientWidth
				? prev
				: { scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth },
		);
	}, [scrollRef]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		measure();
		el.addEventListener("scroll", measure, { passive: true });
		if (typeof ResizeObserver === "undefined") return () => el.removeEventListener("scroll", measure);
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => {
			el.removeEventListener("scroll", measure);
			observer.disconnect();
		};
	}, [measure, scrollRef]);

	const overflow = metrics.scrollWidth - metrics.clientWidth;
	// 轨道与网格同宽，直接用容器可视宽度做像素换算，避免再测一次轨道。
	const trackWidth = metrics.clientWidth;
	const thumbWidth = overflow > 0 && metrics.scrollWidth > 0 ? Math.max(24, Math.round((trackWidth * metrics.clientWidth) / metrics.scrollWidth)) : 0;
	const trackSpan = Math.max(0, trackWidth - thumbWidth);
	const thumbLeft = overflow > 0 && trackSpan > 0 ? Math.round((metrics.scrollLeft / overflow) * trackSpan) : 0;

	// 拖拽时临时显示可见列区间（设计稿：accent 滑块 + 列 8–21 标签）。
	let rangeLabel = "";
	if (drag && overflow > 0) {
		const startX = metrics.scrollLeft - gutterWidth;
		const endX = startX + metrics.clientWidth;
		let acc = 0;
		let first = -1;
		let last = -1;
		columns.forEach((col, index) => {
			const width = colWidth(col);
			if (acc + width > startX && acc < endX) {
				if (first < 0) first = index + 1;
				last = index + 1;
			}
			acc += width;
		});
		if (first > 0) rangeLabel = `列 ${first}–${last} / ${columns.length}`;
	}

	function pageBy(direction: 1 | -1): void {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollLeft += direction * el.clientWidth;
	}

	function handleThumbPointerDown(event: ReactPointerEvent<HTMLSpanElement>): void {
		const el = scrollRef.current;
		if (!el) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = { startX: event.clientX, startScroll: el.scrollLeft };
		setDrag(true);
	}

	function handleThumbPointerMove(event: ReactPointerEvent<HTMLSpanElement>): void {
		const el = scrollRef.current;
		const origin = dragRef.current;
		if (!el || !origin || trackSpan <= 0) return;
		el.scrollLeft = origin.startScroll + ((event.clientX - origin.startX) * overflow) / trackSpan;
	}

	function handleThumbPointerUp(event: ReactPointerEvent<HTMLSpanElement>): void {
		dragRef.current = null;
		setDrag(false);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	}

	/** 点击轨道空白：按可视宽向对应方向翻页。 */
	function handleTrackClick(event: ReactMouseEvent<HTMLDivElement>): void {
		if (drag) return;
		const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
		pageBy(x < thumbLeft ? -1 : 1);
	}

	/** 滚轮横滚（含 ⇧ 滚轮）：滑块跟手，不吸附列边界。 */
	function handleWheel(event: ReactWheelEvent<HTMLDivElement>): void {
		const el = scrollRef.current;
		if (!el) return;
		const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
		if (delta === 0) return;
		el.scrollLeft += delta;
	}

	if (overflow <= 0 || thumbWidth <= 0) return null;

	const thumbTone = drag ? "bg-accent/70" : hover ? "bg-border-strong" : "bg-neutral-muted";

	return (
		<div
			className="relative h-2.5 shrink-0 cursor-default rounded-full bg-canvas"
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			onClick={handleTrackClick}
			onWheel={handleWheel}
			title="拖动可在不滚动到底部的情况下横向浏览（与底部条同步）"
		>
			<span
				className={`absolute top-0.5 bottom-0.5 rounded-[3px] ${thumbTone} ${drag ? "cursor-grabbing" : "cursor-grab"}`}
				style={{ left: thumbLeft, width: thumbWidth }}
				onPointerDown={handleThumbPointerDown}
				onPointerMove={handleThumbPointerMove}
				onPointerUp={handleThumbPointerUp}
				onPointerCancel={handleThumbPointerUp}
			>
				{drag ? (
					<span className="pointer-events-none absolute inset-0 flex items-center justify-center px-1 font-mono text-[9px] leading-none text-canvas">{rangeLabel}</span>
				) : null}
			</span>
		</div>
	);
}
