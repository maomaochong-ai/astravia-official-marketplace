/**
 * `rawBase64` support.
 *
 * The host transport returns text, so the "raw bytes" of a page are its bytes as
 * UTF-8 — re-encoded here rather than fetched twice. `btoa` only accepts Latin-1,
 * hence the two-step encode.
 */

export function toBase64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	const chunk = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunk) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
	}
	return btoa(binary);
}
