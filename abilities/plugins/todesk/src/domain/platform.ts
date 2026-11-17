export function isWindows(userAgent: string): boolean {
	return /Windows/i.test(userAgent);
}
