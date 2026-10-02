/**
 * 跨 feature 复用的确认对话框 — 写入确认 / 连接删除 / table drop 等。
 * 受控组件：调用方 open + onConfirm / onCancel。
 */
import { useEffect, useRef } from "react";

interface ModalDialogProps {
	open: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	danger?: boolean;
	children?: React.ReactNode;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ModalDialog({
	open, title, message, confirmText = "确定", cancelText = "取消",
	danger, children, onConfirm, onCancel,
}: ModalDialogProps) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
			if (e.key === "Enter" && !danger) onConfirm();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onCancel, onConfirm, danger]);

	if (!open) return null;
	return (
		<div className="dbx-modal-backdrop" onClick={onCancel}>
			<div className="dbx-modal" ref={ref} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
				<h3 className="dbx-modal-title">{title}</h3>
				<p className="dbx-modal-message">{message}</p>
				{children}
				<div className="dbx-modal-actions">
					<button className="dbx-btn" onClick={onCancel}>{cancelText}</button>
					<button
						className={`dbx-btn ${danger ? "danger" : "primary"}`}
						onClick={onConfirm}
						autoFocus
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
}
