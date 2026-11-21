import { useCallback, useRef, useState } from "react";
import { STARTER_PRESETS, type StarterPreset } from "../../../domain/catalog";
import { AUTO, DEFAULT_SPEC, normalizeSpec, type LogoSpec } from "../../../domain/spec";

export interface LogoFormApi {
	spec: LogoSpec;
	patch: (next: Partial<LogoSpec>) => void;
	applyPreset: (preset: StarterPreset) => void;
	activePreset: string | null;
	surprise: () => void;
	reset: () => void;
	load: (spec: LogoSpec) => void;
}

/**
 * The form. Values are the spec itself, so "load a saved design" and "type a new
 * name" are the same operation — there is no second shape of state to keep in
 * sync, which is where form/result drift usually comes from.
 */
export function useLogoForm(initial?: Partial<LogoSpec>): LogoFormApi {
	const [spec, setSpec] = useState<LogoSpec>(() => normalizeSpec({ ...DEFAULT_SPEC, ...initial }));
	const [activePreset, setActivePreset] = useState<string | null>(null);
	// A manual edit after picking a preset means the preset no longer describes
	// the form; the chip should stop claiming it does.
	const presetRef = useRef(activePreset);

	const patch = useCallback((next: Partial<LogoSpec>) => {
		setSpec((current) => normalizeSpec({ ...current, ...next }));
		if (presetRef.current && Object.keys(next).some((key) => key !== "intent")) {
			presetRef.current = null;
			setActivePreset(null);
		}
	}, []);

	const applyPreset = useCallback((preset: StarterPreset) => {
		setSpec((current) => {
			const isActive = presetRef.current === preset.id;
			presetRef.current = isActive ? null : preset.id;
			setActivePreset(isActive ? null : preset.id);
			return normalizeSpec({
				...current,
				type: preset.type,
				style: preset.style,
				detail: preset.detail,
				intent: preset.intent,
				surface: preset.surface,
				...(isActive ? { primary: AUTO } : {}),
			});
		});
	}, []);

	const surprise = useCallback(() => {
		setSpec((current) =>
			normalizeSpec({
				...current,
				primary: AUTO,
				detail: "balanced",
				seed: Math.floor(Math.random() * 0xffffffff),
			}),
		);
		presetRef.current = null;
		setActivePreset(null);
	}, []);

	const reset = useCallback(() => {
		setSpec((current) => normalizeSpec({ ...DEFAULT_SPEC, brandName: current.brandName }));
		presetRef.current = null;
		setActivePreset(null);
	}, []);

	const load = useCallback((next: LogoSpec) => {
		setSpec(normalizeSpec(next));
		presetRef.current = null;
		setActivePreset(null);
	}, []);

	return { spec, patch, applyPreset, activePreset, surprise, reset, load };
}

export { STARTER_PRESETS };
