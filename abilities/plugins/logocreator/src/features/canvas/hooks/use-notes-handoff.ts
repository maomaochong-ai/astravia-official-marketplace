import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveConversation, useTranslation } from "@astravia-org/plugin-sdk";
import { getNoteStore, getPluginContext } from "../../../plugin-context";
import type { CanvasNote } from "../../../domain/notes";

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
	/** 会话在另一个工作区：仍然发进当前会话，面板只写一行提示。 */
	workspaceMismatch: boolean;
	/** A session will be created on send — the panel says so before the click. */
	needsSession: boolean;
	sendAll: (mode?: "auto" | "manual") => Promise<boolean>;
}

const AUTO_DISPATCH_MS = 1_200;

/**
 * 交给宿主的那句话。
 *
 * 只点名「读哪些备注」不够：用户刚在侧边栏改过结构 / 风格 / 主色，如果这句话不带参数，
 * agent 就会自己去猜一套值，改出来的稿跟面板里的不是同一份。所以把当前参数一起交底。
 */
function dispatchPrompt(design: string, ids: readonly string[]): string {
	return [
		`The user has pinned ${ids.length} note${ids.length === 1 ? "" : "s"} on the LogoCreator canvas (ids: ${ids.join(", ")}).`,
		...(design ? [`Current design: ${design}`] : []),
		// 点名 id：自动派发可能连续发生两次，后者不该把已经处理过的再读一遍。
		`Call logocreator_notes with no arguments to list every pending note; work only on the ids above. Each one names the part of the mark it is about (the mark, the wordmark, the tagline, the background) or is marked as a whole-brand rule.`,
		"Work through them one at a time: change the fields a note names and re-render with logocreator_design, keeping the seed unless the note is about the mark's shape.",
		'Then call logocreator_notes with action "resolve" and the id you actually addressed. Repeat until it reports nothing pending — including notes the user adds while you work.',
		"Write each reply in the language the user wrote that note in.",
	].join(" ");
}

/**
 * @param cwd      面板所属会话的工作区
 * @param design   当前设计的参数摘要（由画布提供）；空串表示还没有稿
 * @param designId 当前选中的稿；备注按它分流，避免把别的设计稿的备注一起发出去
 */
export function useNotesHandoff(cwd: string | null, design = "", designId: string | null = null): NotesHandoff {
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

	/**
	 * 面板上看得见的那批备注：本稿的 + 品牌级的（designId === null）。
	 *
	 * 之前直接取 `pending()`（全部稿），于是在设计 A 上点「交给智能体」，设计 B 的备注
	 * 也一起被发了出去 —— 面板里看不到的东西不该被发出。
	 */
	const scopeFilter = (note: CanvasNote): boolean => note.designId === null || note.designId === designId;
	const pending = getNoteStore().pending().filter(scopeFilter);
	/**
	 * 只有「宿主此刻没有任何活跃会话」才需要新建。
	 *
	 * 上一版用 `!conversation?.cwd` 判断，于是用户开着一个没有工作区的对话（在宿主里很常见）
	 * 时，点「交给智能体」会另开一个会话，备注永远进不到他正在看的那个里。
	 */
	const needsSession = !conversation?.id && cwd !== null;

	const mismatch = cwd !== null && conversation?.cwd != null && !sameWorkspace(conversation.cwd, cwd);
	// 只拦「没有备注」。工作区不一致与 streaming 都不是障碍：前者仍然发进用户正看着的会话，
	// 后者宿主会排队（回执 status: "queued"），拦下来只会让按钮看起来没反应。
	const blocked: HandoffBlock | null = pending.length === 0 ? "no-notes" : null;

	const messages: Record<HandoffBlock, string> = {
		"no-notes": t("notes.handoff.noNotes"),
		"no-workspace": t("notes.handoff.noWorkspace"),
		"other-workspace": t("notes.handoff.otherWorkspace"),
		streaming: t("notes.handoff.streaming"),
	};

	/**
	 * 发出去。`mode` 决定“发哪些”：
	 *   auto   —— 只发还没派发过的（自动派发场景）。之前用 `pending()`，第二次留备注会把
	 *             第一已派发的再发一遍，会话里出现重复指令。
	 *   manual —— 面板上看得见的所有待处理备注（用户主动重发）。
	 */
	const send = useCallback(
		async (mode: "auto" | "manual" = "manual"): Promise<boolean> => {
			const conversationApi = getPluginContext().conversation;
			const store = getNoteStore();
			const notes =
				mode === "auto"
					? store.undispatched().filter((note) => note.designId === null || note.designId === designId)
					: store.pending().filter((note) => note.designId === null || note.designId === designId);
			if (notes.length === 0) return false;
			const prompt = dispatchPrompt(designRef.current, notes.map((note) => note.id));
			try {
				if (needsSession && cwd !== null) {
					await conversationApi.createSession(cwd);
				}
				const result = await conversationApi.sendPrompt(prompt);
				if (result.status === "failed") {
					throw new Error(result.error?.message ?? "The host refused the prompt.");
				}
				await store.markDispatched(notes.map((note) => note.id));
				getPluginContext().ui.notify({
					message: result.status === "queued" ? t("notes.handoff.queued") : t("notes.handoff.sent"),
					variant: "success",
				});
				return true;
			} catch (error) {
				// 没有活跃会话时 sendPrompt 抛错：这时才建一个（有 cwd 才建），再发一次。
				if (cwd !== null) {
					try {
						await conversationApi.createSession(cwd);
						const retry = await conversationApi.sendPrompt(prompt);
						if (retry.status !== "failed") {
							await store.markDispatched(notes.map((note) => note.id));
							getPluginContext().ui.notify({
								message: retry.status === "queued" ? t("notes.handoff.queued") : t("notes.handoff.sent"),
								variant: "success",
							});
							return true;
						}
					} catch (retryError) {
						// 落下去给用户看的原因：建会话也失败。
						error = retryError;
					}
				}
				// 最后一道：至少把话填进输入框，用户能看到它、手动发。
				try {
					conversationApi.insertText(prompt);
				} catch {
					// insertText 不可用时只能报错。
				}
				getPluginContext().ui.notify({ message: t("notes.handoff.failed"), error });
				return false;
			}
		},
		[cwd, needsSession, t, designId],
	);

	/**
	 * Auto-dispatch, debounced: users pin several notes in a row, and sending on the
	 * first one would occupy the session before the rest exist. Any change restarts the
	 * timer, so a burst collapses into one hand-off.
	 */
	const sendRef = useRef(send);
	sendRef.current = send;
	useEffect(() => {
		// 只看本稿的未派发备注：别的稿的交给它们自己的面板，不在这一页自动设。
		const fresh = getNoteStore()
			.undispatched()
			.filter((note) => note.designId === null || note.designId === designId);
		if (fresh.length === 0) return;
		// streaming 时宿主会把 prompt 排队（回执 queued），这里不拦：拦下来只会让按钮看起来失效。
		if (blocked !== null) return;
		const timer = window.setTimeout(() => {
			void sendRef.current("auto");
		}, AUTO_DISPATCH_MS);
		return () => window.clearTimeout(timer);
	}, [blocked, version]);

	return {
		blocked,
		workspaceMismatch: mismatch,
		blockedReason: blocked === null ? null : messages[blocked],
		isStreaming: conversation?.isStreaming ?? false,
		needsSession,
		sendAll: send,
	};
}

