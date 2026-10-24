import { useEffect, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { buildHandoffPrompt, type HandoffTarget } from "../../services/sample-handoff";
import { AiButton } from "../shell/ai-button";

export interface HandoffDialogProps {
	open: boolean;
	/** 要交给宿主 Agent 的样本；null 时对话框不渲染内容。 */
	target: HandoffTarget | null;
	busy: boolean;
	onClose(): void;
	onSend(prompt: string): void;
}

/**
 * 「交给宿主 Agent」的确认框：预填一段中文提示词，用户改完再发。
 *
 * 不直接发是刻意的——样本路径、大小、想先看什么，只有用户知道；
 * 一个不可编辑的按钮会把这个上下文锁死在插件里。
 */
export function HandoffDialog({ open, target, busy, onClose, onSend }: HandoffDialogProps) {
	const { t } = useTranslation();
	const [prompt, setPrompt] = useState("");

	useEffect(() => {
		if (open && target) setPrompt(buildHandoffPrompt(target));
	}, [open, target]);

	if (!open || !target) return null;

	const canSend = prompt.trim().length > 0 && !busy;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
			<div
				className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-line bg-surface-2"
				onClick={event => event.stopPropagation()}
				data-testid="handoff-dialog"
			>
				<div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
					<div className="min-w-0">
						<h2 className="text-[14px] font-semibold text-text">{t("handoff.title")}</h2>
						<p className="mt-0.5 truncate font-mono text-[10.5px] text-text-4">{target.path}</p>
					</div>
					<button type="button" onClick={onClose} className="text-text-4 hover:text-text" aria-label="close">
						✕
					</button>
				</div>

				<div className="fb-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
					<div className="flex items-center justify-between">
						<label className="text-[11.5px] font-medium text-text-2">{t("handoff.promptLabel")}</label>
						<button
							type="button"
							onClick={() => setPrompt(buildHandoffPrompt(target))}
							className="text-[10.5px] text-text-4 hover:text-text"
						>
							{t("handoff.reset")}
						</button>
					</div>
					<textarea
						value={prompt}
						onChange={event => setPrompt(event.target.value)}
						rows={12}
						aria-label={t("handoff.promptLabel")}
						className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-[12px] leading-relaxed text-text outline-none focus:border-purple"
					/>
					<p className="text-[10.5px] leading-relaxed text-text-4">{t("handoff.note")}</p>
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-line-subtle px-4 py-3">
					<button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[12px] text-text-3 hover:text-text">
						{t("common.cancel")}
					</button>
					<AiButton label={t("handoff.send")} onClick={() => onSend(prompt)} busy={busy} disabled={!canSend} />
				</div>
			</div>
		</div>
	);
}