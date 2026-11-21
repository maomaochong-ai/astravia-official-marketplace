import { useCallback, useEffect, useRef, useState } from "react";
import { generateMarksWithHost, HostMediaError, listImageProviders, type HostImageProvider } from "../../../domain/ai/host-media";
import { renderLogo } from "../../../domain/engine/compose";
import { newDesignId } from "../../../domain/history-store";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type PluginSettings } from "../../../domain/settings";
import { STYLE_IDS, type LogoSpec } from "../../../domain/spec";
import { getHistoryStore, getPluginContext, reportError } from "../../../plugin-context";

export type EngineMode = "local" | "ai";

export interface GenerateOptions {
	/** Roll a different style for each variation, like a deck of cards. */
	surprise?: boolean;
	/**
	 * Run this one batch on a specific line, regardless of the current toggle.
	 * Needed because "switch mode, then generate" in one handler reads the previous
	 * state — the vector path would run while the button said "image".
	 */
	mode?: EngineMode;
}

export interface GenerationApi {
	mode: EngineMode;
	setMode: (mode: EngineMode) => void;
	running: boolean;
	settings: PluginSettings;
	updateSettings: (patch: Partial<PluginSettings>) => void;
	updateVariations: (value: number) => void;
	/** Host image providers that can do text-to-image, refreshed on demand. */
	providers: HostImageProvider[];
	/** The host denied `media.generate` — the user has to re-authorise the plugin. */
	aiDenied: boolean;
	refreshProviders: () => Promise<void>;
	generate: (spec: LogoSpec, options?: GenerateOptions) => Promise<void>;
	lastCreatedId: string | null;
}

const SEED_STRIDE = 7919;

/**
 * One "run": N designs from one spec.
 *
 * The local engine is a pure function, so its run finishes synchronously — the
 * gallery is the only feedback needed. The AI branch goes through the host's media
 * providers (`ctx.media`), which is why this plugin asks for no API key, no network
 * permission and no vault access.
 */
export function useGeneration(messages: {
	aiUnavailable: string;
	/** Shown when the raster path was asked for but nothing is connected. */
	aiNoProvider: string;
	aiFailed: string;
	localFailed: string;
	aiDone: (count: number) => string;
	aiPartial: (failed: number) => string;
}): GenerationApi {
	const [mode, setMode] = useState<EngineMode>("local");
	const [running, setRunning] = useState(false);
	const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS);
	const [providers, setProviders] = useState<HostImageProvider[]>([]);
	/** True when the host denied `media.generate`; the dialog then points at re-authorising. */
	const [aiDenied, setAiDenied] = useState(false);
	const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
	const busy = useRef(false);

	const refreshProviders = useCallback(async () => {
		try {
			setProviders(await listImageProviders(getPluginContext()));
			setAiDenied(false);
		} catch (cause) {
			// Two very different situations collapse into "the AI mode cannot run":
			// the host has no provider, or the host never granted the permission (an
			// upgrade does not carry new permissions). Keep them apart so the dialog can
			// tell the user which one to fix.
			setProviders([]);
			setAiDenied(cause instanceof HostMediaError && cause.code === "permission-denied");
			if (cause instanceof Error) console.warn("[logocreator] image providers unavailable", cause.message);
		}
	}, []);

	useEffect(() => {
		const ctx = getPluginContext();
		void loadSettings(ctx.storage).then(setSettings);
		void refreshProviders();
	}, [refreshProviders]);

	const updateSettings = useCallback((patch: Partial<PluginSettings>) => {
		setSettings((current) => {
			const next = normalizeNext(current, patch);
			void saveSettings(getPluginContext().storage, next).catch((cause) =>
				reportError("Could not save the studio settings", cause),
			);
			return next;
		});
	}, []);

	const updateVariations = useCallback(
		(value: number) => {
			updateSettings({ variations: Number.isFinite(value) ? value : DEFAULT_SETTINGS.variations });
		},
		[updateSettings],
	);

	const generate = useCallback(
		async (spec: LogoSpec, options: GenerateOptions = {}) => {
			if (busy.current) return;
			busy.current = true;
			setRunning(true);
			const history = getHistoryStore();
			const ctx = getPluginContext();
			const count = Math.max(1, Math.min(8, settings.variations));
			const runMode = options.mode ?? mode;

			try {
				if (runMode === "ai") {
					// Auto-detect first: a mode set before the provider disappeared must not
					// surface as a bare exception.
					if (providers.length === 0) {
						ctx.ui.notify({ message: messages.aiNoProvider, variant: "warning" });
						setMode("local");
						return;
					}
					const { images, failures } = await generateMarksWithHost(ctx, {
						spec,
						count,
						providerId: settings.providerId,
					});
					let lastId: string | null = null;
					for (const image of images) {
						const record = await history.add({
							id: newDesignId(),
							spec,
							engine: "ai",
							subject: image.modelId ?? image.providerId,
							blobId: image.blobId,
						});
						lastId = record.id;
					}
					setLastCreatedId(lastId);
					if (images.length > 0) {
						ctx.ui.notify({ message: messages.aiDone(images.length), variant: "success" });
					}
					if (failures.length > 0) {
						ctx.ui.notify({ message: messages.aiPartial(failures.length), variant: "warning" });
					}
					return;
				}

				let lastId: string | null = null;
				const styles = options.surprise ? shuffledStyles(spec.seed) : null;
				for (let index = 0; index < count; index += 1) {
					const variant: LogoSpec = {
						...spec,
						seed: (spec.seed + index * SEED_STRIDE) >>> 0,
						...(styles ? { style: styles[index % styles.length] } : {}),
					};
					const rendered = renderLogo(variant);
					const record = await history.add({
						id: newDesignId(),
						spec: variant,
						engine: "local",
						subject: rendered.subject,
					});
					lastId = record.id;
				}
				setLastCreatedId(lastId);
			} catch (cause) {
				if (cause instanceof HostMediaError) {
					ctx.ui.notify({
						message: cause.message,
						title: messages.aiUnavailable,
						variant: "error",
						error: cause,
					});
					// Do not leave the user on a mode that cannot run.
					setMode("local");
				} else if (runMode === "ai") {
					ctx.ui.notify({ message: messages.aiFailed, error: cause });
				} else {
					ctx.ui.notify({ message: messages.localFailed, error: cause });
				}
			} finally {
				setRunning(false);
				busy.current = false;
			}
		},
		[messages, mode, providers.length, settings.providerId, settings.variations],
	);

	return {
		mode,
		setMode,
		running,
		settings,
		updateSettings,
		updateVariations,
		providers,
		aiDenied,
		refreshProviders,
		generate,
		lastCreatedId,
	};
}

function normalizeNext(current: PluginSettings, patch: Partial<PluginSettings>): PluginSettings {
	const merged = { ...current, ...patch };
	const variations = Math.max(1, Math.min(8, Math.round(Number(merged.variations) || DEFAULT_SETTINGS.variations)));
	return { variations, providerId: merged.providerId?.trim() || undefined };
}

function shuffledStyles(seed: number): readonly LogoSpec["style"][] {
	const names = [...STYLE_IDS];
	let state = seed || 1;
	const random = () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
	for (let i = names.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[names[i], names[j]] = [names[j], names[i]];
	}
	return names;
}

