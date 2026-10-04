/**
 * 发送到 AI 对话框 — 右键连接/表/结果后弹出，让用户选择「直接发送」或「编辑后发送」。
 *
 * 交互：
 * - 点击右键菜单"发送到 AI 分析" → 弹此对话框，预填 prompt
 * - 用户可编辑 prompt 文本
 * - 点击「直接发送」→ 走 sendPrompt → createSession → insertText 降级链路
 * - 点击「仅填入输入框」→ 只走 insertText，不自动发送，用户可手动修改后发送
 * - 点击「取消」→ 关闭对话框，不发送
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { getConversation, getPermissions, getUi } from "../../../runtime-contract.ts";
import type { ConversationEvent } from "@astravia-org/plugin-sdk";

export interface SendToAiDialogProps {
	open: boolean;
	prompt: string;
	onClose: () => void;
}

/** 探测当前是否有活跃会话，最多等 3 秒。 */
function hasActiveConversation(): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		let settled = false;
		let sub: { dispose(): void } | null = null;
		const finish = (value: boolean): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			sub?.dispose();
			resolve(value);
		};
		const timer = setTimeout(() => finish(false), 3000);
		try {
			sub = getConversation().on((event: ConversationEvent) => {
				if (event.type === "conversation-changed") finish(event.conversation.id !== null);
			});
		} catch {
			finish(false);
		}
	});
}

async function sendAiPrompt(prompt: string): Promise<void> {
	const ui = getUi();
	const notify = (message: string, error?: unknown) =>
		ui?.notify?.({ message, variant: "warning", error });

	// 权限预检
	const perms = getPermissions();
	const needRead = perms.has("agent.session.read");
	const needWrite = perms.has("agent.session.write");
	if (!needRead || !needWrite) {
		notify(
			"AI 交互权限未授权",
			new Error(
				`需要 agent.session.read（${needRead ? "已授权" : "未授权"}）+ ` +
				`agent.session.write（${needWrite ? "已授权" : "未授权"}）。请到插件设置页授权。`,
			),
		);
	}

	const conv = getConversation();

	// 探测活跃会话
	let hasSession = false;
	try {
		hasSession = await hasActiveConversation();
	} catch {
		hasSession = false;
	}

	// 有活跃会话 → 直接 sendPrompt
	if (hasSession) {
		try {
			const result = await conv.sendPrompt(prompt);
			if (result.status !== "failed") return;
			throw new Error(result.error?.message ?? "sendPrompt failed");
		} catch {
			// 排队失败，继续走 createSession
		}
	}

	// 无活跃会话 → createSession 后再 sendPrompt
	try {
		await conv.createSession(".", { navigate: true });
		const result = await conv.sendPrompt(prompt);
		if (result.status !== "failed") return;
		throw new Error(result.error?.message ?? "sendPrompt after createSession failed");
	} catch {
		// 全部失败，走 insertText
	}

	// 最终降级
	try {
		conv.insertText(prompt);
	} catch (err) {
		notify("发送 AI 上下文失败（所有路径均已尝试）", err);
	}
}

async function insertAiPrompt(prompt: string): Promise<void> {
	try {
		getConversation().insertText(prompt);
	} catch (err) {
		const ui = getUi();
		ui?.notify?.({ message: "填入 AI 输入框失败", variant: "warning", error: err });
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

	function handleSend() {
		void sendAiPrompt(prompt);
		onClose();
	}

	function handleInsertOnly() {
		void insertAiPrompt(prompt);
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
					<button className="dbx-btn" onClick={handleInsertOnly}>
						<span className="icon-[lucide--arrow-right-to-line] mr-1 h-3 w-3" />
						仅填入输入框
					</button>
					<button className="dbx-btn primary" onClick={handleSend}>
						<span className="icon-[lucide--send] mr-1 h-3 w-3" />
						直接发送
					</button>
				</div>
			</div>
		</>
	);
}
