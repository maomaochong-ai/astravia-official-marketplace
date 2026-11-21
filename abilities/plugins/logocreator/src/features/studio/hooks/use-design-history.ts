import { useCallback, useEffect, useState } from "react";
import type { DesignRecord } from "../../../domain/history-store";
import { displayLabel } from "../../../domain/history-store";
import { getHistoryStore, reportError } from "../../../plugin-context";

export interface DesignHistoryApi {
	items: DesignRecord[];
	ready: boolean;
	error: string | null;
	setFavorite: (id: string, favorite: boolean) => Promise<void>;
	rename: (id: string, name: string) => Promise<void>;
	remove: (id: string) => Promise<void>;
	clear: () => Promise<void>;
	label: (record: DesignRecord) => string;
}

/**
 * Binds the history store to React.
 *
 * The store owns the list and persistence; this hook only mirrors it. That split
 * keeps "add → reload → still there" testable without a DOM, and means two views
 * (gallery and history sheet) can never disagree.
 */
export function useDesignHistory(messages: { saveFailed: string; updateFailed: string; removeFailed: string; clearFailed: string }): DesignHistoryApi {
	const [items, setItems] = useState<DesignRecord[]>([]);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const store = getHistoryStore();
		const sync = () => setItems([...store.list()]);
		const unsubscribe = store.subscribe(sync);
		store
			.hydrate()
			.then(() => {
				sync();
				setReady(true);
			})
			.catch((cause) => {
				setReady(true);
				setError(messages.saveFailed);
				reportError(messages.saveFailed, cause);
			});
		return unsubscribe;
		// `messages` is a literal per render; the effect must run once per mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const setFavorite = useCallback(
		async (id: string, favorite: boolean) => {
			try {
				await getHistoryStore().update(id, { favorite });
			} catch (cause) {
				reportError(messages.updateFailed, cause);
			}
		},
		[messages.updateFailed],
	);

	const rename = useCallback(
		async (id: string, name: string) => {
			try {
				await getHistoryStore().update(id, { name });
			} catch (cause) {
				reportError(messages.updateFailed, cause);
			}
		},
		[messages.updateFailed],
	);

	const remove = useCallback(
		async (id: string) => {
			try {
				await getHistoryStore().remove(id);
			} catch (cause) {
				reportError(messages.removeFailed, cause);
			}
		},
		[messages.removeFailed],
	);

	const clear = useCallback(async () => {
		try {
			await getHistoryStore().clear();
		} catch (cause) {
			reportError(messages.clearFailed, cause);
		}
	}, [messages.clearFailed]);

	return {
		items,
		ready,
		error,
		setFavorite,
		rename,
		remove,
		clear,
		label: displayLabel,
	};
}
