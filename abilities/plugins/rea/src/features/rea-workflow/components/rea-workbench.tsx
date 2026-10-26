/**
 * 交接作曲器（展示层）：目标路径 / URL → 交给 Agent。
 *
 * 现在它是左栏卡片里的正文，不再自己吸在底部 —— 外壳把「发送」提到了顶栏，
 * 页内再钉一条 sticky 只会让窄面板同时出现两条几乎一样的动作区。
 *
 * 回执占一行固定高度，出现 / 消失不顶动上方内容。
 * 目标类型选择不在这里（在同一页的目标卡里），工具就绪也不在这里（在「工具就绪」页）。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { TargetKind } from "../data/targets";
import type { Workbench } from "../hooks/use-workbench";
import { copyText } from "../../../shared/services/clipboard";
import { ReaUsageExamples } from "./rea-usage-examples";

interface WorkbenchProps {
	readonly workbench: Workbench;
	readonly detected: TargetKind | null;
}

const FEEDBACK_TEXT: Record<Exclude<Workbench["handoff"], "idle">, string> = {
	sending: "tab.workbench.sending",
	sent: "tab.workbench.sent",
	queued: "tab.workbench.queued",
	unverified: "tab.workbench.unverified",
	noConversation: "tab.workbench.noConversation",
	inserted: "tab.workbench.inserted",
	failed: "tab.workbench.handoffFailed",
};

const BLOCK_TEXT: Record<Exclude<NonNullable<Workbench["blockReason"]>, "sending">, string> = {
	empty: "tab.workbench.targetRequired",
	noKind: "tab.workbench.kindUnknown",
};

export function ReaWorkbench({ workbench, detected }: WorkbenchProps): JSX.Element {
	const { t } = useTranslation();
	const [examplesOpen, setExamplesOpen] = useState(false);
	const canHandoff = workbench.blockReason === null;
	const blockReason = workbench.blockReason;
	const feedback = workbench.handoff;
	const tone =
		feedback === "sent" || feedback === "inserted"
			? "text-risk-low"
			: feedback === "queued"
				? "text-purple-ink"
				: feedback === "failed" || feedback === "noConversation"
					? "text-risk-high"
					: feedback === "unverified"
						? "text-risk-medium"
						: "text-text-4";

	return (
		<div className="flex flex-col px-4 py-3">
			<label className="mb-1 block text-micro font-medium text-text-3" htmlFor="rea-target-input">
				{t("tab.workbench.targetLabel")}
			</label>
			<div className="flex min-w-0 items-center gap-1.5">
				<input
					id="rea-target-input"
					type="text"
					value={workbench.target}
					onChange={(event) => workbench.setTarget(event.target.value)}
					onKeyDown={(event) => {
						if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
						event.preventDefault();
						if (canHandoff) workbench.handoffToAgent();
					}}
					placeholder={t("tab.workbench.targetPlaceholder")}
					spellCheck={false}
					autoComplete="off"
					title={workbench.target}
					className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface-3 px-2.5 font-mono text-caption text-text transition-colors placeholder:text-text-4 focus-visible:border-purple/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
				/>
				<button
					type="button"
					onClick={() => setExamplesOpen((prev) => !prev)}
					aria-expanded={examplesOpen}
					title={t(examplesOpen ? "tab.examples.close" : "tab.examples.openHint")}
					className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-3 text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span aria-hidden className="icon-[lucide--sparkles] size-3.5" />
					<span className="sr-only">{t("tab.examples.button")}</span>
				</button>
			</div>

			<div className="mt-2 flex min-w-0 items-center gap-1.5">
				<button
					type="button"
					onClick={() => workbench.handoffToAgent()}
					disabled={!canHandoff || feedback === "sending"}
					title={t("tab.workbench.handoffHint")}
					className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-caption font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-45"
				>
					{feedback === "sending" ? (
						<span aria-hidden className="icon-[lucide--loader-circle] size-3.5 motion-safe:animate-spin" />
					) : (
						<span aria-hidden className="icon-[lucide--send] size-3.5" />
					)}
					<span className="truncate">{t("tab.workbench.handoff")}</span>
				</button>
				<button
					type="button"
					onClick={() => workbench.insertToChat()}
					disabled={!canHandoff}
					title={t("tab.workbench.insertHint")}
					className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-surface-3 px-2.5 text-caption font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-45"
				>
					<span aria-hidden className="icon-[lucide--text-cursor-input] size-3.5" />
					<span className="@max-[400px]:hidden">{t("tab.workbench.insert")}</span>
				</button>
			</div>

			{/* 固定高度：回执出现 / 消失不再顶走上面的内容。 */}
			<div className="mt-1.5 flex h-4 min-w-0 items-center gap-1.5">
				{feedback !== "idle" ? (
					<span className={`min-w-0 truncate text-micro leading-none ${tone}`} title={t(FEEDBACK_TEXT[feedback])}>
						{t(FEEDBACK_TEXT[feedback])}
					</span>
				) : (
					<span
						className={`min-w-0 truncate text-micro leading-none ${blockReason === null ? "text-text-4" : "text-risk-medium"}`}
						title={blockReason === null ? undefined : t(BLOCK_TEXT[blockReason as keyof typeof BLOCK_TEXT])}
					>
						{blockReason === null ? t("tab.workbench.ready") : t(BLOCK_TEXT[blockReason as keyof typeof BLOCK_TEXT])}
					</span>
				)}
				{/* 回执不可信时给两条真人可用的退路：重新发一次，或自己决定何时发。 */}
				{feedback === "noConversation" ? (
					<button
						type="button"
						onClick={() => workbench.handoffToAgent()}
						className="inline-flex h-4 shrink-0 items-center gap-1 rounded-sm border border-border px-1.5 text-micro leading-none text-text-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className="icon-[lucide--rotate-cw] size-2.5" />
						{t("tab.workbench.retry")}
					</button>
				) : null}
				{feedback === "unverified" ? (
					<button
						type="button"
						onClick={() => workbench.insertToChat()}
						className="inline-flex h-4 shrink-0 items-center gap-1 rounded-sm border border-border px-1.5 text-micro leading-none text-text-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className="icon-[lucide--text-cursor-input] size-2.5" />
						{t("tab.workbench.insert")}
					</button>
				) : null}
				{feedback === "failed" || feedback === "unverified" || feedback === "noConversation" ? (
					workbench.promptText.length > 0 ? (
						<button
							type="button"
							onClick={() => void copyText(workbench.promptText)}
							className="inline-flex h-4 shrink-0 items-center gap-1 rounded-sm border border-border px-1.5 text-micro leading-none text-text-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--copy] size-2.5" />
							{t("tab.workbench.copyPrompt")}
						</button>
					) : null
				) : null}
			</div>

			{examplesOpen ? (
				<ReaUsageExamples
					target={workbench.target}
					targetKind={workbench.active ?? detected}
					onClose={() => setExamplesOpen(false)}
				/>
			) : null}
		</div>
	);
}
