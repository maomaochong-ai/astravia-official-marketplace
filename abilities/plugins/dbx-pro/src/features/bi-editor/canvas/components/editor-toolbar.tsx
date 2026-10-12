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
import { Icon } from "../../shared/components/ui/icon";
import { IconButton } from "../../shared/components/ui/icon-button";
import { ARRANGE_LAYOUTS, type ArrangeLayout } from "../lib/auto-layout";
import { ShortcutsDialog } from "./shortcuts-dialog";

/** 焦点在输入框里时，⌘Z / G 这类按键交还给输入框自己处理。 */
function isTypingEvent(e: KeyboardEvent): boolean {
	const t = e.target as HTMLElement | null;
	return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

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
	canUndo = false,
	canRedo = false,
	onUndo,
	onRedo,
	guidesOn = true,
	onGuidesToggle,
	onArrange,
}: {
	pageName: string;
	theme: "dark" | "default";
	dirty: boolean;
	onBack: () => void;
	onThemeChange: (t: "dark" | "default") => void;
	onSave: () => void | Promise<void>;
	onRename: (n: string) => void;
	onSaveTemplate?: () => void;
	onRunAll?: () => void;
	onRunSelected?: () => void;
	saving?: boolean;
	onAiGenerate?: () => void;
	canUndo?: boolean;
	canRedo?: boolean;
	onUndo?: () => void;
	onRedo?: () => void;
	guidesOn?: boolean;
	onGuidesToggle?: () => void;
	onArrange?: (layout: ArrangeLayout) => void;
}): JSX.Element {
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState(pageName);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const [arrangeOpen, setArrangeOpen] = useState(false);

	useEffect(() => { setNameDraft(pageName); }, [pageName]);

	const handleBackClick = useCallback(async () => {
		if (saving) return;
		if (dirty) {
			await onSave?.();
		}
		onBack();
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
			} else if (e.key.toLowerCase() === "z" && !isTypingEvent(e)) {
				e.preventDefault();
				if (e.shiftKey) onRedo?.();
				else onUndo?.();
			} else if (e.key.toLowerCase() === "y" && !isTypingEvent(e)) {
				e.preventDefault();
				onRedo?.();
			} else if (e.key === "/") {
				e.preventDefault();
				setShortcutsOpen(true);
			}
		}
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [saving, onSave, onRunAll, onUndo, onRedo, handleBackClick]);

	function commitName() {
		const trimmed = nameDraft.trim();
		if (trimmed && trimmed !== pageName) onRename(trimmed);
		else setNameDraft(pageName);
		setEditingName(false);
	}

	return (
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

				{/* 画布工具簇 —— 撤销/重做、自动排列、对齐辅助线、快捷键 */}
				<div className="relative flex shrink-0 items-center gap-0.5">
					<IconButton
						size="xs"
						icon="icon-[lucide--undo-2]"
						title="撤销（⌘Z）"
						disabled={!canUndo}
						onClick={onUndo}
					/>
					<IconButton
						size="xs"
						icon="icon-[lucide--redo-2]"
						title="重做（⇧⌘Z）"
						disabled={!canRedo}
						onClick={onRedo}
					/>
					<span className="mx-1 h-5 w-px shrink-0 bg-border" />
					<IconButton
						size="xs"
						icon="icon-[lucide--layout-grid]"
						active={arrangeOpen}
						title="自动排列（垂直 / 水平 / 网格）"
						onClick={() => setArrangeOpen((v) => !v)}
					/>
					<IconButton
						size="xs"
						icon={guidesOn ? "icon-[lucide--ruler]" : "icon-[lucide--eye-off]"}
						active={guidesOn}
						title={guidesOn ? "对齐辅助线：开（点击关闭）" : "对齐辅助线：关（点击打开）"}
						onClick={onGuidesToggle}
					/>
					<IconButton
						size="xs"
						icon="icon-[lucide--keyboard]"
						title="键盘快捷键（⌘/）"
						onClick={() => setShortcutsOpen(true)}
					/>

					{arrangeOpen ? (
						<>
							<div className="fixed inset-0 z-20" onPointerDown={() => setArrangeOpen(false)} />
							<div
								role="menu"
								className="absolute top-[30px] left-0 z-30 w-[164px] overflow-hidden rounded-card border border-border bg-surface-raised py-1 shadow-popover"
							>
								{ARRANGE_LAYOUTS.map((o) => (
									<button
										key={o.layout}
										type="button"
										role="menuitem"
										className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-surface-foreground hover:bg-neutral-muted"
										onClick={() => { onArrange?.(o.layout); setArrangeOpen(false); }}
									>
										<Icon name={o.icon} className="size-3.5 shrink-0 text-muted" />
										<span>{o.label}</span>
									</button>
								))}
							</div>
						</>
					) : null}
				</div>

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

				{shortcutsOpen ? <ShortcutsDialog onClose={() => setShortcutsOpen(false)} /> : null}
			</div>
	);
}
