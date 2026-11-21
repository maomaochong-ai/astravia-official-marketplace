/**
 * Base64 without blowing the call stack.
 *
 * `String.fromCharCode(...bytes)` on a multi-megabyte PNG throws
 * "too many arguments"; the chunked form is what every large-binary bridge does.
 */
export function bytesToBase64(bytes: Uint8Array, chunkSize = 0x8000): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

export function formatRelativeTime(timestamp: number, locale: string): string {
	const delta = Date.now() - timestamp;
	const minutes = Math.round(delta / 60_000);
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	if (Math.abs(minutes) < 60) return formatter.format(-minutes, "minute");
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 24) return formatter.format(-hours, "hour");
	const days = Math.round(hours / 24);
	if (Math.abs(days) < 30) return formatter.format(-days, "day");
	return new Date(timestamp).toLocaleDateString(locale);
}
