/**
 * 提示词卡片：名称、摘要、当前生效标记与操作入口。
 *
 * 纯展示 + 回调，不自己读写存储；状态与副作用都在 `use-prompt-library`。
 *
 * 卡面本身可以点：提示词是一段给人看的文字，点开应当先看到渲染后的样子，
 * 而不是先看到一份要滚动的原文。原文仍在预览窗里，一键切换。
 *
 * 三个交互约定：
 *   · 「停用」会让注入正文回落成默认契约，所以它要一次确认 —— 这个后果不在卡片上写出来，
 *     用户会以为只是取消一个标记。
 *   · 「删除」的确认由页面持有（同一时刻只武装一张卡，5 秒收回），卡上只负责显示状态。
 *   · 搜索只在正文命中时给一段 snippet：否则用户看到一张没有关键词的卡，会以为搜索坏了。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { PromptItem } from "../../../../domain/prompt-library";
import { estimateTokens } from "../../../../domain/prompt-library";
import { Icon } from "../shell/icon";

export interface PromptCardProps {
	prompt: PromptItem;
	/** 正文命中时的一段上下文；命中在名称/描述时为 null。 */
	snippet?: string | null;
	/** 删除已被武装：按钮显示「确认删除」，再点一次才真删。 */
	deleteArmed?: boolean;
	onActivate(): void;
	onDeactivate(): void;
	onPreview(): void;
	onEdit(): void;
	onDelete(): void;
	onShowBackups(): void;
}

function formatTime(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleDateString();
}

/** 单条提示词卡片：名称、描述、token 数、操作按钮。 */
export function PromptCard({
	prompt,
	snippet = null,
	deleteArmed = false,
	onActivate,
	onDeactivate,
	onPreview,
	onEdit,
	onDelete,
	onShowBackups,
}: PromptCardProps) {
	const { t } = useTranslation();
	const tokens = estimateTokens(prompt.content);
	// 停用会改变注入内容，所以这一步需要确认；确认状态留在卡上，因为后果只关乎这一张卡。
	const [confirmStop, setConfirmStop] = useState(false);

	return (
		<article
			className={`min-w-0 rounded-lg border p-3.5 transition-colors ${
				prompt.active ? "border-purple/50 bg-purple/5" : "border-line-subtle bg-surface-2 hover:border-line-strong"
			}`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-1.5">
						{prompt.active ? (
							<span className="shrink-0 rounded-full bg-purple/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-purple">
								{t("prompt.active")}
							</span>
						) : null}
						{/* 标题即预览入口：点开先看渲染后的正文。 */}
						<button
							type="button"
							onClick={onPreview}
							title={`${prompt.name} · ${t("prompt.card.openHint")}`}
							className="fb-wrap min-w-0 text-left font-medium text-text"
						>
							{prompt.name}
						</button>
					</div>
					{prompt.description ? (
						<p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-text-3" title={prompt.description}>
							{prompt.description}
						</p>
					) : null}
					{snippet ? (
						// 正文命中：把关键词的上下文摊出来，并标明它是正文里的，不是标题里的。
						<p className="mt-1 line-clamp-2 rounded bg-surface-3/60 px-1.5 py-1 text-[10.5px] leading-snug text-text-3">
							<span className="me-1 font-mono text-[9.5px] uppercase tracking-wide text-text-4">{t("prompt.search.inBody")}</span>
							{snippet}
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						onClick={onPreview}
						title={t("prompt.card.preview")}
						aria-label={t("prompt.card.preview")}
						className="rounded-md p-1 text-text-3 transition-colors hover:bg-surface-3 hover:text-text"
					>
						<Icon name="eye" className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => (prompt.active ? setConfirmStop(true) : onActivate())}
						className={`rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors ${
							prompt.active ? "bg-surface-3 text-text-3 hover:text-text" : "bg-text text-surface hover:opacity-90"
						}`}
					>
						{prompt.active ? t("prompt.deactivate") : t("prompt.activate")}
					</button>
				</div>
			</div>

			{confirmStop ? (
				// 停用的真实后果：注入正文换成默认契约。这一步必须说出来，否则用户以为只是取消标记。
				<div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-surface-3/70 px-2 py-1.5">
					<span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{t("prompt.deactivateHint")}</span>
					<button
						type="button"
						onClick={() => {
							setConfirmStop(false);
							onDeactivate();
						}}
						className="rounded-md bg-text px-1.5 py-0.5 text-[10.5px] font-medium text-surface"
					>
						{t("prompt.deactivateConfirm")}
					</button>
					<button
						type="button"
						onClick={() => setConfirmStop(false)}
						className="rounded-md px-1.5 py-0.5 text-[10.5px] text-text-3 hover:text-text"
					>
						{t("common.cancel")}
					</button>
				</div>
			) : null}

			<div className="mt-2.5 flex items-center gap-3 text-[10.5px] text-text-4">
				<span className="rounded bg-surface-3 px-1.5 py-0.5">{t(`prompt.mode.${prompt.mode}`)}</span>
				<span>{t("prompt.editor.tokens", { count: tokens })}</span>
				<span>{formatTime(prompt.updatedAt)}</span>
			</div>

			<div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-line-subtle pt-2">
				<button type="button" onClick={onEdit} className="rounded-md px-2 py-1 text-[10.5px] text-text-3 hover:bg-surface-3 hover:text-text">
					{t("common.edit")}
				</button>
				<button type="button" onClick={onShowBackups} className="rounded-md px-2 py-1 text-[10.5px] text-text-3 hover:bg-surface-3 hover:text-text">
					{t("prompt.backup.manage")}
				</button>
				<button
					type="button"
					onClick={onDelete}
					aria-pressed={deleteArmed}
					title={t("prompt.deleteConfirm")}
					className={`ms-auto rounded-md px-2 py-1 text-[10.5px] transition-colors ${
						deleteArmed ? "bg-risk-high/12 text-risk-high ring-1 ring-risk-high/40" : "text-text-4 hover:bg-risk-high/10 hover:text-risk-high"
					}`}
				>
					{deleteArmed ? t("prompt.deleteArmed") : t("common.delete")}
				</button>
			</div>
		</article>
	);
}
