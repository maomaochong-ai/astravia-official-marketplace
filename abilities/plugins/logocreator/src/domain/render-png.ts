/**
 * SVG → raster, in the renderer.
 *
 * The engine only ever produces SVG strings, so every PNG in this plugin comes
 * from the same bytes the user exports. That is deliberate: a preview rasterised
 * by one path and an export rasterised by another is how logos end up looking
 * different from what was approved.
 */

export interface LoadedImage {
	width: number;
	height: number;
	element: HTMLImageElement;
}

export function svgToDataUrl(svg: string): string {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Inline `data:` URL for an `<img src>` preview; keeps the SVG in one place. */
export function previewUrl(svg: string): string {
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function loadImage(src: string): Promise<LoadedImage> {
	return new Promise((resolve, reject) => {
		const element = new Image();
		element.decoding = "async";
		element.onload = () =>
			resolve({
				element,
				width: element.naturalWidth || element.width,
				height: element.naturalHeight || element.height,
			});
		element.onerror = () => reject(new Error("The image could not be decoded"));
		element.src = src;
	});
}

function withSize(svg: string, size: number): string {
	return svg
		.replace(/\swidth="[^"]*"/, "")
		.replace(/\sheight="[^"]*"/, "")
		.replace(/<svg/, `<svg width="${size}" height="${size}"`);
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("The browser could not encode a PNG from this canvas"));
		}, "image/png");
	});
}

/** Rasterise any SVG at arbitrary pixel dimensions. */
export async function rasterizeSvg(svg: string, width: number, height: number): Promise<Blob> {
	const sized = svg
		.replace(/\swidth="[^"]*"/, "")
		.replace(/\sheight="[^"]*"/, "")
		.replace(/<svg/, `<svg width="${width}" height="${height}"`);
	const image = await loadImage(svgToDataUrl(sized));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is unavailable in this window");
	context.clearRect(0, 0, width, height);
	context.drawImage(image.element, 0, 0, width, height);
	return canvasToPngBlob(canvas);
}
/** Rasterise an SVG at an exact square size. Transparent where the SVG is. */
export async function svgToPngBlob(svg: string, size: number): Promise<Blob> {
	const image = await loadImage(svgToDataUrl(withSize(svg, size)));
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is unavailable in this window");
	context.clearRect(0, 0, size, size);
	context.drawImage(image.element, 0, 0, size, size);
	return canvasToPngBlob(canvas);
}

export async function svgToPngBytes(svg: string, size: number): Promise<Uint8Array> {
	const blob = await svgToPngBlob(svg, size);
	return new Uint8Array(await blob.arrayBuffer());
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	// Give the browser a tick to start the download before the URL is revoked.
	setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Sample the dominant colours of a user-supplied image, for brand import. */
export async function readImagePixels(file: File | Blob, maxEdge = 256): Promise<Uint8ClampedArray> {
	const url = URL.createObjectURL(file);
	try {
		const image = await loadImage(url);
		const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
		const width = Math.max(1, Math.round(image.width * scale));
		const height = Math.max(1, Math.round(image.height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) throw new Error("Canvas 2D is unavailable in this window");
		context.clearRect(0, 0, width, height);
		context.drawImage(image.element, 0, 0, width, height);
		return context.getImageData(0, 0, width, height).data;
	} finally {
		URL.revokeObjectURL(url);
	}
}
