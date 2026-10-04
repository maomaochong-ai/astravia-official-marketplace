/**
 * 发送到 AI 对话框 — 右键连接/表/结果后弹出，内容可编辑，让用户确认后再发送。
 *
 * - 直接发送：作为正式用户消息发出（sendPrompt；无活跃会话时 createSession），
 *   由宿主持久化，AI 回复保存在会话中不丢失。失败自动降级为填入输入框手动发送。
 * - 仅填入输入框：insertText，不发送。
 * 文本框展示完整内容，发送前可核对上下文是否准确。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import type { ConversationState } from "@astravia-org/plugin-sdk";
import { getConversation, getUi } from "../../../runtime-contract.ts";

export interface SendToAiDialogProps {
	open: boolean;
	prompt: string;
	onClose: () => void;
}

/** 读取宿主当前会话状态（订阅会立即 replay 一次当前状态）。 */
function readConversation(): Promise<ConversationState | null> {
	const conv = getConversation();
	return new Promise((resolve) => {
		let settled = false;
		const finish = (state: ConversationState | null): void => {
			if (settled) return;
			settled = true;
			sub.dispose();
			resolve(state);
		};
		const sub = conv.on((event: { type: string; conversation?: ConversationState }) => {
			if (event.type === "conversation-changed" && event.conversation) finish(event.conversation);
		});
		// replay 以微任务到达；超时仅为兜底。
		setTimeout(() => finish(null), 1500);
	});
}

/**
 * 作为正式消息发送：有活跃会话直接 sendPrompt；否则先 createSession。
 * queued（流式中排队）视为成功。任何失败降级为填入输入框。
 */
async function sendForReal(text: string): Promise<boolean> {
	const ui = getUi();
	const conv = getConversation();
	const notify = (message: string, variant: "success" | "warning") =>
		ui?.notify?.({ message, variant });
	try {
		const state = await readConversation();
		if (!state?.id) {
			await conv.createSession(state?.cwd ?? ".", { navigate: true });
		}
		const result = await conv.sendPrompt(text);
		if (result.status === "failed") {
			throw new Error(result.error?.message ?? "sendPrompt failed");
		}
		notify(
			result.status === "queued" ? "已加入发送队列，将在当前回复结束后发出" : "已发送到当前对话，AI 回复会保存在会话中",
			"success",
		);
		return true;
	} catch (e) {
		// 自动发送失败：填入输入框交用户手动发送，不丢内容。
		try {
			conv.insertText(text);
			const reason = e instanceof Error ? e.message : String(e);
			notify(`自动发送失败，已填入输入框，请手动按 Enter 发送（${reason}）`, "warning");
		} catch {
			ui?.notify?.({ message: "发送失败，请重试", variant: "warning" });
		}
		return false;
	}
}

/** 仅填入输入框，不发送。 */
function insertOnly(text: string): void {
	const ui = getUi();
	try {
		getConversation().insertText(text);
		ui?.notify?.({ message: "上下文已填入输入框，请按 Enter 发送给 AI", variant: "success" });
	} catch (e) {
		ui?.notify?.({
			message: `无法填入输入框：${e instanceof Error ? e.message : String(e)}`,
			variant: "warning",
		});
	}
}

export function SendToAiDialog({ open, prompt: initialPrompt, onClose }: SendToAiDialogProps): JSX.Element | null {
	const [prompt, setPrompt] = useState(initialPrompt);
	const [sending, setSending] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (open) {
			setPrompt(initialPrompt);
			setSending(false);
			setTimeout(() => textareaRef.current?.focus(), 50);
		}
	}, [open, initialPrompt]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	async function handleDirectSend(): Promise<void> {
		setSending(true);
		await sendForReal(prompt);
		onClose();
	}

	function handleInsertOnly(): void {
		insertOnly(prompt);
		onClose();
	}

	return (
		<>
			<div className="dbx-modal-backdrop" onClick={onClose} style={{ zIndex: 200 }} />
			<div
				className="absolute left-1/2 top-1/2 z-[201] flex w-[min(520px,calc(100%-2rem))] max-h-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
			>
				{/* 标题 */}
				<div className="flex shrink-0 items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--dbx-line-soft)" }}>
					<span className="icon-[lucide--sparkles] h-4 w-4 text-purple-400" />
					<h3 className="flex-1 text-[13px] font-semibold text-foreground">发送到 AI 分析</h3>
					<button
						type="button"
						onClick={onClose}
						title="关闭"
						className="dbx-iconbtn"
						style={{ height: 24, minWidth: 24, padding: 0 }}
					>
						<span className="icon-[lucide--x] h-4 w-4" />
					</button>
				</div>

				{/* 可编辑的 prompt */}
				<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-4">
					<label className="mb-1 block text-[11px] font-medium text-muted-foreground">
						将要发送的内容（可编辑，请核对上下文）
					</label>
					<textarea
						ref={textareaRef}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						rows={8}
						className="dbx-form-input resize-none font-mono text-[12px]"
						style={{ minHeight: 160 }}
					/>
				</div>

				{/* 底部按钮 */}
				<div className="flex shrink-0 items-center justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--dbx-line-soft)" }}>
					<button className="dbx-btn ghost" onClick={onClose} disabled={sending}>
						取消
					</button>
					<button className="dbx-btn" onClick={handleInsertOnly} disabled={sending} title="填入输入框，手动发送">
						<span className="icon-[lucide--arrow-right-to-line] mr-1 h-3 w-3" />
						仅填入输入框
					</button>
					<button className="dbx-btn primary" onClick={handleDirectSend} disabled={sending} title="作为正式消息发送，回复持久保存">
						<span className="icon-[lucide--send] mr-1 h-3 w-3" />
						{sending ? "发送中…" : "直接发送"}
					</button>
				</div>
			</div>
		</>
	);
}
