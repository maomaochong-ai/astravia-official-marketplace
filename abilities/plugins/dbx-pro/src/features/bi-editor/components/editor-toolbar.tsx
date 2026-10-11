/**
 * editor-toolbar.tsx — BI 编辑器顶栏（按设计稿 EditorToolbar 简化）。
 *
 * 左：返回 / 页面名（可编辑）
 * 中：AI 生成 / 运行 / 保存
 * 右：主题切换
 */

import { type JSX, useState } from "react";

export function BigscreenToolbar({
	pageName,
	theme,
	dirty,
	onBack,
	onThemeChange,
	onSave,
	onRename,
	onSaveTemplate,
}: {
	pageName: string;
	theme: "dark" | "default";
	dirty: boolean;
	onBack: () => void;
	onThemeChange: (t: "dark" | "default") => void;
	onSave: () => void;
	onRename: (n: string) => void;
	onSaveTemplate?: () => void;
}): JSX.Element {
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState(pageName);

	function commitName() {
		const trimmed = nameDraft.trim();
		if (trimmed && trimmed !== pageName) onRename(trimmed);
		else setNameDraft(pageName);
		setEditingName(false);
	}

	return (
		<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-2">
			{/* 返回 */}
			<button
				type="button"
				className="flex h-7 items-center gap-1 rounded-control px-2 text-[12px] text-muted hover:border-border hover:bg-surface hover:text-surface-foreground"
				onClick={onBack}
				title="返回工作台"
			>
				← 返回
			</button>

			<span className="mx-1 h-5 w-px bg-border" />

			{/* 页面名（可编辑） */}
			{editingName ? (
				<input
					autoFocus
					type="text"
					value={nameDraft}
					onChange={(e) => setNameDraft(e.target.value)}
					onBlur={commitName}
					onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setNameDraft(pageName); setEditingName(false); } }}
					className="h-7 min-w-[120px] rounded-control border border-accent bg-surface px-2 text-[13px] font-medium text-surface-foreground outline-none"
				/>
			) : (
				<button
					type="button"
					className="flex h-7 items-center gap-1 rounded-control px-2 text-[13px] font-medium text-surface-foreground hover:border-border hover:bg-surface"
					onClick={() => { setNameDraft(pageName); setEditingName(true); }}
					title="点击重命名"
				>
					<span>{pageName}</span>
					{dirty && <span className="font-mono text-[10px] text-faint">●</span>}
				</button>
			)}

			{/* 中间按钮 */}
			<div className="mx-auto flex items-center gap-1.5">
				<button
					type="button"
					className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-muted hover:border-border-strong hover:text-surface-foreground disabled:opacity-50"
					disabled={!dirty}
					onClick={onSave}
					title="Ctrl+S 保存"
				>
					💾 保存
				</button>
				<button
					type="button"
					className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-muted hover:border-border-strong hover:text-surface-foreground"
					title="在浏览器中运行预览"
				>
					▶ 运行
				</button>
				<button
					type="button"
					className="flex h-7 items-center gap-1.5 rounded-control border border-accent/40 bg-accent-soft px-2.5 text-[12px] font-medium text-accent hover:bg-accent/10"
					title="AI 自动生成节点（调 bi_utils.create_page + spec_builder）"
				>
					⚡ AI 生成节点
				</button>
				{onSaveTemplate ? (
					<button
						type="button"
						className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-muted hover:border-border-strong hover:text-surface-foreground"
						onClick={onSaveTemplate}
						title="把当前画布保存为模板（NodeLibrary 底部可见）"
					>
						📐 保存为模板
					</button>
				) : null}
			</div>

			{/* 右：主题切换 */}
			<div className="ml-auto flex items-center gap-1 rounded-control border border-border bg-surface p-0.5">
				<button
					type="button"
					className={`flex h-6 items-center gap-1 rounded-control px-2 text-[11px] ${theme === "default" ? "bg-surface-raised text-surface-foreground" : "text-muted hover:text-surface-foreground"}`}
					onClick={() => onThemeChange("default")}
					title="明亮主题（看板用）"
				>☀ 明亮</button>
				<button
					type="button"
					className={`flex h-6 items-center gap-1 rounded-control px-2 text-[11px] ${theme === "dark" ? "bg-surface-raised text-surface-foreground" : "text-muted hover:text-surface-foreground"}`}
					onClick={() => onThemeChange("dark")}
					title="深色主题（大屏用）"
				>☾ 深色</button>
			</div>
		</div>
	);
}
