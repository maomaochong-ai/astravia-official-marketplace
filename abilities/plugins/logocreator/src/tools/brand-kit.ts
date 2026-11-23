import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { buildBrandKit, kitSlug, paletteJson } from "../domain/brand-kit";
import { buildBrandGuide } from "../domain/brand-guide";
import { renderLogo } from "../domain/engine/compose";
import { getPluginContext } from "../plugin-context";
import { TOOL_BRAND_KIT } from "../tab-ids";
import { TOOL_LABELS } from "../contributions";
import { designFolder, writeManifest } from "../domain/design-folder";
import { DESIGN_PROPERTIES, specFromInput, type DesignToolPayload } from "./spec-from-input";

interface KitToolResult {
	ok: boolean;
	brand: string;
	folder: string;
	files: string[];
	palette: Record<string, string>;
	pngSkipped: boolean;
	notes: string[];
}

/**
 * `logocreator_brand_kit` — the whole kit as files in the workspace.
 *
 * The PNG half of the kit needs a canvas, which the tool handler may not have in
 * every host build. Rather than fail the whole call, the vector and text half is
 * always written and `pngSkipped` says so — a kit without rasters is still usable,
 * a tool that reports success while writing nothing is not.
 */
export function createBrandKitTool(): PluginAgentToolRegistration<DesignToolPayload> {
	return {
		id: TOOL_BRAND_KIT,
		name: TOOL_BRAND_KIT,
		label: TOOL_LABELS.kit,
		description: [
			"Build a complete brand kit for one logo and write it into the workspace.",
			"Writes the lockup and mark as SVG, on-light / on-dark / transparent / mono variants, PNG sizes (512, 1024, 2048, favicons, apple-touch), brand-colors.css and .json, a printable brand-guide.html, a brand-board.png, and a README.",
			"Everything goes into `<slug>.logocreator-design/kit/` — the same design folder the profile itself lives in — and `design.json` records which files the kit produced.",
			"Call logocreator_design first if the user has not settled on a style yet: this tool takes the same fields and re-renders from the spec, so the kit always matches the chosen design.",
			"Do NOT use it to export a single icon — ask for the design and save the one SVG the user needs instead.",
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
			const notes: string[] = [];
			const fs = getPluginContext().fs;
			const base = designFolder(session.cwd, input.directory, spec.brandName);
			const kitFolder = `${base}/kit`;
			const rendered = renderLogo(spec);

			const written: string[] = [];
			let pngSkipped = false;

			await fs.createDirectory(kitFolder).catch(() => undefined);

			let palette: Record<string, string> = rendered.palette as unknown as Record<string, string>;
			try {
				const kit = await buildBrandKit(spec);
				for (const file of kit.files) {
					await fs.writeFile(`${kitFolder}/${file.path}`, toBase64(file.bytes), "base64");
					written.push(`${kitFolder}/${file.path}`);
				}
				palette = kit.palette as unknown as Record<string, string>;
			} catch (cause) {
				pngSkipped = true;
				notes.push(`Rasterising the PNGs failed (${describe(cause)}); the vector and text files are still written.`);
			}

			// 只补没写到的那部分：PNG 已经写成功的套件不再重复写一遍字符串文件。
			if (pngSkipped) {
				const textFiles: { path: string; body: string }[] = [
				{ path: "logo.svg", body: renderLogo({ ...spec, surface: "transparent" }).svg },
				{ path: "logo-mark.svg", body: renderLogo({ ...spec, surface: "transparent" }, { markOnly: true }).svg },
				{ path: "logo-on-light.svg", body: renderLogo({ ...spec, surface: "light" }).svg },
				{ path: "logo-on-dark.svg", body: renderLogo({ ...spec, surface: "dark" }).svg },
				{ path: "logo-transparent.svg", body: renderLogo({ ...spec, surface: "transparent" }).svg },
				{
					path: "logo-mono.svg",
					body: renderLogo({ ...spec, surface: "light", monochrome: true }, { monoInk: rendered.palette.ink }).svg,
				},
				{ path: "brand-colors.json", body: paletteJson(rendered.palette, spec.brandName) },
				{
					path: "brand-guide.html",
					body: buildBrandGuide({
						spec,
						palette: rendered.palette,
						subject: rendered.subject,
						logo: renderLogo({ ...spec, surface: "light" }).svg,
						markSvg: renderLogo({ ...spec, surface: "transparent" }, { markOnly: true }).svg,
						onLight: renderLogo({ ...spec, surface: "light" }).svg,
						onDark: renderLogo({ ...spec, surface: "dark" }).svg,
						onTransparent: renderLogo({ ...spec, surface: "transparent" }).svg,
						mono: renderLogo({ ...spec, surface: "light", monochrome: true }, { monoInk: rendered.palette.ink }).svg,
					}),
				},
			];
			for (const file of textFiles) {
				const target = `${kitFolder}/${file.path}`;
				await fs.writeFile(target, file.body, "utf8");
				written.push(target);
				}
			}

			// 清单与套件同步：面板与后续工具只读一份 design.json，不再复猜目录里有什么。
			await writeManifest(fs, base, {
				brand: spec.brandName,
				slug: base.split("/").pop() ?? kitSlug(spec),
				spec,
				palette,
				kit: { folder: "kit", files: written.map(path => path.slice(base.length + 1)), palette, engine: "local" },
			}).catch((cause) => {
				notes.push(`The manifest could not be updated (${describe(cause)}); the kit files are still there.`);
			});

			return {
				ok: true,
				brand: spec.brandName,
				folder: base,
				files: written,
				palette,
				pngSkipped,
				notes,
			} satisfies KitToolResult;
		},
	};
}


function toBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

function describe(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
