import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useMemo, useState } from "react";

/**
 * 发送前确认：把要投进宿主对话的那段文字先摆出来，允许改完再发。
 *
 * 为什么要这一层：面板里所有「发到对话」的按钮都发一段**拼好的**指令。拼错了、或者想让它
 * 多带一句上下文，用户此前只能发出去之后再在宿主里改——那已经是另一条消息了。
 *
 * 两条约束：
 *  1. **初值来自同一个 `buildPrompt`。** 不编辑时发出去的东西必须和以前逐字相同，否则
 *     「预览」就成了第二套文案。
 *  2. **空文本不发。** 清空后按发送等于往对话里塞一条空消息，宿主那边看不出区别。
 */
export interface SendPromptDialogProps {
	open: boolean;
	/** 初值：由 model.previewPrompt(...) 生成。 */
	initial: string;
	/** 这一条是干什么的（显示在标题右侧，帮用户确认自己没点错）。 */
	label?: string;
	onClose(): void;
	onSend(text: string): void;
}

export function SendPromptDialog({ open, initial, label, onClose, onSend }: SendPromptDialogProps) {
	const { t } = useTranslation();
	const [text, setText] = useState(initial);

	// 每次打开都用新的初值：上一次编辑不该漏到下一次发送。
	useEffect(() => {
		if (open) setText(initial);
	}, [open, initial]);

	const trimmed = useMemo(() => text.trim(), [text]);
	const dirty = trimmed !== initial.trim();

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
			<div className="flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-subtle">
				<header className="flex shrink-0 items-center gap-2 border-b border-line-subtle px-4 py-2.5">
					<h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{t("chat.preview.title")}</h2>
					{label ? <span className="shrink-0 text-[11px] text-text-4">{label}</span> : null}
				</header>

				<div className="min-h-0 flex-1 p-4">
					<textarea
						value={text}
						onChange={event => setText(event.target.value)}
						spellCheck={false}
						rows={10}
						aria-label={t("chat.preview.title")}
						className="fb-scroll h-full min-h-[8rem] w-full resize-y rounded-lg border border-line-subtle bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-text outline-none focus:border-purple"
					/>
					<p className="mt-1.5 text-[11px] text-text-4">
						{t(dirty ? "chat.preview.edited" : "chat.preview.verbatim")}
						<span className="ml-2 tabular-nums">{t("chat.preview.size", { count: trimmed.length })}</span>
					</p>
				</div>

				<footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line-subtle px-4 py-2.5">
					<button
						type="button"
						onClick={onClose}
						className="rounded-md border border-line-subtle px-3 py-1.5 text-[11.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						{t("common.cancel")}
					</button>
					<button
						type="button"
						disabled={trimmed.length === 0}
						onClick={() => {
							onSend(trimmed);
							onClose();
						}}
						className="rounded-md bg-text px-3 py-1.5 text-[11.5px] font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{t("chat.preview.send")}
					</button>
				</footer>
			</div>
		</div>
	);
}
