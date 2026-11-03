import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fullscreen for the editor pane only — not the window.
 *
 * The host tab is already a full window, so the useful gesture is "give the canvas
 * every pixel this tab has, then give the panels back". `Esc` exits natively.
 */

export interface ContainerFullscreen {
	ref: React.RefObject<HTMLDivElement | null>;
	fullscreen: boolean;
	toggle: () => void;
}

export function useContainerFullscreen(): ContainerFullscreen {
	const ref = useRef<HTMLDivElement | null>(null);
	const [fullscreen, setFullscreen] = useState(false);

	useEffect(() => {
		const onChange = () => setFullscreen(!!document.fullscreenElement);
		document.addEventListener("fullscreenchange", onChange);
		return () => document.removeEventListener("fullscreenchange", onChange);
	}, []);

	const toggle = useCallback(() => {
		const node = ref.current;
		if (!node) return;
		if (document.fullscreenElement) {
			void document.exitFullscreen();
			return;
		}
		void node.requestFullscreen?.().catch(() => setFullscreen(false));
	}, []);

	return { ref, fullscreen, toggle };
}
