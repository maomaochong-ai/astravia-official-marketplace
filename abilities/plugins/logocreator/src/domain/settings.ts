import type { PluginStorageApi } from "@astravia-org/plugin-sdk";

/**
 * Plugin settings that are not secrets — and there are none left of that kind:
 * the AI path now runs on the host's own image providers, so no API key is stored
 * here (and none is stored in `ctx.secrets` either).
 */
export interface PluginSettings {
	/** How many variations one run produces. */
	variations: number;
	/** Host provider id chosen for AI runs; empty means "first that can do it". */
	providerId?: string;
}

export const SETTINGS_PATH = "settings.json";

export const DEFAULT_SETTINGS: PluginSettings = {
	variations: 3,
};

export function normalizeSettings(raw: unknown): PluginSettings {
	const value = (raw ?? {}) as Partial<PluginSettings>;
	const variations = Number(value.variations);
	return {
		variations: Number.isFinite(variations) ? Math.max(1, Math.min(8, Math.round(variations))) : DEFAULT_SETTINGS.variations,
		providerId: typeof value.providerId === "string" && value.providerId.trim() ? value.providerId.trim() : undefined,
	};
}

export async function loadSettings(storage: PluginStorageApi): Promise<PluginSettings> {
	try {
		const raw = await storage.readFile(SETTINGS_PATH, "utf8");
		return raw ? normalizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
	} catch {
		// An unreadable settings file must not block the studio; defaults are fine.
		return { ...DEFAULT_SETTINGS };
	}
}

export async function saveSettings(storage: PluginStorageApi, settings: PluginSettings): Promise<void> {
	await storage.writeFile(SETTINGS_PATH, JSON.stringify(normalizeSettings(settings), null, 2), "utf8");
}
