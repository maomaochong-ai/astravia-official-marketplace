import { useEffect, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { InjectMode, PromptItem } from "../../../../domain/prompt-library";
import { estimateTokens } from "../../../../domain/prompt-library";
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

	useEffect(() => {
		if (open) {
			setForm(
				editing
					? { name: editing.name, description: editing.description, content: editing.content, mode: editing.mode }
					: EMPTY,
			);
		}
	}, [open, editing]);

	if (!open) return null;

	const tokens = estimateTokens(form.content);
	const canSubmit = form.name.trim().length > 0 && form.content.trim().length > 0;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
			<div
				className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-line bg-surface-2"
				onClick={e => e.stopPropagation()}
			>
				<div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
					<h2 className="text-[14px] font-semibold text-text">
						{editing ? t("prompt.editor.edit") : t("prompt.editor.create")}
					</h2>
					<button type="button" onClick={onClose} className="text-text-4 hover:text-text" aria-label="close">
						✕
					</button>
				</div>

				<div className="fb-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
					<div>
						<label className="mb-1 block text-[11.5px] font-medium text-text-2">{t("prompt.editor.name")}</label>
						<input
							type="text"
							value={form.name}
							onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
							placeholder={t("prompt.editor.namePlaceholder")}
							className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px] text-text outline-none focus:border-purple"
						/>
					</div>

					<div>
						<label className="mb-1 block text-[11.5px] font-medium text-text-2">{t("prompt.editor.description")}</label>
						<input
							type="text"
							value={form.description}
							onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
							placeholder={t("prompt.editor.descriptionPlaceholder")}
							className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px] text-text outline-none focus:border-purple"
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
						<div className="mb-1 flex items-center justify-between">
							<label className="text-[11.5px] font-medium text-text-2">{t("prompt.editor.content")}</label>
							<span className="text-[10px] text-text-4">{t("prompt.editor.tokens", { count: tokens })}</span>
						</div>
						<textarea
							value={form.content}
							onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
							placeholder={t("prompt.editor.contentPlaceholder")}
							rows={12}
							className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-text outline-none focus:border-purple"
						/>
					</div>
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-line-subtle px-4 py-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-md px-3 py-1.5 text-[12px] text-text-3 hover:text-text"
					>
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
