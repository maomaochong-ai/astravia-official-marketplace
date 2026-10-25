/**
 * 交接作曲器（展示层）：目标路径/URL → 交给 Agent。
 *
 * 它钉在内容区底部：阶段详情再长也不会把「怎么把任务发出去」推到视野之外。
 * 目标类型选择不在这里（在主区顶部），工具就绪也不在这里（在右栏），
 * 这个区块只回答一个问题：这段任务怎么真正发进对话。
 *
 * 回执占一行固定高度，出现/消失不再顶动上方内容。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { TargetKind } from "../data/targets";
import type { Workbench } from "../hooks/use-workbench";
import { copyText } from "../../../shared/services/clipboard";
import { Eyebrow } from "../../../shared/components/eyebrow";
import { ReaUsageExamples } from "./rea-usage-examples";

interface WorkbenchProps {
	readonly workbench: Workbench;
	readonly detected: TargetKind | null;
}

const FEEDBACK_TEXT: Record<Exclude<Workbench["handoff"], "idle">, string> = {
	sending: "tab.workbench.sending",
	sent: "tab.workbench.sent",
	queued: "tab.workbench.queued",
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
			? "text-sage-dark"
			: feedback === "queued"
				? "text-primary"
				: feedback === "failed"
					? "text-danger"
					: "text-faint";

	return (
		<section className="rea-root sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 py-2.5 backdrop-blur">
			<div className="flex min-w-0 items-center gap-1.5">
				<Eyebrow className="hidden shrink-0 font-mono @min-[380px]:inline" title={t("tab.workbench.targetLabel")}>
					{t("tab.workbench.targetTag")}
				</Eyebrow>
				<label className="sr-only" htmlFor="rea-target-input">
					{t("tab.workbench.targetLabel")}
				</label>
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
					className="h-8 min-w-0 flex-1 rounded-control border border-border bg-background px-2.5 font-mono text-caption text-foreground transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
				/>
				<button
					type="button"
					onClick={() => workbench.insertToChat()}
					disabled={!canHandoff}
					title={t("tab.workbench.insertHint")}
					className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control border border-border px-2 text-caption font-medium text-foreground/85 transition-colors hover:border-border-strong hover:bg-mist hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-faint"
				>
					<span aria-hidden className="icon-[lucide--text-cursor-input] size-3.5" />
					<span className="@max-[360px]:hidden">{t("tab.workbench.insert")}</span>
				</button>
				<button
					type="button"
					onClick={() => workbench.handoffToAgent()}
					disabled={!canHandoff || feedback === "sending"}
					title={
						blockReason === "noKind"
							? t("tab.workbench.kindUnknown")
							: blockReason === "empty"
								? t("tab.workbench.targetRequired")
								: t("tab.workbench.handoffHint")
					}
					className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-primary px-3 text-caption font-semibold text-primary-foreground shadow-card transition-[filter,opacity] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:bg-mist disabled:text-faint disabled:shadow-none"
				>
					{feedback === "sending" ? (
						<span aria-hidden className="icon-[lucide--loader-circle] size-3.5 motion-safe:animate-spin" />
					) : (
						<span aria-hidden className="icon-[lucide--send] size-3.5" />
					)}
					<span className="@max-[400px]:hidden">{t("tab.workbench.handoff")}</span>
				</button>
				<button
					type="button"
					onClick={() => setExamplesOpen((prev) => !prev)}
					aria-expanded={examplesOpen}
					title={t(examplesOpen ? "tab.examples.close" : "tab.examples.openHint")}
					className="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-foreground/80 transition-colors hover:border-border-strong hover:bg-mist hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span aria-hidden className="icon-[lucide--sparkles] size-3.5" />
					<span className="sr-only">{t("tab.examples.button")}</span>
				</button>
			</div>

			{/* 固定高度：回执出现/消失不再顶走上面的内容。 */}
			<div className="mt-1 flex h-4 min-w-0 items-center gap-1.5">
				{feedback !== "idle" ? (
					<span className={`min-w-0 truncate text-micro-up leading-none ${tone}`} title={t(FEEDBACK_TEXT[feedback])}>
						{t(FEEDBACK_TEXT[feedback])}
					</span>
				) : (
					<span
						className={`min-w-0 truncate text-micro-up leading-none ${blockReason === null ? "text-faint" : "text-ochre"}`}
						title={blockReason === null ? undefined : t(BLOCK_TEXT[blockReason as keyof typeof BLOCK_TEXT])}
					>
						{blockReason === null ? t("tab.workbench.ready") : t(BLOCK_TEXT[blockReason as keyof typeof BLOCK_TEXT])}
					</span>
				)}
				{feedback === "failed" && workbench.promptText.length > 0 ? (
					<button
						type="button"
						onClick={() => void copyText(workbench.promptText)}
						className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-border px-1.5 text-micro-up text-foreground/85 transition-colors hover:border-border-strong hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className="icon-[lucide--copy] size-2.5" />
						{t("tab.workbench.copyPrompt")}
					</button>
				) : null}
			</div>

			{examplesOpen ? (
				<ReaUsageExamples
					target={workbench.target}
					targetKind={workbench.active ?? detected}
					onClose={() => setExamplesOpen(false)}
				/>
			) : null}
		</section>
	);
}
