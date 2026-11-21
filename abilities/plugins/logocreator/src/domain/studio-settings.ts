import type { PluginStorageApi } from "@astravia-org/plugin-sdk";

/** Plugin settings that are not secrets. The API key lives in `ctx.secrets`. */
export interface StudioSettings {
	/** Together AI image model id. */
	model: string;
	/** How many variations one run produces. */
	variations: number;
	/** Last used tagline, so a reopened studio keeps the form. */
	lastTagline?: string;
}

export const SETTINGS_PATH = "settings.json";

export const DEFAULT_SETTINGS: StudioSettings = {
	model: "black-forest-labs/FLUX.1-schnell",
	variations: 4,
};

const ALLOWED_MODELS = [
	"black-forest-labs/FLUX.1-schnell",
	"black-forest-labs/FLUX.1-dev",
	"black-forest-labs/FLUX.1-pro",
];

export function normalizeSettings(raw: unknown): StudioSettings {
	const value = (raw ?? {}) as Partial<StudioSettings>;
	const variations = Number(value.variations);
	return {
		model: typeof value.model === "string" && value.model.trim() ? value.model.trim() : DEFAULT_SETTINGS.model,
		variations: Number.isFinite(variations) ? Math.max(1, Math.min(8, Math.round(variations))) : DEFAULT_SETTINGS.variations,
		lastTagline: typeof value.lastTagline === "string" ? value.lastTagline : undefined,
	};
}

export function suggestedModels(): string[] {
	return [...ALLOWED_MODELS];
}

export async function loadSettings(storage: PluginStorageApi): Promise<StudioSettings> {
	try {
		const raw = await storage.readFile(SETTINGS_PATH, "utf8");
		return raw ? normalizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export async function saveSettings(storage: PluginStorageApi, settings: StudioSettings): Promise<void> {
	await storage.writeFile(SETTINGS_PATH, JSON.stringify(normalizeSettings(settings), null, 2), "utf8");
}
