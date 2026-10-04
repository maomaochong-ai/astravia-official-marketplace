/**
 * AI 助手面板 — 与宿主对话双向交互：
 * 顶部展示宿主当前会话状态（订阅 conversation.on），输入框可把 prompt
 * 发回宿主 AI 会话；下方渲染最近一个助手回复。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import type { ConversationEvent } from "@astravia-org/plugin-sdk";
import { getConversation } from "../../../runtime-contract";

interface ConversationShape {
	id: string | null;
	isStreaming: boolean;
}

export function AiPanel(): JSX.Element {
	const [conversation, setConversation] = useState<ConversationShape>({ id: null, isStreaming: false });
	const [lastReply, setLastReply] = useState<string>("");
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => {
		let disposed = false;
		let disposable: { dispose: () => void } | null = null;
		try {
			disposable = getConversation().on((event: ConversationEvent) => {
				if (disposed) return;
				if (event.type === "conversation-changed") {
					setConversation({ id: event.conversation.id, isStreaming: event.conversation.isStreaming });
				}
				if (event.type === "turn-start") setConversation((c) => ({ ...c, isStreaming: true }));
				if (event.type === "turn-end") setConversation((c) => ({ ...c, isStreaming: false }));
				if (event.type === "message-added" && event.message.role === "assistant") {
					setLastReply(event.message.text);
				}
				if (event.type === "message-updated" && event.delta) {
					setLastReply((prev) => prev + event.delta);
				}
			});
		} catch { /* 宿主未激活会话时静默 */ }
		return () => {
			disposed = true;
			disposable?.dispose();
		};
	}, []);

	async function send(): Promise<void> {
		const text = input.trim();
		if (!text || sending) return;
		setSending(true);
		setError(null);
		try {
			const result = await getConversation().sendPrompt(text);
			if (result.status === "failed") setError(result.error?.message ?? "发送失败");
			else {
				setInput("");
				if (textareaRef.current) textareaRef.current.value = "";
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSending(false);
		}
	}

	return (
		<div className="flex h-full flex-col bg-background">
			<div className="flex h-9 shrink-0 items-center gap-1.5 px-3 text-[11px] font-medium text-muted-foreground" style={{ backgroundColor: "var(--dbx-surface)", borderBottom: "1px solid var(--dbx-line-soft)" }}>
				<span className="icon-[lucide--bot] h-3.5 w-3.5" />
				AI 助手
				<span className="ml-1 text-[10px] text-muted-foreground/70">
					{conversation.id ? (conversation.isStreaming ? "生成中…" : "会话中") : "未激活会话"}
				</span>
			</div>
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-3">
				{lastReply ? (
					<pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/90">{lastReply}</pre>
				) : (
					<p className="text-[11px] text-muted-foreground/70">与宿主 AI 双向交互：在下方输入问题即可发给宿主会话，AI 回复会实时同步。</p>
				)}
				{error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
			</div>
			<div className="shrink-0 border-t border-border p-2">
				<textarea
					ref={textareaRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
					placeholder="输入要发给 AI 的内容…"
					rows={2}
					className="dbx-form-input resize-none text-[12px]"
				/>
				<div className="mt-1 flex justify-end">
					<button type="button" onClick={() => void send()} disabled={sending || !input.trim()} className="dbx-btn primary">
						{sending ? "发送中…" : "发送"}
					</button>
				</div>
			</div>
		</div>
	);
}
