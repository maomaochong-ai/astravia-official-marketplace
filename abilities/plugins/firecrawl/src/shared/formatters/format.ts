export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "kB", "MB", "GB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1000 && unit < units.length - 1) {
		value /= 1000;
		unit += 1;
	}
	return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatCount(value: number): string {
	return value >= 10_000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
}

export function formatDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) return "0 ms";
	if (ms < 1000) return `${Math.round(ms)} ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
	return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function formatClock(at: number): string {
	const date = new Date(at);
	const pad = (value: number, size = 2): string => `${value}`.padStart(size, "0");
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function truncate(value: string, max: number): string {
	const text = value.trim();
	return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}
