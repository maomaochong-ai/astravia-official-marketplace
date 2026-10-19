/** Engines that can resolve a page and download a rendition. */
export type EngineName = "lux" | "yt-dlp";

/** What the user picked in settings: a fixed engine, or "try the default first". */
export type EnginePreference = "auto" | EngineName;

export const ENGINE_NAMES: readonly EngineName[] = ["lux", "yt-dlp"];
export const ENGINE_PREFERENCES: readonly EnginePreference[] = ["auto", "lux", "yt-dlp"];

export function isEngineName(value: unknown): value is EngineName {
  return value === "lux" || value === "yt-dlp";
}

export function normalizeEnginePreference(value: unknown): EnginePreference {
  return value === "auto" || isEngineName(value) ? value : "auto";
}

/**
 * Engines to try, in order.
 *
 * `auto` keeps lux as the default because it is bundled with the service and needs no extra
 * download; yt-dlp is the fallback for pages lux refuses.
 */
export function engineOrder(preference: EnginePreference): EngineName[] {
  return preference === "auto" ? ["lux", "yt-dlp"] : [preference];
}
