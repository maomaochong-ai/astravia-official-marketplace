import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import type { BrandKit } from "../../../domain/brand-kit";
import { kitSlug } from "../../../domain/brand-kit";
import { svgToPngBytes } from "../../../domain/render-png";
import type { LogoSpec } from "../../../domain/spec";
import { bytesToBase64 } from "../../../shared/formatters/bytes";
import { reportError } from "../../../plugin-context";

/**
 * Export targets.
 *
 * Everything goes through `fs.saveAs`, which opens the host's native save dialog.
 * That is the honest boundary: the plugin writes a file only where the user says,
 * and the returned path is what the panel reports back. Returning `null` means the
 * user cancelled — not an error, and never worth a toast.
 */

export async function saveSvgFile(fs: PluginFsApi, spec: LogoSpec, svg: string, suffix = ""): Promise<string | null> {
	const name = `${kitSlug(spec)}${suffix}.svg`;
	try {
		return await fs.saveAs(name, svg, "utf8", {
			title: "Save logo as SVG",
			filters: [{ name: "SVG", extensions: ["svg"] }],
		});
	} catch (cause) {
		reportError("Could not save the SVG", cause);
		return null;
	}
}

export async function savePngFile(fs: PluginFsApi, spec: LogoSpec, svg: string, size: number): Promise<string | null> {
	try {
		const bytes = await svgToPngBytes(svg, size);
		return await fs.saveAs(`${kitSlug(spec)}-${size}.png`, bytesToBase64(bytes), "base64", {
			title: `Save ${size} px PNG`,
			filters: [{ name: "PNG", extensions: ["png"] }],
		});
	} catch (cause) {
		reportError("Could not save the PNG", cause);
		return null;
	}
}

export async function saveKitFile(fs: PluginFsApi, kit: BrandKit): Promise<string | null> {
	try {
		const bytes = new Uint8Array(await kit.zip.arrayBuffer());
		return await fs.saveAs(`${kit.folder}.zip`, bytesToBase64(bytes), "base64", {
			title: "Save brand kit",
			filters: [{ name: "ZIP", extensions: ["zip"] }],
		});
	} catch (cause) {
		reportError("Could not save the brand kit", cause);
		return null;
	}
}
