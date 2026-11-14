/**
 * The drag that sets the composer's height.
 *
 * The pointer work is here; the arithmetic and its bounds are in `composer-height.ts`.
 * Pointer capture is what makes the gesture survive the pointer leaving the 8px handle —
 * without it a fast drag stops halfway, which reads as "the handle does not work".
 *
 * Height is written as a CSS custom property on the box rather than to element style
 * directly: the same box renders a textarea, a hint row and a border, and the variable
 * lets the stylesheet decide which of them grows.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
	composerHeightBounds,
	nudgeComposerHeight,
	nextComposerHeight,
	readStoredComposerHeight,
	writeStoredComposerHeight,
} from "../composer-height";

export interface ComposerHeight {
	/** `undefined` means "let the stylesheet decide" (the box's own default). */
	height: number | undefined;
	/** Props for the handle element. */
	handleProps: {
		onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
		onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
		onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
		onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
	};
}

/** One step for the keyboard: enough to be visible, small enough to be precise. */
const KEY_STEP_PX = 16;

export function useComposerHeight(): ComposerHeight {
	const [height, setHeight] = useState<number | undefined>(undefined);
	// Sampled at pointerdown: the pointer's own positions are absolute, and comparing the
	// start height to a running `dy` is what keeps the box from creeping under the cursor.
	const origin = useRef<{ y: number; height: number } | null>(null);

	useEffect(() => {
		const viewport = globalThis.innerHeight ?? 800;
		setHeight(readStoredComposerHeight(viewport));
	}, []);

	const commit = useCallback((next: number) => {
		setHeight(next);
		writeStoredComposerHeight(next);
	}, []);

	const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
		const box = event.currentTarget.parentElement;
		const measured = box?.getBoundingClientRect().height ?? height ?? 0;
		origin.current = { y: event.clientY, height: measured };
		event.currentTarget.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	}, [height]);

	const onPointerMove = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			const start = origin.current;
			if (!start) return;
			const { min, max } = composerHeightBounds(globalThis.innerHeight ?? 800);
			commit(nextComposerHeight({ start: start.height, dy: event.clientY - start.y, min, max }));
		},
		[commit],
	);

	const onPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
		origin.current = null;
		event.currentTarget.releasePointerCapture?.(event.pointerId);
	}, []);

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>) => {
			const grow = event.key === "ArrowUp" ? KEY_STEP_PX : event.key === "ArrowDown" ? -KEY_STEP_PX : 0;
			if (!grow) return;
			event.preventDefault();
			const box = event.currentTarget.parentElement;
			const measured = box?.getBoundingClientRect().height ?? height ?? 0;
			const { min, max } = composerHeightBounds(globalThis.innerHeight ?? 800);
			commit(nudgeComposerHeight({ start: measured, delta: grow, min, max }));
		},
		[commit, height],
	);

	return { height, handleProps: { onPointerDown, onPointerMove, onPointerUp, onKeyDown } };
}
