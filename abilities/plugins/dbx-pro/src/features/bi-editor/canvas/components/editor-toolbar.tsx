/**
 * editor-toolbar.tsx — BI 编辑器顶栏。
 *
 * 对齐设计稿：
 *   - frames/back-button.tsx  返回按钮（IconButton · 28×28 · lucide arrow-left · 竖线分隔）
 *   - frames/editor.tsx       三栏骨架的 Toolbar
 *   - frames/run.tsx          运行按钮（触发 RunPanel）
 *
 * 所有图标统一 @iconify-json/lucide 的 icon-[lucide--xxx] 语法。
 */

import { useCallback, useEffect, useState, type JSX } from "react";
import { Icon } from "../../shar../../shared/component../../shar../../shared/component../../shar../../shared/component../../shar../../shared/components/ui/icon";

export function BigscreenToolbar({
	pageName,
	theme,
	dirty,
	onBack,
	onThemeChange,
	onSave,
	onRename,
	onSaveTemplate,
	onRunAll,
	onRunSelected,
	saving = false,
	onAiGenerate,
}: {
	pageName: string;
	theme: "dark" | "default";
	dirty: boolean;
	onBack: () => void;
	onThemeChange: (t: "dark" | "default") => void;
	onSave: () => void;
	onRename: (n: string) => void;
	onSaveTemplate?: () => void;
	onRunAll?: () => void;
	onRunSelected?: () => void;
	saving?: boolean;
	onAiGenerate?: () => void;
}): JSX.Element {
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState(pageName);

	// ── 返回拦截：有未保存更改时三选一 ──
	const [backDialog, setBackDialog] = useState<null | "save-leave" | "discard-leave" | "cancel">(null);

	useEffect(() => { setNameDraft(pageName); }, [pageName]);

	const handleBackClick = useCallback(() => {
		if (saving) return; // 保存中忽略
		if (dirty) {
			onSave?.();
			onBack();
		} else {
			onBack();
		}
	}, [saving, dirty, onSave, onBack]);

	// ── 快捷键 ──
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			const meta = e.metaKey || e.ctrlKey;
			if (!meta) return;
			if (e.key.toLowerCase() === "s") {
				e.preventDefault();
				if (!saving) onSave?.();
			} else if (e.key === "[") {
				e.preventDefault();
				handleBackClick();
			} else if (e.key.toLowerCase() === "r") {
				e.preventDefault();
				onRunAll?.();
			}
		}
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [saving, onSave, onRunAll, handleBackClick]);

	function commitName() {
		const trimmed = nameDraft.trim();
		if (trimmed && trimmed !== pageName) onRename(trimmed);
		else setNameDraft(pageName);
		setEditingName(false);
	}

	return (
		<>
			<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
				{/* 返回按钮 — 对齐 frames/back-button.tsx */}
				<button
					type="button"
					aria-label="返回 BI 数据资产"
					title="返回 BI 数据资产"
					onClick={handleBackClick}
					disabled={saving}
					className={`grid size-7 shrink-0 place-items-center rounded-control transition
						${saving
							? "text-faint cursor-not-allowed"
							: "text-muted hover:bg-neutral-muted hover:text-surface-foreground active:bg-border-strong focus-visible:shadow-[0_0_0_2px_var(--color-accent-soft)]"}
					`}
				>
					<Icon name="icon-[lucide--arrow-left]" className="size-3.5" />
				</button>

				{/* 竖线分隔 — 1×20 border 色 */}
				<span className="h-5 w-px shrink-0 bg-border" />

				{/* 页面名（可编辑） */}
				{editingName ? (
					<input
						autoFocus
						type="text"
						value={nameDraft}
						onChange={(e) => setNameDraft(e.target.value)}
						onBlur={commitName}
						onKeyDown={(e) => {
							if (e.key === "Enter") commitName();
							if (e.key === "Escape") { setNameDraft(pageName); setEditingName(false); }
						}}
						className="h-7 min-w-[120px] rounded-control border border-accent bg-surface px-2 text-[13px] font-medium text-surface-foreground outline-none"
					/>
				) : (
					<button
						type="button"
						className="flex h-7 items-center gap-1 rounded-control px-2 text-[13px] font-medium text-surface-foreground hover:border-border hover:bg-surface"
						onClick={() => { setNameDraft(pageName); setEditingName(true); }}
						title="点击重命名"
					>
						<span className="truncate max-w-[240px]">{pageName}</span>
						{dirty && !saving && <span className="font-mono text-[10px] text-faint">●</span>}
						{saving && <Icon name="icon-[lucide--loader]" className="size-3 text-accent animate-spin" />}
					</button>
				)}

				{/* 中间按钮簇 */}
				<div className="mx-auto flex items-center gap-1.5">
					<button
						type="button"
						className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-muted hover:border-border-strong hover:text-surface-foreground disabled:opacity-50"
						disabled={!dirty || saving}
						onClick={onSave}
						title="⌘S 保存"
					>
						<Icon name="icon-[lucide--save]" className="size-3.5" />
						<span>保存</span>
					</button>

					{onRunAll ? (
						<button
							type="button"
							className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-muted hover:border-border-strong hover:text-surface-foreground"
							onClick={onRunAll}
							title="⌘R 运行全部节点"
						>
							<Icon name="icon-[lucide--play]" className="size-3.5 text-accent" />
							<span>运行</span>
						</button>
					) : null}

					<button
						type="button"
						onClick={onAiGenerate}
						className="flex h-7 items-center gap-1.5 rounded-control border border-accent/40 bg-accent-soft px-2.5 text-[12px] font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
						title="AI 自动生成节点（调 bi_utils.create_page + spec_builder）"
					>
						<Icon name="icon-[lucide--sparkles]" className="size-3.5" />
						<span>AI 生成节点</span>
					</button>

					{onSaveTemplate ? (
						<button
							type="button"
							className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12px] text-muted hover:border-border-strong hover:text-surface-foreground"
							onClick={onSaveTemplate}
							title="把当前画布保存为模板（NodeLibrary 底部可见）"
						>
							<Icon name="icon-[lucide--layout-template]" className="size-3.5" />
							<span>保存为模板</span>
						</button>
					) : null}
				</div>

				{/* 右：主题切换 */}
				<div className="ml-auto flex items-center gap-1 rounded-control border border-border bg-surface p-0.5">
					<button
						type="button"
						className={`flex h-6 items-center gap-1 rounded-control px-2 text-[11px] ${
							theme === "default"
								? "bg-surface-raised text-surface-foreground"
								: "text-muted hover:text-surface-foreground"
						}`}
						onClick={() => onThemeChange("default")}
						title="明亮主题（看板用）"
					>
						<Icon name="icon-[lucide--sun]" className="size-3" />
						<span>明亮</span>
					</button>
					<button
						type="button"
						className={`flex h-6 items-center gap-1 rounded-control px-2 text-[11px] ${
							theme === "dark"
								? "bg-surface-raised text-surface-foreground"
								: "text-muted hover:text-surface-foreground"
						}`}
						onClick={() => onThemeChange("dark")}
						title="深色主题（大屏用）"
					>
						<Icon name="icon-[lucide--moon]" className="size-3" />
						<span>深色</span>
					</button>
				</div>
			</div>

			{/* 返回拦截对话框（dirty 状态）— 简化为自动保存后离开，预留扩展 */}
			{backDialog ? (
				<div className="fixed inset-0 z-50 grid place-items-center bg-scrim/60">
					<div className="w-[360px] overflow-hidden rounded-card border border-border bg-surface shadow-2xl">
						<div className="px-4 py-3">
							<div className="text-[13px] font-semibold text-surface-foreground">有未保存的更改</div>
							<p className="mt-1 text-[11px] text-muted">离开前要保存吗？</p>
						</div>
						<div className="flex flex-col gap-1 border-t border-border px-3 py-2">
							<button
								type="button"
								className="flex h-8 items-center gap-2 rounded-control bg-accent px-3 text-[12px] font-medium text-accent-foreground"
								onClick={() => { setBackDialog(null); onSave(); onBack(); }}
							>
								<Icon name="icon-[lucide--save]" className="size-3.5" />
								保存并离开
							</button>
							<button
								type="button"
								className="flex h-8 items-center gap-2 rounded-control border border-transparent px-3 text-[12px] text-muted hover:border-border hover:text-surface-foreground"
								onClick={() => { setBackDialog(null); onBack(); }}
							>
								不保存，直接离开
							</button>
							<button
								type="button"
								className="flex h-8 items-center gap-2 rounded-control border border-transparent px-3 text-[12px] text-muted hover:border-border hover:text-surface-foreground"
								onClick={() => setBackDialog(null)}
							>
								取消
							</button>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
