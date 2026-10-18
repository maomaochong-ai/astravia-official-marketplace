/**
 * Moving captured text out of the panel without asking the host for anything.
 *
 * The clipboard API and a Blob URL are both available in the panel renderer, so
 * "copy" and "download" need no `fs.write` round-trip and no new permission.
 */

export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export function saveText(filename: string, text: string): boolean {
	try {
		const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		anchor.rel = "noopener";
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		// Give the download a tick to start before the blob is revoked.
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
		return true;
	} catch {
		return false;
	}
}

/** Filesystem-safe stem derived from a page URL. */
export function filenameFor(url: string, extension = "md"): string {
	let stem = "page";
	try {
		const parsed = new URL(url);
		stem = `${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, "");
	} catch {
		stem = url;
	}
	const safe = stem.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
	return `${safe || "page"}.${extension}`;
}
