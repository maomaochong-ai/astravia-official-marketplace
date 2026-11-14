/**
 * Reading a file out of the sandbox in a form the host can show as an image.
 *
 * Upstream gets `view_image` from the SDK: the sandbox reads the file, returns an image
 * content block, and a vision-capable model can finally *look* at the screenshot it just
 * took. Without it, `agent-browser screenshot` writes a PNG nobody ever sees, and the model
 * is left guessing whether a page rendered.
 *
 * Two shapes are produced because there are two consumers:
 *  - MCP: `{ type: "image", data, mimeType }` — the host model sees the pixels;
 *  - `/api/tool` and the panel: base64 plus a data URI, so the trace can show a thumbnail.
 *
 * The size ceiling is deliberate. A 4 MB screenshot is a quarter of a model's context; past
 * this limit the tool reports the dimensions instead of shipping pixels the model cannot
 * afford to look at.
 */

export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

/** Extension → MIME. Kept small on purpose: these are the formats a browser scan produces. */
const MIME: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".bmp": "image/bmp",
};

export interface ImagePayload {
	ok: true;
	path: string;
	mimeType: string;
	base64: string;
	bytes: number;
	dataUri: string;
}

export interface ImageFailure {
	ok: false;
	path?: string;
	error: string;
}

export function mimeForPath(path: string): string | undefined {
	const lower = path.toLowerCase();
	const dot = lower.lastIndexOf(".");
	if (dot < 0) return undefined;
	return MIME[lower.slice(dot)];
}

/** Sniff the first bytes: a model that saved a JPEG as `.png` should still get an image. */
export function sniffMime(bytes: Uint8Array): string | undefined {
	if (bytes.length < 12) return undefined;
	const [a, b, c, d] = bytes;
	if (a === 0x89 && b === 0x50 && c === 0x4e && d === 0x47) return "image/png";
	if (a === 0xff && b === 0xd8 && c === 0xff) return "image/jpeg";
	if (a === 0x47 && b === 0x49 && c === 0x46) return "image/gif";
	// RIFF....WEBP
	if (a === 0x52 && b === 0x49 && c === 0x46 && d === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) {
		return "image/webp";
	}
	if (a === 0x42 && b === 0x4d) return "image/bmp";
	return undefined;
}

/** Narrow the failure to what the operator must fix: path, format or size. */
export function toImagePayload(path: string, bytes: Uint8Array): ImagePayload | ImageFailure {
	if (bytes.length === 0) return { ok: false, path, error: "file is empty" };
	if (bytes.length > IMAGE_MAX_BYTES) {
		return {
			ok: false,
			path,
			error: `image is ${(bytes.length / 1024 / 1024).toFixed(1)} MB, over the ${Math.round(
				IMAGE_MAX_BYTES / 1024 / 1024,
			)} MB ceiling; crop or downscale it first (e.g. with ffmpeg)`,
		};
	}
	const mime = sniffMime(bytes) ?? mimeForPath(path);
	if (!mime) {
		return {
			ok: false,
			path,
			error: "not a recognised image; supported: png, jpeg, webp, gif, bmp",
		};
	}
	const base64 = Buffer.from(bytes).toString("base64");
	return {
		ok: true,
		path,
		mimeType: mime,
		base64,
		bytes: bytes.length,
		dataUri: `data:${mime};base64,${base64}`,
	};
}
