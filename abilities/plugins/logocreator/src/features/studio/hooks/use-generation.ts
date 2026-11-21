import { useCallback, useEffect, useRef, useState } from "react";
import { generateWithTogether, AiGenerationError, TOGETHER_KEY_NAME } from "../../../domain/ai/together-client";
import { renderLogo } from "../../../domain/engine/compose";
import { newDesignId } from "../../../domain/history-store";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type StudioSettings } from "../../../domain/studio-settings";
import { STYLE_IDS, type LogoSpec } from "../../../domain/spec";
import { getHistoryStore, getPluginContext, reportError } from "../../../plugin-context";

export type EngineMode = "local" | "ai";

export interface GenerateOptions {
	/** Roll a different style for each variation, like upstream's "feeling lucky". */
	surprise?: boolean;
}

export interface GenerationApi {
	mode: EngineMode;
	setMode: (mode: EngineMode) => void;
	running: boolean;
	stage: string | null;
	settings: StudioSettings;
	updateSettings: (patch: Partial<StudioSettings>) => void;
	hasKey: boolean;
	saveKey: (key: string) => Promise<void>;
	forgetKey: () => Promise<void>;
	generate: (spec: LogoSpec, options?: GenerateOptions) => Promise<void>;
	lastCreatedId: string | null;
}

const SEED_STRIDE = 7919;

/**
 * One "run": N designs from one spec.
 *
 * The local engine renders synchronously — it is pure string building — so a run
 * lands immediately and the gallery is the only feedback needed. The AI path is
 * the slow one, and its images are put into host blob storage because they cannot
 * be re-derived from a spec the way an engine mark can.
 */
export function useGeneration(messages: {
	aiKeyRequired: string;
	aiFailed: string;
	localFailed: string;
	aiDone: (count: number) => string;
	keySaved: string;
	keyCleared: string;
	keyFailed: string;
}): GenerationApi {
	const [mode, setMode] = useState<EngineMode>("local");
	const [running, setRunning] = useState(false);
	const [stage, setStage] = useState<string | null>(null);
	const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
	const [hasKey, setHasKey] = useState(false);
	const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
	const busy = useRef(false);

	useEffect(() => {
		const ctx = getPluginContext();
		void loadSettings(ctx.storage).then(setSettings);
		void ctx.secrets.has(TOGETHER_KEY_NAME).then(setHasKey).catch(() => setHasKey(false));
	}, []);

	const updateSettings = useCallback((patch: Partial<StudioSettings>) => {
		setSettings((current) => {
			const next = { ...current, ...patch };
			void saveSettings(getPluginContext().storage, next).catch((cause) =>
				reportError("Could not save the studio settings", cause),
			);
			return next;
		});
	}, []);

	const saveKey = useCallback(
		async (key: string) => {
			try {
				await getPluginContext().secrets.set(TOGETHER_KEY_NAME, key.trim());
				setHasKey(key.trim().length > 0);
				getPluginContext().ui.notify({ message: messages.keySaved, variant: "success" });
			} catch (cause) {
				reportError(messages.keyFailed, cause);
			}
		},
		[messages.keyCleared, messages.keyFailed, messages.keySaved],
	);

	const forgetKey = useCallback(async () => {
		try {
			await getPluginContext().secrets.delete(TOGETHER_KEY_NAME);
			setHasKey(false);
			setMode("local");
			getPluginContext().ui.notify({ message: messages.keyCleared, variant: "info" });
		} catch (cause) {
			reportError(messages.keyFailed, cause);
		}
	}, [messages.keyCleared, messages.keyFailed]);

	const generate = useCallback(
		async (spec: LogoSpec, options: GenerateOptions = {}) => {
			if (busy.current) return;
			busy.current = true;
			setRunning(true);
			setStage(null);
			const history = getHistoryStore();
			const ctx = getPluginContext();
			const count = Math.max(1, Math.min(8, settings.variations));

			try {
				if (mode === "ai") {
					const key = await ctx.secrets.get(TOGETHER_KEY_NAME);
					if (!key) {
						ctx.ui.notify({ message: messages.aiKeyRequired, variant: "warning" });
						setMode("local");
						return;
					}
					setStage("ai");
					const images = await generateWithTogether(ctx.network, {
						apiKey: key,
						model: settings.model,
						spec,
						count,
						seed: spec.seed % 100000,
					});
					setStage("saving");
					let lastId: string | null = null;
					for (const image of images) {
						const ref = await ctx.storage.putBlob({ data: image.base64, mimeType: "image/png" });
						const record = await history.add({
							id: newDesignId(),
							spec,
							engine: "ai",
							subject: image.model,
							blobId: ref.id,
						});
						lastId = record.id;
					}
					setLastCreatedId(lastId);
					ctx.ui.notify({ message: messages.aiDone(images.length), variant: "success" });
					return;
				}

				setStage("render");
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
				if (cause instanceof AiGenerationError) {
					ctx.ui.notify({ message: cause.message, variant: "error", error: cause });
				} else if (mode === "ai") {
					ctx.ui.notify({ message: messages.aiFailed, error: cause });
				} else {
					ctx.ui.notify({ message: messages.localFailed, error: cause });
				}
			} finally {
				setStage(null);
				setRunning(false);
				busy.current = false;
			}
		},
		[messages.aiFailed, messages.aiKeyRequired, messages.localFailed, mode, settings.model, settings.variations],
	);

	return {
		mode,
		setMode,
		running,
		stage,
		settings,
		updateSettings,
		hasKey,
		saveKey,
		forgetKey,
		generate,
		lastCreatedId,
	};
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
