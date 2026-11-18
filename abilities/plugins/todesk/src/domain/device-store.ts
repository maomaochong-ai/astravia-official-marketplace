/**
 * The user's saved devices, from ToDesk's own local store:
 * `%LOCALAPPDATA%\ToDesk\devlist_<account>.json`.
 *
 * This is what turns "type nine digits and a temporary password" into "connect to the
 * office PC". The client already remembers those devices, their names and their last
 * connect time; the plugin was only reading `-status`, so the agent could not name a
 * single one of them (ADR-0010).
 *
 * Two fields are credentials — `PassEx` (the saved connect credential) and
 * `HostLogonPass` (the far side's login password). They are dropped here: callers only
 * learn *whether* a saved credential exists, never its value, so no secret can reach the
 * transcript, the panel state or the clipboard.
 */

export interface SavedDevice {
	deviceId: string;
	name: string;
	/** Epoch milliseconds of the last connect, as the client stored it. */
	lastConnectedAt: number | null;
	isConnected: boolean;
	/** The client holds a credential for this device, so `-control -id` needs no password. */
	hasSavedCredential: boolean;
	/** A stored login password for the far side's lock screen. */
	hasLoginPassword: boolean;
	/** Pinned in the client's own device list — the user already said "this one matters". */
	isPinned: boolean;
}

interface RawDevice {
	UserId?: unknown;
	UserName?: unknown;
	RecentConnectTime?: unknown;
	IsConnected?: unknown;
	PassEx?: unknown;
	HostLogonPass?: unknown;
	IsPinned?: unknown;
}

const DEVICE_ID = /^\d{5,12}$/;

/** File-name prefix of the saved-device store, one per signed-in account. */
export const DEVICE_LIST_PREFIX = "devlist_";

export function parseDeviceList(text: string): SavedDevice[] {
	let json: unknown;
	try {
		json = JSON.parse(text.replace(/^\uFEFF/, ""));
	} catch {
		return [];
	}

	const candidate = Array.isArray(json) ? json : (json as { DeviceInfo?: unknown } | null)?.DeviceInfo;
	if (!Array.isArray(candidate)) return [];

	const devices: SavedDevice[] = [];
	for (const raw of candidate as RawDevice[]) {
		const deviceId = String(raw?.UserId ?? "").trim();
		if (!DEVICE_ID.test(deviceId)) continue;

		const ms = Number(raw?.RecentConnectTime);
		devices.push({
			deviceId,
			name: String(raw?.UserName ?? "").trim() || deviceId,
			lastConnectedAt: Number.isFinite(ms) && ms > 0 ? ms : null,
			isConnected: String(raw?.IsConnected ?? "0") === "1",
			hasSavedCredential: String(raw?.PassEx ?? "").trim().length > 0,
			hasLoginPassword: String(raw?.HostLogonPass ?? "").trim().length > 0,
			isPinned: String(raw?.IsPinned ?? "0") === "1",
		});
	}
	return devices;
}

/**
 * One machine can be signed into more than one account, and the client writes one store
 * per account. Merge them, keeping the newest connect time for a device id seen twice.
 */
export function mergeDeviceLists(lists: SavedDevice[][]): SavedDevice[] {
	const byId = new Map<string, SavedDevice>();
	for (const list of lists) {
		for (const device of list) {
			const seen = byId.get(device.deviceId);
			if (!seen) {
				byId.set(device.deviceId, device);
				continue;
			}
			const newer = (device.lastConnectedAt ?? 0) > (seen.lastConnectedAt ?? 0) ? device : seen;
			byId.set(device.deviceId, {
				...newer,
				isConnected: seen.isConnected || device.isConnected,
				hasSavedCredential: seen.hasSavedCredential || device.hasSavedCredential,
				hasLoginPassword: seen.hasLoginPassword || device.hasLoginPassword,
				isPinned: seen.isPinned || device.isPinned,
			});
		}
	}
	// Pinned first, then most recently used: the user's own ordering, then ours.
	return [...byId.values()].sort(
		(a, b) => Number(b.isPinned) - Number(a.isPinned) || (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0),
	);
}

export type DeviceMatch =
	| { kind: "one"; device: SavedDevice }
	| { kind: "none" }
	| { kind: "many"; devices: SavedDevice[] };

/**
 * Resolve what the user said into one device. Exact code first, then exact name, then a
 * unique prefix — an ambiguous prefix returns every candidate so the tool can list them
 * instead of picking one and connecting to the wrong machine.
 */
export function matchDevice(devices: SavedDevice[], query: string): DeviceMatch {
	const q = query.trim();
	if (!q) return { kind: "none" };

	const digits = q.replace(/\s+/g, "");
	const byId = devices.find((d) => d.deviceId === digits);
	if (byId) return { kind: "one", device: byId };

	const lower = q.toLowerCase();
	const byName = devices.filter((d) => d.name.toLowerCase() === lower);
	if (byName.length === 1) return { kind: "one", device: byName[0] };
	if (byName.length > 1) return { kind: "many", devices: byName };

	const partial = devices.filter((d) => d.name.toLowerCase().includes(lower) || d.deviceId.includes(digits));
	if (partial.length === 1) return { kind: "one", device: partial[0] };
	if (partial.length > 1) return { kind: "many", devices: partial };
	return { kind: "none" };
}

/** What the agent sees: no credential values, timestamps as ISO for readability. */
export function describeDevice(device: SavedDevice): Record<string, unknown> {
	return {
		device_id: device.deviceId,
		name: device.name,
		last_connected_at: device.lastConnectedAt ? new Date(device.lastConnectedAt).toISOString() : null,
		connected: device.isConnected,
		saved_credential: device.hasSavedCredential,
		login_password_saved: device.hasLoginPassword,
		pinned: device.isPinned,
	};
}
