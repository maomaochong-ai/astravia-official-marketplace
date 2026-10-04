/**
 * 发送到 AI 对话框 — 右键连接/表/结果后弹出，让用户选择「直接发送」或「编辑后发送」。
 *
 * 交互策略（稳定性优先）：
 * 为了确保消息能正确挂载到宿主当前对话并实现持久化，所有发送动作最终都统一
 * 降级为 insertText。这避免了 sendPrompt 可能导致的上下文丢失问题。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { getConversation, getPermissions, getUi } from "../../../runtime-contract.ts";

export interface SendToAiDialogProps {
	open: boolean;
	prompt: string;
	onClose: () => void;
}

async function handleAiSend(prompt: string): Promise<void> {
	const ui = getUi();
	const notify = (message: string, variant: "info" | "warning" | "error" | "success") =>
		ui?.notify?.({ message, variant });

	// 权限预检
	const perms = getPermissions();
	if (!perms.has("agent.session.read") || !perms.has("agent.session.write")) {
		notify("AI 交互权限未授权，请在设置页授权", "warning");
		// 即使未授权，仍尝试填入文本供用户手动发送
	}

	try {
		getConversation().insertText(prompt);
		notify("上下文已填入输入框，请按 Enter 发送给 AI", "success");
	} catch (err) {
		notify("无法填入输入框，请重试", "error");
		console.warn("[dbx-pro] insertText failed:", err);
	}
}

export function SendToAiDialog({ open, prompt: initialPrompt, onClose }: SendToAiDialogProps): JSX.Element | null {
	const [prompt, setPrompt] = useState(initialPrompt);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (open) {
			setPrompt(initialPrompt);
			// 打开时自动聚焦到文本框
			setTimeout(() => textareaRef.current?.focus(), 50);
		}
	}, [open, initialPrompt]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	function handleDirectSend() {
		void handleAiSend(prompt);
		onClose();
	}

	function handleInsertOnly() {
		void handleAiSend(prompt);
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
						将要发送的内容（可编辑）
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
					<button className="dbx-btn ghost" onClick={onClose}>
						取消
					</button>
					<button className="dbx-btn" onClick={handleInsertOnly} title="填入输入框，手动发送">
						<span className="icon-[lucide--arrow-right-to-line] mr-1 h-3 w-3" />
						仅填入输入框
					</button>
					<button className="dbx-btn primary" onClick={handleDirectSend} title="填入输入框，提示用户发送">
						<span className="icon-[lucide--send] mr-1 h-3 w-3" />
						直接发送
					</button>
				</div>
			</div>
		</>
	);
}
