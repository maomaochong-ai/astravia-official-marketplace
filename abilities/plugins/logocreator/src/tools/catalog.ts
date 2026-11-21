import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { DETAIL_ENTRIES, STYLE_ENTRIES, TYPE_ENTRIES } from "../domain/catalog";
import { availableSubjects } from "../domain/engine/compose";
import { TOOL_CATALOG } from "../tab-ids";
import { TOOL_LABELS } from "../contributions";

interface CatalogResult {
	ok: true;
	types: { id: string; label: string; structure: string; hint: string }[];
	styles: { id: string; label: string; hint: string }[];
	detailLevels: string[];
	subjects: string[];
	engine: { canvas: string; output: string; deterministic: string; offline: string };
}

/**
 * `logocreator_catalog` — the engine's vocabulary.
 *
 * Exists so the model can choose a style and subject without guessing: an
 * invented style id silently falls back to "minimal", which reads as the engine
 * ignoring the request.
 */
export function createCatalogTool(): PluginAgentToolRegistration<Record<string, never>> {
	return {
		id: TOOL_CATALOG,
		name: TOOL_CATALOG,
		label: TOOL_LABELS.catalog,
		description: [
			"List what the LogoCreator engine can draw: logo types, styles, detail levels and the pictorial subjects it recognises.",
			"Call it before designing when you are unsure which style id or subject word is valid. It reads nothing and changes nothing.",
			"Do NOT call it when the user already named a style that appears in this list, or for anything unrelated to logos.",
		].join("\n"),
		parameters: { type: "object", properties: {}, additionalProperties: false },
		scope_use: ["conversation", "project"],
		handler: () =>
			({
				ok: true,
				types: TYPE_ENTRIES.map((entry) => ({
					id: entry.id,
					label: entry.labelKey,
					structure: entry.structureKey,
					hint: entry.hintKey,
				})),
				styles: STYLE_ENTRIES.map((entry) => ({ id: entry.id, label: entry.labelKey, hint: entry.hintKey })),
				detailLevels: DETAIL_ENTRIES.map((entry) => entry.id),
				subjects: availableSubjects(),
				engine: {
					canvas: "512×512",
					output: "standalone SVG (no external font, image or stylesheet)",
					deterministic: "same fields + same seed reproduce the same bytes",
					offline: "no network and no API key required",
				},
			}) satisfies CatalogResult,
	};
}
