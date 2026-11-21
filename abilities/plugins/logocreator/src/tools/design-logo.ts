import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { renderLogo } from "../domain/engine/compose";
import { kitSlug } from "../domain/brand-kit";
import { newDesignId } from "../domain/history-store";
import { AUTO } from "../domain/spec";
import { getHistoryStore, getPluginContext } from "../plugin-context";
import { LOGO_TAB_ID, TOOL_DESIGN } from "../tab-ids";
import { DESIGN_PROPERTIES, specFromInput, type DesignToolPayload } from "./spec-from-input";

const SEED_STRIDE = 7919;

interface DesignToolResult {
	ok: boolean;
	brand: string;
	subject: string;
	files: string[];
	designs: { file: string; subject: string; seed: number; style: string }[];
	notes: string[];
}

/**
 * `logocreator_design` — write real vector logos into the workspace.
 *
 * SVG only, on purpose: the local engine is a string generator, so this tool
 * needs no canvas, no network and no key. The panel is opened alongside so the
 * user can see what was written and iterate on it.
 */
export function createDesignTool(): PluginAgentToolRegistration<DesignToolPayload> {
	return {
		id: TOOL_DESIGN,
		name: TOOL_DESIGN,
		label: "%tool.design.label%",
		description: [
			"Design a logo with the built-in vector engine and write the SVG files into the workspace.",
			"Every file is real vector art: a 512×512 canvas with the mark, the wordmark and the palette resolved from the brief. The same fields plus the same seed reproduce the same bytes, so a design can be regenerated later.",
			"Use it when the user asks for a logo, an app icon, a wordmark or a brand mark. Prefer describing the subject in `intent` (\"a leaf mark for a plant nursery\") over naming a motif directly; the engine picks the first subject word it recognises.",
			"For a full kit (variants, palette files, brand guide) call logocreator_brand_kit afterwards.",
			"Do NOT use it for editing an existing image, for photo retouching, or for laying out a page around a logo — those are other tools' jobs.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: DESIGN_PROPERTIES,
			required: ["brandName"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger, session }) => {
			const input = trigger.input ?? {};
			const spec = specFromInput(input);
			if (!spec.brandName.trim()) {
				return { ok: false, error: "brandName is required" };
			}
			const count = Math.max(1, Math.min(8, Number(input.count) || 3));
			const folder = resolveFolder(session.cwd, input.directory, spec.brandName);
			const fs = getPluginContext().fs;
			const notes: string[] = [];

			await fs.createDirectory(folder).catch(() => undefined);

			const designs: DesignToolResult["designs"] = [];
			const files: string[] = [];
			let lastSubject = "";

			for (let index = 0; index < count; index += 1) {
				const variant = { ...spec, seed: (spec.seed + index * SEED_STRIDE) >>> 0 };
				const rendered = renderLogo(variant);
				lastSubject = rendered.subject;
				const suffix = count === 1 ? "" : `-${index + 1}`;
				const file = `${folder}/${kitSlug(spec)}${suffix}.svg`;
				await fs.writeFile(file, rendered.svg, "utf8");
				files.push(file);
				designs.push({ file, subject: rendered.subject, seed: variant.seed, style: variant.style });
				await getHistoryStore()
					.add({ id: newDesignId(), spec: variant, engine: "local", subject: rendered.subject })
					.catch((cause) => {
						notes.push(`The design was written but not stored in the panel history: ${describe(cause)}`);
					});
			}

			if (spec.primary === AUTO) {
				notes.push("Colour was chosen by the engine from the brief. Pass an explicit hex to pin it.");
			}

			try {
				getPluginContext().ui.openActivityTab(LOGO_TAB_ID, { width: "max" });
			} catch (cause) {
				notes.push(`The studio panel could not be opened: ${describe(cause)}`);
			}

			return {
				ok: true,
				brand: spec.brandName,
				subject: lastSubject,
				files,
				designs,
				notes,
			} satisfies DesignToolResult;
		},
	};
}

function resolveFolder(cwd: string, directory: string | undefined, brand: string): string {
	const trimmed = (directory ?? "logos").replace(/^[/\\]+/, "").replace(/[/\\]+$/, "");
	const base = cwd.replace(/[/\\]+$/, "");
	return `${base}/${trimmed}/${kitSlug({ brandName: brand })}`;
}

function describe(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
