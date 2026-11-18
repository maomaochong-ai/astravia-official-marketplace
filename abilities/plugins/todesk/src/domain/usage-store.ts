/**
 * How often this machine connected out, from `%LOCALAPPDATA%\ToDesk\recentusage_<id>.json`.
 *
 * The file is a rolling list of days, each with a count per device id:
 *
 *   [{ "date": "20261118", "usageinfo": [{ "count": 3, "deviceid": "855735375" }] }]
 *
 * It answers questions the client's own UI makes you click through ("哪台最近用得最多"),
 * and it gives the agent a cheap way to notice it is connecting to the same machine for
 * the third time today. Counts only — the store holds no credential.
 */

export interface UsageEntry {
	deviceId: string;
	count: number;
}

export interface UsageDay {
	/** `YYYYMMDD`, as stored. */
	date: string;
	entries: UsageEntry[];
}

interface RawDay {
	date?: unknown;
	usageinfo?: unknown;
}

interface RawEntry {
	deviceid?: unknown;
	count?: unknown;
}

const DAY = /^\d{8}$/;
const DEVICE_ID = /^\d{5,12}$/;

export function parseUsage(text: string): UsageDay[] {
	let json: unknown;
	try {
		json = JSON.parse(text.replace(/^\uFEFF/, ""));
	} catch {
		return [];
	}
	if (!Array.isArray(json)) return [];

	const days: UsageDay[] = [];
	for (const raw of json as RawDay[]) {
		const date = String(raw?.date ?? "").trim();
		if (!DAY.test(date)) continue;

		const entries: UsageEntry[] = [];
		for (const rawEntry of Array.isArray(raw?.usageinfo) ? (raw.usageinfo as RawEntry[]) : []) {
			const deviceId = String(rawEntry?.deviceid ?? "").trim();
			const count = Number(rawEntry?.count);
			if (!DEVICE_ID.test(deviceId) || !Number.isFinite(count) || count <= 0) continue;
			entries.push({ deviceId, count: Math.trunc(count) });
		}
		days.push({ date, entries });
	}
	return days.sort((a, b) => b.date.localeCompare(a.date));
}

export interface UsageSummary {
	total: number;
	byDevice: { deviceId: string; count: number }[];
	from: string | null;
	to: string | null;
}

/** Fold the day buckets into one total, optionally limited to the last `days` days. */
export function summarizeUsage(days: UsageDay[], limitDays?: number, today?: Date): UsageSummary {
	const cutoff = limitDays && today ? dayKey(new Date(today.getTime() - (limitDays - 1) * 86_400_000)) : null;
	const kept = cutoff ? days.filter((day) => day.date >= cutoff) : days;

	const counts = new Map<string, number>();
	for (const day of kept) {
		for (const entry of day.entries) counts.set(entry.deviceId, (counts.get(entry.deviceId) ?? 0) + entry.count);
	}

	const byDevice = [...counts.entries()]
		.map(([deviceId, count]) => ({ deviceId, count }))
		.sort((a, b) => b.count - a.count);

	return {
		total: byDevice.reduce((sum, entry) => sum + entry.count, 0),
		byDevice,
		from: kept.length > 0 ? kept[kept.length - 1].date : null,
		to: kept.length > 0 ? kept[0].date : null,
	};
}

/** Local `YYYYMMDD`, because the store is written in local time. */
export function dayKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}${month}${day}`;
}
