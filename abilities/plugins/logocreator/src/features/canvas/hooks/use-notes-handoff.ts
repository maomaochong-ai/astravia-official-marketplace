import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { getNoteStore, getPluginContext } from "../../../plugin-context";

/**
 * Handing notes to the conversation — modelled on the reference design plugin's
 * `useNotesHandoff`, because the naive version has three failures it already solved:
 *
 * 1. **"no session yet" is not a blocker.** After the user starts a new conversation
 *    the host has no active session, so `conversation.sendPrompt` throws. The panel
 *    knows its cwd, so it creates the session first and then speaks
 *    (`sendNeedsSession`). This is the reported "新建会话后备注交不出去".
 * 2. **A port of the *note text* is the wrong payload.** Pasting today's notes freezes
 *    the agent on that snapshot; anything pinned while it works is invisible. The
 *    prompt points at `logocreator_notes` instead, and the agent lists the live set.
 * 3. **Streaming is not a blocker either** — the running turn will read the ledger
 *    when it checks its work. Marking those notes dispatched is what stops the panel
 *    from nagging with a second prompt.
 */

export type HandoffBlock = "no-workspace" | "other-workspace" | "streaming" | "no-notes";

export interface NotesHandoff {
	blocked: HandoffBlock | null;
	blockedReason: string | null;
	isStreaming: boolean;
	/** A session will be created on send — the panel says so before the click. */
	needsSession: boolean;
	sendAll: () => Promise<boolean>;
}

const AUTO_DISPATCH_MS = 1_200;

function dispatchPrompt(): string {
	return [
		"The user has pinned notes on the LogoCreator canvas.",
		"Call logocreator_notes with no arguments to list every pending note — each one names the part of the mark it is about (the mark, the wordmark, the tagline, the background) or is marked as a whole-brand rule.",
		"Work through them one at a time: change the fields a note names and re-render with logocreator_design, keeping the seed unless the note is about the mark's shape.",
		"Then call logocreator_notes with action \"resolve\" and the id you actually addressed. Repeat until it reports nothing pending — including notes the user adds while you work.",
		"Write each reply in the language the user wrote that note in.",
	].join(" ");
}

export function useNotesHandoff(cwd: string | null): NotesHandoff {
	const { t } = useTranslation();
	const [conversation, setConversation] = useState<{ id: string | null; cwd: string | null; isStreaming: boolean } | null>(
		null,
	);
	const [version, setVersion] = useState(0);

	useEffect(() => {
		const handle = getPluginContext().conversation.on((event) => {
			if (event.type === "conversation-changed") {
				setConversation({
					id: event.conversation.id,
					cwd: event.conversation.cwd,
					isStreaming: event.conversation.isStreaming,
				});
			} else if (event.type === "turn-start") {
				setConversation((current) => (current ? { ...current, isStreaming: true } : current));
			} else if (event.type === "turn-end") {
				setConversation((current) => (current ? { ...current, isStreaming: false } : current));
			}
		});
		return () => handle.dispose();
	}, []);

	useEffect(() => {
		const store = getNoteStore();
		return store.subscribe(() => setVersion((value) => value + 1));
	}, []);

	const pending = getNoteStore().pending();
	const needsSession = !conversation?.cwd && cwd !== null;

	const blocked: HandoffBlock | null =
		pending.length === 0
			? "no-notes"
			: needsSession
				? null
				: !conversation?.cwd
					? "no-workspace"
					: cwd !== null && conversation.cwd !== cwd
						? "other-workspace"
						: conversation.isStreaming
							? "streaming"
							: null;

	const messages: Record<HandoffBlock, string> = {
		"no-notes": t("notes.handoff.noNotes"),
		"no-workspace": t("notes.handoff.noWorkspace"),
		"other-workspace": t("notes.handoff.otherWorkspace"),
		streaming: t("notes.handoff.streaming"),
	};

	const send = useCallback(
		async (): Promise<boolean> => {
			const conversationApi = getPluginContext().conversation;
			const notes = getNoteStore().pending();
			if (notes.length === 0) return false;
			// Mark first: a send that never lands must not look un-sent, and a note the
			// agent already has must not be re-sent by the debounce.
			await getNoteStore().markDispatched(notes.map((note) => note.id));
			try {
				if (needsSession && cwd !== null) {
					await conversationApi.createSession(cwd);
				}
				await conversationApi.sendPrompt(dispatchPrompt());
				return true;
			} catch (error) {
				getPluginContext().ui.notify({ message: t("notes.handoff.failed"), error });
				return false;
			}
		},
		[cwd, needsSession, t],
	);

	/**
	 * Auto-dispatch, debounced: users pin several notes in a row, and sending on the
	 * first one would occupy the session before the rest exist. Any change restarts the
	 * timer, so a burst collapses into one hand-off.
	 */
	const sendRef = useRef(send);
	sendRef.current = send;
	useEffect(() => {
		const fresh = getNoteStore().undispatched();
		if (fresh.length === 0) return;
		// A running turn will read the ledger itself; marking them stops the nagging.
		if (blocked === "streaming") {
			void getNoteStore().markDispatched(fresh.map((note) => note.id));
			return;
		}
		if (blocked !== null) return;
		const timer = window.setTimeout(() => {
			void sendRef.current();
		}, AUTO_DISPATCH_MS);
		return () => window.clearTimeout(timer);
	}, [blocked, version]);

	return {
		blocked,
		blockedReason: blocked === null ? null : messages[blocked],
		isStreaming: conversation?.isStreaming ?? false,
		needsSession,
		sendAll: send,
	};
}

