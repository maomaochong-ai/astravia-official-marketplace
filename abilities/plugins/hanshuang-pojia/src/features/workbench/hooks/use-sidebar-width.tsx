import { useCallback, useRef, useState } from "react";

/** 收起是图标轨（48px）；展开的下限要能放下 4 个中文字的一行标签，上限只到「够宽」为止。 */
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 360;
export const SIDEBAR_DEFAULT = 240;

export interface StoredWidthOptions {
	storageKey: string;
	fallback: number;
	min: number;
	max: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * 一个可拖出来的宽度，跨会话记住。
 *
 * 面板里的分区宽度是用户的选择，不是设计稿的常量：写死 `w-56` 之后，
 * 中文标签一长就被截断，而用户没有别的手段把那一栏拉宽。
 * 存 localStorage 而不是插件 storage —— 这是纯界面偏好，与工作区无关。
 */
export function useStoredWidth({ storageKey, fallback, min, max }: StoredWidthOptions): [number, (next: number) => void, () => void] {
	const [width, setWidth] = useState<number>(() => {
		try {
			const raw = localStorage.getItem(storageKey);
			const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
			return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
		} catch {
			return fallback;
		}
	});

	const persist = useCallback(
		(next: number) => {
			const value = clamp(next, min, max);
			setWidth(value);
			try {
				localStorage.setItem(storageKey, String(value));
			} catch {
				// 写不进去不影响本次会话的效果。
			}
		},
		[storageKey, min, max],
	);

	const reset = useCallback(() => persist(fallback), [persist, fallback]);

	return [width, persist, reset];
}

export function useSidebarWidth(): [number, (next: number) => void, () => void] {
	return useStoredWidth({ storageKey: "hanshuang-pojia:sidebar-width", fallback: SIDEBAR_DEFAULT, min: SIDEBAR_MIN, max: SIDEBAR_MAX });
}

export interface SplitHandleProps {
	/** 当前宽度，用于键盘微调与 `aria-valuenow`。 */
	value: number;
	min: number;
	max: number;
	onChange(next: number): void;
	onReset?(): void;
	/** 拖拽时把手柄画在容器右侧还是左侧。 */
	side?: "left" | "right";
	label: string;
}

/**
 * 竖向拖拽把手。
 *
 * 命中区 9px、视觉只有 1px：细到不抢视线，但仍然抓得住。
 * 键盘可用（←/→ 每次 12px，Home/End 到两端），双击回默认——
 * 只能用鼠标拖的把手，对键盘用户等于不存在。
 */
export function SplitHandle({ value, min, max, onChange, onReset, side = "left", label }: SplitHandleProps) {
	const dragging = useRef<{ startX: number; startValue: number } | null>(null);

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragging.current = { startX: event.clientX, startValue: value };
	};

	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const state = dragging.current;
		if (!state) return;
		const delta = event.clientX - state.startX;
		// 手柄在左意味着「往左拖变宽」，方向要反过来。
		onChange(side === "left" ? state.startValue - delta : state.startValue + delta);
	};

	const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		dragging.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const step = 12;
		const grow = side === "left" ? -step : step;
		if (event.key === "ArrowRight") {
			event.preventDefault();
			onChange(value + grow);
		} else if (event.key === "ArrowLeft") {
			event.preventDefault();
			onChange(value - grow);
		} else if (event.key === "Home") {
			event.preventDefault();
			onChange(min);
		} else if (event.key === "End") {
			event.preventDefault();
			onChange(max);
		}
	};

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={label}
			aria-valuenow={Math.round(value)}
			aria-valuemin={min}
			aria-valuemax={max}
			tabIndex={0}
			data-testid="split-handle"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onDoubleClick={onReset}
			onKeyDown={onKeyDown}
			className="group relative flex w-[9px] shrink-0 cursor-col-resize touch-none items-center justify-center outline-none"
		>
			<span aria-hidden className="h-full w-px bg-line-subtle transition-colors group-hover:bg-line-strong group-focus-visible:bg-purple" />
		</div>
	);
}
