import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveConversation, useTranslation } from "@astravia-org/plugin-sdk";
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

/**
 * 两个工作区是否同一个。
 *
 * Windows 上同一个目录可能写成 `D:\\proj` / `D:/proj` / 末尾多一个分隔符，大小写也不固定；
 * 直接用 !== 比会把「当前会话」误判成「另一个项目」，点按钮就静默不发了。
 */
function sameWorkspace(a: string | null, b: string | null): boolean {
	if (!a || !b) return false;
	const normalise = (value: string) =>
		value.replace(/\\/gu, "/").replace(/\/+$/u, "").toLowerCase();
	return normalise(a) === normalise(b);
}

export interface NotesHandoff {
	blocked: HandoffBlock | null;
	blockedReason: string | null;
	isStreaming: boolean;
	/** A session will be created on send — the panel says so before the click. */
	needsSession: boolean;
	sendAll: () => Promise<boolean>;
}

const AUTO_DISPATCH_MS = 1_200;

/**
 * 交给宿主的那句话。
 *
 * 只点名「读哪些备注」不够：用户刚在侧边栏改过结构 / 风格 / 主色，如果这句话不带参数，
 * agent 就会自己去猜一套值，改出来的稿跟面板里的不是同一份。所以把当前参数一起交底。
 */
function dispatchPrompt(design: string): string {
	return [
		"The user has pinned notes on the LogoCreator canvas.",
		...(design ? [`Current design: ${design}`] : []),
		"Call logocreator_notes with no arguments to list every pending note — each one names the part of the mark it is about (the mark, the wordmark, the tagline, the background) or is marked as a whole-brand rule.",
		"Work through them one at a time: change the fields a note names and re-render with logocreator_design, keeping the seed unless the note is about the mark's shape.",
		"Then call logocreator_notes with action \"resolve\" and the id you actually addressed. Repeat until it reports nothing pending — including notes the user adds while you work.",
		"Write each reply in the language the user wrote that note in.",
	].join(" ");
}

/**
 * @param cwd     面板所属会话的工作区
 * @param design  当前设计的参数摘要（由画布提供）；空串表示还没有稿
 */
export function useNotesHandoff(cwd: string | null, design = ""): NotesHandoff {
	const { t } = useTranslation();
	const [version, setVersion] = useState(0);
	// 参数摘要每帧都可能变，但 send 的依赖不该跟着变：用 ref 取最新值。
	const designRef = useRef(design);
	designRef.current = design;

	/**
	 * 会话事件的订阅是**可降级**的。
	 *
	 * `conversation.on` 需要 `agent.session.read`，而升级不会自动授予新权限。
	 * 上一版在 effect 里直接调它：被拒时抛错，React 把 effect 的错误交给最近的错误边界，
	 * 整块面板于是变成「面板没能渲染：Plugin permission denied: agent.session.read」—— 一个权限问题
	 * 被放大成整个 tab 不可用。
	 *
	 * 现在：订阅失败只意味着少了 turn 级的实时推送，会话状态改由 `useActiveConversation()`
	 * （纯 hook，不需要额外权限）提供。两者指向同一个宿主 store，所以信息不会错，只是粒度粗一档。
	 */
	const active = useActiveConversation();
	const [live, setLive] = useState<{ id: string | null; cwd: string | null; isStreaming: boolean } | null>(null);
	useEffect(() => {
		let handle: { dispose(): void } | null = null;
		try {
			handle = getPluginContext().conversation.on((event) => {
				if (event.type === "conversation-changed") {
					setLive({ id: event.conversation.id, cwd: event.conversation.cwd, isStreaming: event.conversation.isStreaming });
				} else if (event.type === "turn-start") {
					setLive((current) => (current ? { ...current, isStreaming: true } : current));
				} else if (event.type === "turn-end") {
					setLive((current) => (current ? { ...current, isStreaming: false } : current));
				}
			});
		} catch (error) {
			console.warn("[logocreator] conversation events unavailable, falling back to the active-conversation hook", error);
		}
		return () => handle?.dispose();
	}, []);

	const conversation = live ?? { id: active.id, cwd: active.cwd, isStreaming: active.isStreaming };

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
					: !sameWorkspace(conversation.cwd, cwd)
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
			try {
				if (needsSession && cwd !== null) {
					await conversationApi.createSession(cwd);
				}
				await conversationApi.sendPrompt(dispatchPrompt(designRef.current));
				// 标记放在发送成功之后：先标会让失败的发送看起来像已交付，用户再点也发不出去。
				await getNoteStore().markDispatched(notes.map((note) => note.id));
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

