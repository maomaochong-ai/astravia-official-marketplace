import type { PluginAgentToolRegistration, PluginImageRef } from "@astravia-org/plugin-sdk";
import { generateMarksWithHost, HostMediaError } from "../domain/ai/host-media";
import { newDesignId } from "../domain/history-store";
import { designFolder, writeManifest } from "../domain/design-folder";
import { normalizeSpec } from "../domain/spec";
import { getHistoryStore, getPluginContext } from "../plugin-context";
import { revealInCanvas } from "../features/canvas/reveal";
import { TOOL_LABELS } from "../contributions";
import { TOOL_IMAGE } from "../tab-ids";

interface ImageToolInput {
	/** What the mark should look like, in the user's own words. */
	prompt: string;
	brandName?: string;
	/** 1–4. Each one is a separate paid job on the user's own provider account. */
	count?: number;
	/** Hex, so the raster sits in the same palette as the vector designs. */
	colour?: string;
	/**
	 * A previously generated image to edit (a card's ref, or the attached target).
	 * With this set the provider runs image-to-image and `count` is forced to 1.
	 */
	referenceImageId?: string;
}

interface ImageToolResult {
	ok: boolean;
	engine: "ai";
	/** Refs the host can render; the card payload carries the same list. */
	images: PluginImageRef[];
	designIds: string[];
	/** Descriptor for the conversation card (host reads `details.cards`). */
	cards: { type: string; key?: string; payload: unknown }[];
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

			const reference = typeof input.referenceImageId === "string" ? input.referenceImageId : undefined;
			let generated: Awaited<ReturnType<typeof generateMarksWithHost>>;
			try {
				generated = await generateMarksWithHost(ctx, {
					spec,
					// An edit produces one result by definition; more would be different edits.
					count: reference ? 1 : Number(input.count) || 3,
					...(reference ? { referenceBlobId: reference } : {}),
				});
			} catch (cause) {
				if (cause instanceof HostMediaError) {
					return { ok: false, error: cause.message, code: cause.code, notes: ["Fall back to logocreator_design with the closest vector subject."] };
				}
				return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
			}

			const images: PluginImageRef[] = [];
			const designIds: string[] = [];
			let lastDesignId: string | null = null;
			// 位图也要落成带后缀的设计包：否则画布能看、文件树里却找不到它，
			// 「对话生成一个可打开的包」对 AI 稿就是空承诺。
			// `fs` 是可选通道（旧宿主或未授 `fs.write` 时不在）：没有就只写历史，不宣称落盘。
			const fsApi = ctx.fs ?? null;
			const folder = session.cwd && fsApi ? designFolder(session.cwd, undefined, spec.brandName) : null;
			if (folder && fsApi) {
				await fsApi.createDirectory(folder).catch(() => undefined);
				await fsApi.createDirectory(`${folder}/variants`).catch(() => undefined);
			}
			const variants: NonNullable<Parameters<typeof writeManifest>[2]["variants"]>[number][] = [];

			for (const [index, image] of generated.images.entries()) {
				const designId = newDesignId();
				await history.add({ id: designId, spec, engine: "ai", subject: image.modelId ?? "image", blobId: image.blobId });

				if (folder && fsApi) {
					const blob = await ctx.storage.readBlob(image.blobId).catch(() => null);
					if (blob) {
						const relative = `variants/${index + 1}.png`;
						await fsApi.writeFile(`${folder}/${relative}`, blob.data, "base64").catch(() => undefined);
						variants.push({
							file: relative,
							subject: image.modelId ?? "image",
							seed: spec.seed,
							style: spec.style,
							engine: "ai",
						});
					}
				}

				// The card needs a URL, not a blob id: resolve the same ref the host would, so
				// what the conversation shows is exactly what the panel stored.
				const ref = await ctx.storage.getBlobRef(image.blobId).catch(() => null);
				if (ref?.url) {
					images.push({
						id: ref.id,
						url: ref.url,
						mimeType: ref.mimeType,
						providerId: image.providerId,
						rootId: reference ?? ref.id,
					});
					designIds.push(designId);
				}
				lastDesignId = designId;
			}

			if (folder && variants.length > 0) {
				// 位图没有 SVG 主图：`primary` 留空，清单只列 PNG。
				await writeManifest(fsApi, folder, {
					brand: spec.brandName,
					slug: folder.split("/").pop() ?? spec.brandName,
					primary: "",
					spec,
					palette: {},
					variants,
				}).catch(() => undefined);
			}

			// The panel comes up on this batch — same path as the vector tool. Reported
			// rather than swallowed: a failure to open is information the user needs.
			// 整批一起交给画布：一次出三张就铺三张，而不是只留最后一张。
			const reveal =
				designIds.length > 0
					? revealInCanvas(ctx, session.cwd, designIds)
					: { opened: false, error: undefined };

			return {
				ok: true,
				engine: "ai",
				images,
				designIds,
				// Cross-turn dedup key = the lineage root, so an edited version replaces the
				// earlier card instead of stacking duplicates in the thread.
				cards:
					images.length > 0
						? [{ type: "logocreator:image", key: images[0].rootId, payload: { images, designIds } }]
						: [],
				failures: generated.failures,
				notes: [
					"Raster output: PNG only, no SVG or brand kit, cannot be enlarged.",
					"Vector designs and raster marks live in the same history; the panel labels them AI or Vector.",
					...(reveal.opened
						? []
						: [
								`The design is stored, but the canvas could not be opened automatically${reveal.error ? `: ${reveal.error}` : "."} The user can open the LogoCreator tab themselves.`,
							]),
				],
			} satisfies ImageToolResult;
		},
	};
}
