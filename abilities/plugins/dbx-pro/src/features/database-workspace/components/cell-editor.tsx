/**
 * CellEditor - 单元格编辑器组件
 * 
 * 支持两种模式：
 * 1. 内联编辑（单行文本）- 使用 input
 * 2. 大文本编辑（多行文本/JSON/长内容）- 使用 textarea
 * 
 * 根据内容长度自动选择编辑器类型
 */

import { useEffect, useRef, useState, type JSX } from "react";

export interface CellEditorProps {
	/** 当前值 */
	value: unknown;
	/** 列名 */
	column: string;
	/** 是否为只读 */
	readOnly?: boolean;
	/** 提交编辑 */
	onCommit: (newValue: unknown) => void;
	/** 取消编辑 */
	onCancel: () => void;
}

/**
 * 判断是否需要使用大文本编辑器
 * - 包含换行符
 * - 长度超过 50 字符
 * - 是 JSON 对象/数组
 */
function needsExpandedEditor(value: unknown): boolean {
	if (value === null || value === undefined) return false;
	const text = String(value);
	if (text.includes("\n") || text.includes("\r")) return true;
	if (text.length > 50) return true;
	if (typeof value === "object") return true;
	return false;
}

/**
 * 内联单元格编辑器（单行 input）
 */
function InlineCellEditor({ value, onCommit, onCancel }: CellEditorProps): JSX.Element {
	const inputRef = useRef<HTMLInputElement>(null);
	const [editValue, setEditValue] = useState(String(value ?? ""));

	useEffect(() => {
		// 自动聚焦并选中全部文本
		if (inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, []);

	function handleKeyDown(e: React.KeyboardEvent): void {
		if (e.key === "Enter") {
			e.preventDefault();
			onCommit(editValue);
		} else if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		} else if (e.key === "Tab") {
			e.preventDefault();
			onCommit(editValue);
		}
	}

	function handleBlur(): void {
		onCommit(editValue);
	}

	return (
		<input
			ref={inputRef}
			type="text"
			value={editValue}
			onChange={(e) => setEditValue(e.target.value)}
			onKeyDown={handleKeyDown}
			onBlur={handleBlur}
			className="dbx-cell-editor-input"
			style={{
				width: "100%",
				height: "100%",
				padding: "2px 6px",
				fontSize: "12px",
				fontFamily: "inherit",
				border: "none",
				outline: "2px solid var(--foreground)",
				background: "var(--background)",
				color: "var(--foreground)",
			}}
		/>
	);
}

/**
 * 大文本单元格编辑器（多行 textarea）
 */
function ExpandedCellEditor({ value, column, onCommit, onCancel }: CellEditorProps): JSX.Element {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [editValue, setEditValue] = useState(
		typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "")
	);

	useEffect(() => {
		// 自动聚焦
		if (textareaRef.current) {
			textareaRef.current.focus();
			textareaRef.current.select();
			// 自动调整高度
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
		}
	}, []);

	function handleKeyDown(e: React.KeyboardEvent): void {
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		} else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			// Mod+Enter 提交
			e.preventDefault();
			onCommit(editValue);
		}
	}

	function handleBlur(): void {
		onCommit(editValue);
	}

	return (
		<div className="dbx-expanded-cell-editor">
			<div className="dbx-expanded-cell-editor-header">
				<span className="dbx-expanded-cell-editor-title">编辑：{column}</span>
				<div className="dbx-expanded-cell-editor-actions">
					<button type="button" onClick={onCancel} className="dbx-btn ghost" style={{ height: 24, fontSize: 11 }}>
						取消
					</button>
					<button type="button" onClick={() => onCommit(editValue)} className="dbx-btn primary" style={{ height: 24, fontSize: 11 }}>
						保存
					</button>
				</div>
			</div>
			<textarea
				ref={textareaRef}
				value={editValue}
				onChange={(e) => {
					setEditValue(e.target.value);
					// 自动调整高度
					e.target.style.height = "auto";
					e.target.style.height = `${Math.min(e.target.scrollHeight, 300)}px`;
				}}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				className="dbx-cell-editor-textarea"
				style={{
					width: "100%",
					minHeight: 100,
					maxHeight: 300,
					padding: 8,
					fontSize: 12,
					fontFamily: "var(--font-mono, ui-monospace, monospace)",
					border: "1px solid var(--dbx-line)",
					borderRadius: 4,
					background: "var(--background)",
					color: "var(--foreground)",
					outline: "none",
					resize: "vertical",
				}}
			/>
		</div>
	);
}

/**
 * 单元格编辑器主组件
 * 根据内容长度自动选择内联或大文本编辑器
 */
export function CellEditor(props: CellEditorProps): JSX.Element {
	if (props.readOnly) {
		// 只读模式：显示大文本查看器
		return <ExpandedCellEditor {...props} />;
	}

	if (needsExpandedEditor(props.value)) {
		return <ExpandedCellEditor {...props} />;
	}

	return <InlineCellEditor {...props} />;
}
