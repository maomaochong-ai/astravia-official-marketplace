import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { generateMarksWithHost, HostMediaError } from "../domain/ai/host-media";
import { newDesignId } from "../domain/history-store";
import { normalizeSpec } from "../domain/spec";
import { getHistoryStore, getPluginContext } from "../plugin-context";
import { setPendingDesignId } from "../features/canvas/pending-design";
import { TOOL_LABELS } from "../contributions";
import { LOGO_TAB_ID, TOOL_IMAGE } from "../tab-ids";

interface ImageToolInput {
	/** What the mark should look like, in the user's own words. */
	prompt: string;
	brandName?: string;
	/** 1–4. Each one is a separate paid job on the user's own provider account. */
	count?: number;
	/** Hex, so the raster sits in the same palette as the vector designs. */
	colour?: string;
}

interface ImageToolResult {
	ok: boolean;
	engine: "ai";
	images: { designId: string; subject: string }[];
	failures: string[];
	notes: string[];
}

/**
 * `logocreator_image` — the raster path, on the host's own image providers.
 *
 * Why this tool has to exist: the vector engine can only draw the subjects it owns
 * (26 pictograms). A brief like "a plush owl in a hoodie, seated" is outside that
 * vocabulary, and until now the skill told the agent to "go the AI route" with no tool
 * to walk to — so the agent handed the work to some other ability, the images landed
 * outside this plugin, and the panel stayed empty.
 *
 * Results go into the same history as vector designs (`engine: "ai"` + a blob), and
 * the panel is opened on the newest one, so both paths end in the same place.
 */
export function createImageTool(): PluginAgentToolRegistration<ImageToolInput> {
	return {
		id: TOOL_IMAGE,
		name: TOOL_IMAGE,
		label: TOOL_LABELS.image,
		description: [
			"Generate raster logo marks with the image providers the user already connected in Astravia, and store them in the LogoCreator history.",
			"Use it when the brief is outside the vector engine's vocabulary: photographic texture, a specific character pose, a mascot doing something, a collage or illustration. The engine draws 26 pictograms; anything it cannot draw belongs here.",
			"Results are PNG images: no SVG, no brand kit, and they cannot be rebuilt larger. Say that before the user plans print.",
			"`count` defaults to 3 and each job is billed to the user's own provider account, so do not raise it without being asked.",
			"If no image provider is connected, this tool fails with a message naming that — then fall back to `logocreator_design` and describe the closest vector subject instead of promising a drawing the engine cannot make.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description:
						"One sentence describing the mark: subject, framing, texture, mood. E.g. \"a plush red owl in a hoodie, seated, round glasses, flat background\".",
				},
				brandName: { type: "string", description: "Brand name, stored with the design." },
				count: { type: "integer", minimum: 1, maximum: 4, description: "How many variations (default 3)." },
				colour: { type: "string", description: "Optional 6-digit hex to anchor the palette." },
			},
			required: ["prompt"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger, session }) => {
			const input = trigger.input ?? { prompt: "" };
			const prompt = String(input.prompt ?? "").trim();
			if (!prompt) return { ok: false, error: "prompt is required" };

			// A spec carries the brand name and colour into the record so the panel's
			// form shows something coherent next to the raster.
			const spec = normalizeSpec({
				brandName: input.brandName ?? "",
				intent: prompt,
				primary: input.colour ?? "auto",
			});

			const ctx = getPluginContext();
			const history = getHistoryStore();

			let generated: Awaited<ReturnType<typeof generateMarksWithHost>>;
			try {
				generated = await generateMarksWithHost(ctx, { spec, count: Number(input.count) || 3 });
			} catch (cause) {
				if (cause instanceof HostMediaError) {
					return { ok: false, error: cause.message, code: cause.code, notes: ["Fall back to logocreator_design with the closest vector subject."] };
				}
				return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
			}

			const images: ImageToolResult["images"] = [];
			let lastDesignId: string | null = null;
			for (const image of generated.images) {
				const designId = newDesignId();
				await history.add({ id: designId, spec, engine: "ai", subject: image.modelId ?? "image", blobId: image.blobId });
				images.push({ designId, subject: image.modelId ?? "image" });
				lastDesignId = designId;
			}

			if (lastDesignId) {
				// Same hand-off as the vector tool: the panel opens on this design.
				setPendingDesignId(session.cwd, lastDesignId);
				try {
					ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true, { cwd: session.cwd });
					ctx.ui.openActivityTab(LOGO_TAB_ID, { width: "max", cwd: session.cwd });
				} catch {
					// Opening the tab is convenience; the designs are already stored.
				}
			}

			return {
				ok: true,
				engine: "ai",
				images,
				failures: generated.failures,
				notes: [
					"Raster output: PNG only, no SVG or brand kit, cannot be enlarged.",
					"Vector designs and raster marks live in the same history; the panel labels them AI or Vector.",
				],
			} satisfies ImageToolResult;
		},
	};
}
