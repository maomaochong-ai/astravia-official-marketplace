/**
 * Merge-safe persistence for the two plugin collections.
 *
 * Both stores hold a whole list in one JSON file. Writing "the list I have in
 * memory" is only correct while exactly one instance exists and nothing else ever
 * wrote. Neither holds: the panel, a remount, and the agent tools can each hold a
 * store, and the last writer wins — which is how a deleted design comes back after
 * reopening the panel.
 *
 * So a delete is recorded as a **tombstone inside the file**, and every write
 * re-reads the file, unions the live records, and filters the tombstoned ids. A
 * stale writer can then only ever re-add records nobody deleted.
 */

export interface PersistedList<T> {
	schemaVersion: number;
	items: T[];
	/** Ids that were deleted, newest last. Capped by the caller. */
	deleted?: string[];
}

const TOMBSTONE_LIMIT = 800;

export interface MergeInput<T> {
	file: PersistedList<T>;
	mine: T[];
	myTombstones: readonly string[];
	idOf: (item: T) => string;
	/** Tie-break for the same id; keep the larger. */
	rankOf?: (item: T) => number;
}

export interface MergeResult<T> {
	items: T[];
	tombstones: string[];
}

export function mergeLists<T>({ file, mine, myTombstones, idOf, rankOf }: MergeInput<T>): MergeResult<T> {
	const tombstones = [...new Set([...(file.deleted ?? []), ...myTombstones])];
	const byId = new Map<string, T>();
	const rank = rankOf ?? (() => 0);

	for (const item of [...file.items, ...mine]) {
		const id = idOf(item);
		const existing = byId.get(id);
		if (!existing || rank(item) >= rank(existing)) byId.set(id, item);
	}

	const items = [...byId.values()]
		.filter((item) => !tombstones.includes(idOf(item)))
		.sort((a, b) => rank(b) - rank(a));

	return {
		items,
		tombstones: tombstones.slice(-TOMBSTONE_LIMIT),
	};
}

/** The file a store writes back. Always schema 2: tombstones are part of the contract now. */
export function toPersistedList<T>(merged: MergeResult<T>): PersistedList<T> {
	return { schemaVersion: 2, items: merged.items, deleted: merged.tombstones };
}
