/**
 * The parts of ToDesk's local state that the agent needs and the command line never says:
 * the saved device list, the per-day use counts, and this machine's access posture.
 *
 * Why a directory has to be discovered first: the store lives under
 * `%LOCALAPPDATA%\ToDesk`, and the plugin API hands out no home/env lookup (only
 * `fs.readFile`/`readDir` on absolute paths). So the profile is found by listing
 * `C:\Users` and taking the first one whose `AppData\Local\ToDesk` answers. That also
 * fixes the case the earlier build could not handle: a machine with several accounts.
 *
 * Failures are returned, not thrown: a missing store means "the client never connected to
 * anything", which is a useful answer, not an error page.
 */

import { parsePosture, type ClientPosture } from "../../../domain/client-posture";
import { DEVICE_LIST_PREFIX, mergeDeviceLists, parseDeviceList, type SavedDevice } from "../../../domain/device-store";
import { parseUsage, type UsageDay } from "../../../domain/usage-store";
/** The two host readers this module needs; the rest of ConsoleDeps is irrelevant here. */
export interface StoreReader {
	readTextFile(path: string): Promise<string>;
	listDirectory(path: string): Promise<{ name: string; path: string; isDirectory?: boolean }[]>;
}

const USAGE_PREFIX = "recentusage_";
const USERS_ROOT = "C:\\Users";
const CONFIG_PATHS = ["C:\\Program Files\\ToDesk\\config.ini", "C:\\Program Files (x86)\\ToDesk\\config.ini"];

export interface LocalStore {
	/** Where the store was found, or null when no profile had one. */
	directory: string | null;
	devices: SavedDevice[];
	usage: UsageDay[];
	posture: ClientPosture | null;
	/** Why the store could not be read, if it could not. */
	error: string | null;
}

const EMPTY: LocalStore = { directory: null, devices: [], usage: [], posture: null, error: null };

async function findDataDirectory(deps: StoreReader): Promise<string | null> {
	let users: { name: string; path: string; isDirectory?: boolean }[];
	try {
		users = await deps.listDirectory(USERS_ROOT);
	} catch {
		return null;
	}

	// A profile that actually holds a store wins over one that merely exists.
	let fallback: string | null = null;
	for (const user of users) {
		if (user.isDirectory === false) continue;
		const candidate = `${user.path}\\AppData\\Local\\ToDesk`;
		let entries: { name: string; path: string }[];
		try {
			entries = await deps.listDirectory(candidate);
		} catch {
			continue;
		}
		if (entries.some((entry) => entry.name.startsWith(DEVICE_LIST_PREFIX))) return candidate;
		fallback ??= candidate;
	}
	return fallback;
}

async function readNearby(deps: StoreReader, directory: string, prefix: string, limit: number): Promise<string[]> {
	const entries = await deps.listDirectory(directory);
	const named = entries
		.filter((entry) => entry.name.startsWith(prefix) && entry.name.toLowerCase().endsWith(".json"))
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, limit);

	const contents: string[] = [];
	for (const entry of named) {
		try {
			contents.push(await deps.readTextFile(entry.path));
		} catch {
			// One unreadable store must not hide the others.
		}
	}
	return contents;
}

export async function readLocalStore(deps: StoreReader): Promise<LocalStore> {
	const directory = await findDataDirectory(deps);
	if (!directory) {
		return { ...EMPTY, error: `no ToDesk data directory under ${USERS_ROOT}` };
	}

	let devices: SavedDevice[] = [];
	let usage: UsageDay[] = [];
	try {
		const lists = await readNearby(deps, directory, DEVICE_LIST_PREFIX, 4);
		devices = mergeDeviceLists(lists.map(parseDeviceList));

		const usageFiles = await readNearby(deps, directory, USAGE_PREFIX, 4);
		usage = usageFiles
			.flatMap(parseUsage)
			// The client rewrites the same day per account; keep the larger count.
			.reduce<UsageDay[]>((kept, day) => {
				const index = kept.findIndex((existing) => existing.date === day.date);
				if (index < 0) return [...kept, day];
				const merged = new Map<string, number>();
				for (const entry of [...kept[index].entries, ...day.entries]) {
					merged.set(entry.deviceId, Math.max(merged.get(entry.deviceId) ?? 0, entry.count));
				}
				kept[index] = { date: day.date, entries: [...merged.entries()].map(([deviceId, count]) => ({ deviceId, count })) };
				return kept;
			}, [])
			.sort((a, b) => b.date.localeCompare(a.date));
	} catch (error) {
		return { ...EMPTY, directory, error: error instanceof Error ? error.message : String(error) };
	}

	let posture: ClientPosture | null = null;
	for (const path of CONFIG_PATHS) {
		try {
			posture = parsePosture(await deps.readTextFile(path));
			if (posture) break;
		} catch {
			// Try the next install location.
		}
	}

	return { directory, devices, usage, posture, error: null };
}
