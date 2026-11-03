import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { seedFor, withShape, type SurfaceMode } from "../../../domain/kernel-document.ts";
import { KernelEngine } from "./engine.ts";
import { surfacePreset } from "./presets.ts";
import { setCraftEngine } from "../session-registry.ts";

/**
 * React glue: build one engine, publish it to the registry, subscribe to its version.
 * `useSyncExternalStore` rather than a copy of the document in state — the engine is
 * the single source of truth and a second copy would drift.
 */

export interface KernelConfig {
	mode: SurfaceMode;
	width?: number;
	height?: number;
	accent?: string;
	background?: string;
}

export function createEngine(config: KernelConfig): KernelEngine {
	const preset = surfacePreset(config.mode);
	const engine = new KernelEngine({
		mode: config.mode,
		width: config.width ?? preset.size.width,
		height: config.height ?? preset.size.height,
		background: config.background ?? preset.background,
		accent: config.accent ?? "#2f6df6",
		grid: config.mode === "sheet" ? 28 : config.mode === "doc" ? 40 : config.mode === "stage" ? 60 : 10,
	});
	let document = engine.document();
	for (const guide of seedFor(config.mode, document.width, document.height)) {
		document = withShape(document, guide);
	}
	engine.setDocument(document);
	engine.markSaved();
	return engine;
}

export function useEngine(config: KernelConfig): { engine: KernelEngine; version: number } {
	const { mode, width, height, accent, background } = config;
	const engine = useMemo(
		() => createEngine({ mode, width, height, accent, background }),
		[mode, width, height, accent, background],
	);

	useEffect(() => {
		setCraftEngine(engine);
		return () => setCraftEngine(null);
	}, [engine]);

	const subscribe = useCallback((notify: () => void) => engine.subscribe(notify), [engine]);
	const snapshot = useCallback(() => engine.versionOf(), [engine]);
	const version = useSyncExternalStore(subscribe, snapshot, snapshot);

	return { engine, version };
}
