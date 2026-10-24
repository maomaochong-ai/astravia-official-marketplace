import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PromptItem } from "../../../../domain/prompt-library";
import { estimateTokens } from "../../../../domain/prompt-library";

export interface PromptCardProps {
	prompt: PromptItem;
	onActivate(): void;
	onDeactivate(): void;
	onEdit(): void;
	onDelete(): void;
	onShowBackups(): void;
}

function formatTime(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleDateString();
}

/** 单条提示词卡片：名称、描述、token 数、操作按钮。 */
export function PromptCard({ prompt, onActivate, onDeactivate, onEdit, onDelete, onShowBackups }: PromptCardProps) {
	const { t } = useTranslation();
	const tokens = estimateTokens(prompt.content);

	return (
		<article
			className={`rounded-lg border p-3.5 transition-colors ${
				prompt.active ? "border-purple/50 bg-purple/5" : "border-line bg-surface-2 hover:border-line-subtle"
			}`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5">
						{prompt.active ? (
							<span className="rounded-full bg-purple/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-purple">
								{t("prompt.active")}
							</span>
						) : null}
						<h3 className="truncate text-[13px] font-semibold text-text">{prompt.name}</h3>
					</div>
					{prompt.description ? (
						<p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-3">{prompt.description}</p>
					) : null}
				</div>
				<button
					type="button"
					onClick={prompt.active ? onDeactivate : onActivate}
					className={`shrink-0 rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors ${
						prompt.active
							? "bg-surface-3 text-text-3 hover:text-text"
							: "bg-text text-surface hover:opacity-90"
					}`}
				>
					{prompt.active ? t("prompt.deactivate") : t("prompt.activate")}
				</button>
			</div>

			<div className="mt-2.5 flex items-center gap-3 text-[10px] text-text-4">
				<span className="rounded bg-surface-3 px-1.5 py-0.5">{t(`prompt.mode.${prompt.mode}`)}</span>
				<span>{t("prompt.editor.tokens", { count: tokens })}</span>
				<span>{formatTime(prompt.updatedAt)}</span>
			</div>

			<div className="mt-2.5 flex items-center gap-1 border-t border-line-subtle pt-2">
				<button type="button" onClick={onEdit} className="rounded px-2 py-1 text-[10.5px] text-text-3 hover:bg-surface-3 hover:text-text">
					{t("common.edit")}
				</button>
				<button type="button" onClick={onShowBackups} className="rounded px-2 py-1 text-[10.5px] text-text-3 hover:bg-surface-3 hover:text-text">
					{t("prompt.backup.manage")}
				</button>
				<button type="button" onClick={onDelete} className="rounded px-2 py-1 text-[10.5px] text-text-4 hover:bg-risk-low/10 hover:text-risk-low">
					{t("common.delete")}
				</button>
			</div>
		</article>
	);
}
