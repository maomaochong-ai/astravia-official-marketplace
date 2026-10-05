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

/**
 * 简单 Markdown 渲染器 — 将 prompt 文本渲染为格式化的 HTML。
 * 支持：
 * - @`mention` 高亮为标签
 * - ```code``` 代码块
 * - 普通文本
 */
function renderPromptPreview(text: string): JSX.Element {
	const lines = text.split("\n");
	const elements: JSX.Element[] = [];
	let inCodeBlock = false;
	let codeContent: string[] = [];
	let codeLang = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// 代码块开始
		if (line.startsWith("```") && !inCodeBlock) {
			inCodeBlock = true;
			codeLang = line.slice(3).trim();
			codeContent = [];
			continue;
		}

		// 代码块结束
		if (line.startsWith("```") && inCodeBlock) {
			inCodeBlock = false;
			elements.push(
				<div key={`code-${i}`} className="dbx-ai-code-block">
					{codeLang && <div className="dbx-ai-code-lang">{codeLang}</div>}
					<pre className="dbx-ai-code-pre"><code>{codeContent.join("\n")}</code></pre>
				</div>
			);
			continue;
		}

		// 代码块内容
		if (inCodeBlock) {
			codeContent.push(line);
			continue;
		}

		// 普通行 — 处理 @`mention` 高亮
		if (line.trim() === "") {
			elements.push(<div key={`empty-${i}`} className="h-2" />);
			continue;
		}

		// 解析 @`mention` 模式
		const parts = line.split(/(@`[^`]+`)/g);
		elements.push(
			<p key={`line-${i}`} className="dbx-ai-text-line">
				{parts.map((part, j) => {
					if (part.startsWith("@`") && part.endsWith("`")) {
						const mention = part.slice(2, -1);
						return <span key={j} className="dbx-ai-mention">{mention}</span>;
					}
					return <span key={j}>{part}</span>;
				})}
			</p>
		);
	}

	return <div className="dbx-ai-preview">{elements}</div>;
}

export function SendToAiDialog({ open, prompt: initialPrompt, onClose }: SendToAiDialogProps): JSX.Element | null {
	const [prompt, setPrompt] = useState(initialPrompt);
	const [sending, setSending] = useState(false);
	const [showRaw, setShowRaw] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (open) {
			setPrompt(initialPrompt);
			setSending(false);
			setShowRaw(false);
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
				className="dbx-ai-dialog"
			>
				{/* 标题 */}
				<div className="dbx-ai-dialog-header">
					<span className="icon-[lucide--sparkles] h-4 w-4 text-muted-foreground" />
					<h3 className="dbx-ai-dialog-title">发送到 AI 分析</h3>
					<div className="dbx-ai-dialog-actions">
						<button
							type="button"
							onClick={() => setShowRaw(!showRaw)}
							className="dbx-iconbtn"
							title={showRaw ? "显示预览" : "显示原始文本"}
						>
							<span className={`h-3.5 w-3.5 ${showRaw ? "icon-[lucide--eye]" : "icon-[lucide--eye-off]"}`} />
						</button>
						<button
							type="button"
							onClick={onClose}
							title="关闭"
							className="dbx-iconbtn"
						>
							<span className="icon-[lucide--x] h-4 w-4" />
						</button>
					</div>
				</div>

				{/* 内容区 */}
				<div className="dbx-ai-dialog-body">
					<label className="dbx-ai-dialog-label">
						将要发送的内容（可编辑，请核对上下文）
					</label>
					{showRaw ? (
						<textarea
							ref={textareaRef}
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							rows={8}
							className="dbx-form-input resize-none font-mono text-[12px]"
							style={{ minHeight: 160 }}
						/>
					) : (
						<div className="dbx-ai-preview-container">
							{renderPromptPreview(prompt)}
						</div>
					)}
				</div>

				{/* 底部按钮 */}
				<div className="dbx-ai-dialog-footer">
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
