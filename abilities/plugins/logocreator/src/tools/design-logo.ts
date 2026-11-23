import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { renderLogo } from "../domain/engine/compose";
import { kitSlug } from "../domain/brand-kit";
import { designFolder, variantPath, writeManifest } from "../domain/design-folder";
import { newDesignId } from "../domain/history-store";
import { AUTO } from "../domain/spec";
import { getHistoryStore, getPluginContext } from "../plugin-context";
import { TOOL_LABELS } from "../contributions";
import { revealInCanvas } from "../features/canvas/reveal";
import { TOOL_DESIGN } from "../tab-ids";
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
		label: TOOL_LABELS.design,
		description: [
			"Design a logo with the built-in vector engine and write the SVG files into the workspace.",
			"Every file is real vector art: a 512×512 canvas with the mark, the wordmark and the palette resolved from the brief. The same fields plus the same seed reproduce the same bytes, so a design can be regenerated later.",
			"Files land in ONE folder per brand — `logo-designs/<slug>/` — with `design.json` (spec, palette, every variant), `mark.svg` (the primary one) and `variants/1.svg …`. There is no per-run folder explosion: a second run updates the same manifest and adds variants beside the old ones.",
			"The panel opens on the newest design automatically.",
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
			const folder = designFolder(session.cwd, input.directory, spec.brandName);
			const fs = getPluginContext().fs;
			const notes: string[] = [];

			await fs.createDirectory(folder).catch(() => undefined);
			await fs.createDirectory(`${folder}/variants`).catch(() => undefined);

			const designs: DesignToolResult["designs"] = [];
			const files: string[] = [];
			const variants: NonNullable<Parameters<typeof writeManifest>[2]["variants"]>[number][] = [];
			let lastSubject = "";
			let lastDesignId: string | null = null;
			let palette: Record<string, string> = {};

			for (let index = 0; index < count; index += 1) {
				const variant = { ...spec, seed: (spec.seed + index * SEED_STRIDE) >>> 0 };
				const rendered = renderLogo(variant);
				lastSubject = rendered.subject;
				if (index === 0) palette = rendered.palette as unknown as Record<string, string>;
				const relative = variantPath(index);
				const file = `${folder}/${relative}`;
				await fs.writeFile(file, rendered.svg, "utf8");
				files.push(file);
				variants.push({ file: relative, subject: rendered.subject, seed: variant.seed, style: variant.style, engine: "local" });
				designs.push({ file, subject: rendered.subject, seed: variant.seed, style: variant.style });
				const recordId = newDesignId();
				await getHistoryStore()
					.add({ id: recordId, spec: variant, engine: "local", subject: rendered.subject })
					.then(() => {
						lastDesignId = recordId;
					})
					.catch((cause) => {
						notes.push(`The design was written but not stored in the panel history: ${describe(cause)}`);
					});
			}

			// 主变体另存一份 `mark.svg`：取用时不必先弄懂 variants 目录，也不必数序号。
			if (designs.length > 0) {
				const primary = designs[0]!;
				await fs.readFile(primary.file).then(
					async read => {
						await fs.writeFile(`${folder}/mark.svg`, read.content, "utf8");
						files.push(`${folder}/mark.svg`);
					},
					() => undefined,
				);
			}

			await writeManifest(fs, folder, {
				brand: spec.brandName,
				slug: folder.split("/").pop() ?? kitSlug(spec),
				primary: designs[0] ? "mark.svg" : "",
				spec,
				palette,
				variants,
			}).catch((cause) => {
				notes.push(`The manifest could not be written (${describe(cause)}); the SVGs are still there.`);
			});

			if (spec.primary === AUTO) {
				notes.push("Colour was chosen by the engine from the brief. Pass an explicit hex to pin it.");
			}

			// Hand the newest design to the panel and put it on screen. Opening the tab onto
			// the *previous* design reads as "the tool did nothing" (the reference plugin's
			// `setPendingDesignPath` / `claimCanvasReveal` pair exists for the same reason).
			// `revealInCanvas` opens without a cwd so the host targets the conversation it is
			// displaying — a tool-session cwd that differs from it records the tab somewhere
			// nobody is looking.
			if (lastDesignId) {
				const reveal = revealInCanvas(getPluginContext(), session.cwd, lastDesignId);
				if (!reveal.opened) notes.push(`The design is stored but the canvas could not be opened: ${reveal.error ?? "unknown"}`);
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


function describe(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
