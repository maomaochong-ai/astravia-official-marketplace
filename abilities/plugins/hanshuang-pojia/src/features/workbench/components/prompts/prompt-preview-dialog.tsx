/**
 * 提示词预览：先看渲染后的正文，再决定要不要读原文。
 *
 * 提示词库里的条目本质上是一段 Markdown（系统契约更是如此：标题、表格、代码块成段出现）。
 * 以前点开只能进编辑器的 textarea，满屏星号与竖线——那不像「看内容」，像在看配置。
 * 这里把「预览 / 原文」做成一个两档开关，默认预览；原文仍在，需要逐字核对时切过去。
 */

import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NotifyVariant } from "../../bridge";
import type { PromptItem } from "../../../../domain/prompt-library";
import { estimateTokens } from "../../../../domain/prompt-library";
import { Icon } from "../shell/icon";
import { Markdown } from "../shell/markdown";
import { SegmentedControl } from "../shell/segmented-control";

export interface PromptPreviewDialogProps {
	open: boolean;
	prompt: PromptItem | null;
	onClose(): void;
	onEdit?(): void;
	notify?(message: string, variant?: NotifyVariant): void;
}

type View = "preview" | "raw";

export function PromptPreviewDialog({ open, prompt, onClose, onEdit, notify }: PromptPreviewDialogProps) {
	const { t } = useTranslation();
	// 换一条提示词就回到「预览」：上一条停在原文，不代表这一条也要看原文。
	const [view, setView] = useState<View>("preview");
	const [lastId, setLastId] = useState<string | null>(null);
	if (prompt && prompt.id !== lastId) {
		setLastId(prompt.id);
		setView("preview");
	}

	if (!open || !prompt) return null;

	const copy = () => {
		navigator.clipboard?.writeText(prompt.content).then(
			() => notify?.(t("prompt.preview.copied"), "success"),
			() => notify?.(t("panel.action.copyFailed"), "error"),
		);
	};

	return (
		<div className="fb-overlay" onClick={onClose}>
			<div
				className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-subtle"
				onClick={event => event.stopPropagation()}
				data-testid="prompt-preview-dialog"
			>
				<div className="flex shrink-0 flex-wrap items-start gap-3 border-b border-line-subtle px-4 py-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							{prompt.active ? (
								<span className="rounded-full bg-purple/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-purple">
									{t("prompt.active")}
								</span>
							) : null}
							<h2 className="min-w-0 truncate text-[14px] font-semibold text-text">{prompt.name}</h2>
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-text-4">
							<span className="rounded bg-surface-3 px-1.5 py-0.5">{t(`prompt.mode.${prompt.mode}`)}</span>
							<span>{t("prompt.editor.tokens", { count: estimateTokens(prompt.content) })}</span>
							<span className="font-mono">{prompt.content.length} chars</span>
						</div>
					</div>
					<SegmentedControl<View>
						size="sm"
						value={view}
						onValueChange={setView}
						ariaLabel={t("prompt.preview.view")}
						items={[
							{ value: "preview", label: t("prompt.preview.rendered") },
							{ value: "raw", label: t("prompt.preview.raw") },
						]}
					/>
					<button type="button" onClick={onClose} className="text-text-4 hover:text-text" aria-label={t("common.close")}>
						<Icon name="close" className="size-4" />
					</button>
				</div>

				<div className="fb-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
					{view === "preview" ? (
						<Markdown source={prompt.content} />
					) : (
						<pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-text-2">{prompt.content}</pre>
					)}
				</div>

				<div className="flex shrink-0 items-center justify-end gap-2 border-t border-line-subtle px-4 py-3">
					<button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] text-text-3 hover:text-text">
						<Icon name="copy" className="size-3.5" />
						{t("prompt.preview.copy")}
					</button>
					{onEdit ? (
						<button type="button" onClick={onEdit} className="rounded-md px-3 py-1.5 text-[12px] text-text-2 hover:bg-surface-hover hover:text-text">
							{t("common.edit")}
						</button>
					) : null}
					<button type="button" onClick={onClose} className="rounded-md bg-text px-3 py-1.5 text-[12px] font-medium text-surface">
						{t("common.close")}
					</button>
				</div>
			</div>
		</div>
	);
}
