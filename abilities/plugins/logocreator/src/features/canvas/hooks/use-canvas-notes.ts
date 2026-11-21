import { useCallback, useEffect, useState } from "react";
import { type CanvasNote, notesPrompt } from "../../../domain/notes";
import { getNoteStore, getPluginContext, reportError } from "../../../plugin-context";

export interface CanvasNotesApi {
	notes: CanvasNote[];
	ready: boolean;
	add: (draft: { designId: string | null; text: string; x: number; y: number }) => Promise<boolean>;
	remove: (id: string) => Promise<void>;
	/** Send the pending notes of one design to the active conversation. */
	handToAgent: (designId: string | null, brandName: string) => Promise<boolean>;
	resolveMany: (ids: readonly string[]) => Promise<void>;
}

/**
 * Canvas notes, bound to React.
 *
 * `handToAgent` writes into the conversation as a user turn rather than calling a
 * tool directly: the user sees exactly what was asked, and the agent's reply (and
 * the re-rendered design) arrives in the thread they are already reading. Notes are
 * marked resolved only after the send succeeds, so a failed send leaves them
 * pending and re-sendable.
 */
export function useCanvasNotes(messages: {
	sendFailed: string;
	addFailed: string;
	removeFailed: string;
}): CanvasNotesApi {
	const [notes, setNotes] = useState<CanvasNote[]>([]);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const store = getNoteStore();
		const sync = () => setNotes([...store.list()]);
		const unsubscribe = store.subscribe(sync);
		store
			.hydrate()
			.then(() => {
				sync();
				setReady(true);
			})
			.catch((cause) => {
				setReady(true);
				reportError(messages.addFailed, cause);
			});
		return unsubscribe;
		// `messages` is a literal per render; this must run once per mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const add = useCallback(
		async (draft: { designId: string | null; text: string; x: number; y: number }) => {
			try {
				await getNoteStore().add(draft);
				return true;
			} catch (cause) {
				reportError(messages.addFailed, cause);
				return false;
			}
		},
		[messages.addFailed],
	);

	const remove = useCallback(
		async (id: string) => {
			try {
				await getNoteStore().remove(id);
			} catch (cause) {
				reportError(messages.removeFailed, cause);
			}
		},
		[messages.removeFailed],
	);

	const resolveMany = useCallback(async (ids: readonly string[]) => {
		if (ids.length === 0) return;
		await getNoteStore().resolve(ids);
	}, []);

	const handToAgent = useCallback(
		async (designId: string | null, brandName: string) => {
			const pending = getNoteStore().pending(designId);
			if (pending.length === 0) return false;
			try {
				await getPluginContext().conversation.sendPrompt(notesPrompt(pending, brandName));
				await getNoteStore().resolve(pending.map((note) => note.id));
				return true;
			} catch (cause) {
				reportError(messages.sendFailed, cause);
				return false;
			}
		},
		[messages.sendFailed],
	);

	return { notes, ready, add, remove, handToAgent, resolveMany };
}
