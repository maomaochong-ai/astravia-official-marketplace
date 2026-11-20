/**
 * 提示词编辑对话框：改正文、看字数、保存。
 *
 * 保存前不改动原文件：真正的写入由 hook 的 `createBackup` / 保存动作完成，
 * 这样「编辑到一半关掉」不会留下半份内容。
 *
 * 关闭有两条路，都要经过 `requestClose`：
 *   · 没改过 → 直接关；
 *   · 改过 → 先问一句「丢弃修改？」。编辑器里丢掉的是用户刚打的字，误点遮罩就没了。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { InjectMode, PromptItem } from "../../../../domain/prompt-library";
import { estimateTokens } from "../../../../domain/prompt-library";
import { useDialogBehavior } from "../../hooks/use-dialog-behavior";
import { Markdown } from "../shell/markdown";
import { SegmentedControl } from "../shell/segmented-control";

export interface PromptFormData {
	name: string;
	description: string;
	content: string;
	mode: InjectMode;
}

export interface PromptEditorDialogProps {
	open: boolean;
	/** 编辑时传已有 prompt，新建时为 null。 */
	editing: PromptItem | null;
	onClose(): void;
	onSubmit(data: PromptFormData): void;
}

const EMPTY: PromptFormData = { name: "", description: "", content: "", mode: "append" };

/** 提示词的新建/编辑对话框。 */
export function PromptEditorDialog({ open, editing, onClose, onSubmit }: PromptEditorDialogProps) {
	const { t } = useTranslation();
	const [form, setForm] = useState<PromptFormData>(EMPTY);
	const [initial, setInitial] = useState<PromptFormData>(EMPTY);
	// 编辑默认仍落在原文：改字要看见字符；想看效果再切预览。
	const [view, setView] = useState<"edit" | "preview">("edit");
	const [confirmDiscard, setConfirmDiscard] = useState(false);

	const dirty =
		form.name !== initial.name ||
		form.description !== initial.description ||
		form.content !== initial.content ||
		form.mode !== initial.mode;

	const requestClose = () => {
		if (dirty) {
			setConfirmDiscard(true);
			return;
		}
		onClose();
	};

	const dialog = useDialogBehavior(open, requestClose);

	useEffect(() => {
		if (!open) return;
		const next = editing
			? { name: editing.name, description: editing.description, content: editing.content, mode: editing.mode }
			: EMPTY;
		setForm(next);
		setInitial(next);
		setView("edit");
		setConfirmDiscard(false);
	}, [open, editing]);

	if (!open) return null;

	const tokens = estimateTokens(form.content);
	const canSubmit = form.name.trim().length > 0 && form.content.trim().length > 0;

	return (
		<div className="fb-overlay" onClick={requestClose}>
			<div
				ref={dialog}
				role="dialog"
				aria-modal="true"
				aria-label={editing ? t("prompt.editor.edit") : t("prompt.editor.create")}
				tabIndex={-1}
				className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-subtle outline-none"
				onClick={e => e.stopPropagation()}
			>
				<div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
					<h2 className="text-[14px] font-semibold text-text">{editing ? t("prompt.editor.edit") : t("prompt.editor.create")}</h2>
					<button
						type="button"
						onClick={requestClose}
						className="text-text-4 hover:text-text"
						aria-label={t("common.close")}
					>
						✕
					</button>
				</div>

				{confirmDiscard ? (
					// 内联确认而不是原生 confirm：原生对话框会阻断渲染进程，样式也跟不了主题。
					<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line-subtle bg-risk-medium/8 px-4 py-2">
						<span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-text-3">{t("prompt.editor.dirty")}</span>
						<button
							type="button"
							onClick={onClose}
							className="rounded-md bg-risk-high px-2 py-0.5 text-[10.5px] font-medium text-surface"
						>
							{t("prompt.editor.discard")}
						</button>
						<button
							type="button"
							onClick={() => setConfirmDiscard(false)}
							className="rounded-md px-2 py-0.5 text-[10.5px] text-text-3 hover:text-text"
						>
							{t("prompt.editor.keepEditing")}
						</button>
					</div>
				) : null}

				<div className="fb-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
					<div>
						<label className="mb-1 block text-[11.5px] font-medium text-text-2">{t("prompt.editor.name")}</label>
						<input
							type="text"
							value={form.name}
							onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
							placeholder={t("prompt.editor.namePlaceholder")}
							className="w-full rounded-md border border-line-subtle bg-surface px-3 py-1.5 text-[12px] text-text outline-none focus:border-accent"
						/>
					</div>

					<div>
						<label className="mb-1 block text-[11.5px] font-medium text-text-2">{t("prompt.editor.description")}</label>
						<input
							type="text"
							value={form.description}
							onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
							placeholder={t("prompt.editor.descriptionPlaceholder")}
							className="w-full rounded-md border border-line-subtle bg-surface px-3 py-1.5 text-[12px] text-text outline-none focus:border-accent"
						/>
					</div>

					<div>
						<label className="mb-1 block text-[11.5px] font-medium text-text-2">{t("prompt.editor.mode")}</label>
						<SegmentedControl<InjectMode>
							value={form.mode}
							onValueChange={mode => setForm(f => ({ ...f, mode }))}
							items={[
								{ value: "append", label: t("prompt.mode.append") },
								{ value: "prepend", label: t("prompt.mode.prepend") },
								{ value: "override", label: t("prompt.mode.override") },
							]}
						/>
						<p className="mt-1 text-[10.5px] text-text-4">{t(`prompt.modeHint.${form.mode}`)}</p>
					</div>

					<div>
						<div className="mb-1 flex items-center justify-between gap-2">
							<label className="text-[11.5px] font-medium text-text-2">{t("prompt.editor.content")}</label>
							<div className="flex items-center gap-2">
								<span className="text-[10.5px] text-text-4">{t("prompt.editor.tokens", { count: tokens })}</span>
								<SegmentedControl<"edit" | "preview">
									size="sm"
									value={view}
									onValueChange={setView}
									ariaLabel={t("prompt.preview.view")}
									items={[
										{ value: "edit", label: t("prompt.preview.raw") },
										{ value: "preview", label: t("prompt.preview.rendered") },
									]}
								/>
							</div>
						</div>
						{view === "preview" ? (
							// 预览高度对齐 textarea 的 12 行：切来切去时弹窗不会跳。
							<div className="fb-scroll min-h-[17.5rem] overflow-y-auto rounded-md border border-line-subtle bg-surface px-3 py-2">
								{form.content.trim() ? <Markdown source={form.content} /> : <p className="text-[11.5px] text-text-4">{t("prompt.preview.empty")}</p>}
							</div>
						) : (
							<textarea
								value={form.content}
								onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
								placeholder={t("prompt.editor.contentPlaceholder")}
								rows={12}
								className="w-full resize-y rounded-md border border-line-subtle bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-text outline-none focus:border-accent"
							/>
						)}
					</div>
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-line-subtle px-4 py-3">
					<button type="button" onClick={requestClose} className="rounded-md px-3 py-1.5 text-[12px] text-text-3 hover:text-text">
						{t("common.cancel")}
					</button>
					<button
						type="button"
						disabled={!canSubmit}
						onClick={() => onSubmit(form)}
						className="rounded-md bg-text px-3 py-1.5 text-[12px] font-medium text-surface disabled:opacity-40"
					>
						{editing ? t("common.save") : t("common.create")}
					</button>
				</div>
			</div>
		</div>
	);
}
