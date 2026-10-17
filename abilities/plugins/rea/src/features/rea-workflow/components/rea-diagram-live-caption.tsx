/**
 * 流程图标题行的实时说明：把「这张图现在处于什么状态」讲清楚。
 *
 * 只陈述能从会话里读到的事实：本阶段的真实调用次数、此刻正在跑的工具、
 * 最近一次工具与参数预览、失败次数。没有活动时明确写"等待真实调用"，
 * 而不是让示意图显得像是已经在跑。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import type { StageLiveDigest } from "../live/diagram-live";

interface CaptionProps {
	readonly digest: StageLiveDigest;
}

export function ReaDiagramLiveCaption({ digest }: CaptionProps): JSX.Element {
	const { t } = useTranslation();
	const running = digest.running[0] ?? null;
	const idle = digest.state === "idle";
	return (
		<div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-none text-muted-foreground">
			<StatusChip
				tone={digest.state === "active" ? "progress" : digest.state === "done" ? "success" : "neutral"}
				className="normal-case tracking-normal"
			>
				<span
					className={`size-1.5 rounded-full bg-current ${digest.state === "active" ? "motion-safe:animate-pulse" : ""}`}
					aria-hidden
				/>
				{t(`tab.live.stage.${digest.state}`)}
			</StatusChip>
			{digest.calls > 0 ? (
				<span className="shrink-0 tabular-nums">{t("tab.live.stage.calls", { count: digest.calls })}</span>
			) : null}
			{running ? (
				<span className="flex min-w-0 flex-1 items-center gap-1">
					<span className="shrink-0 text-primary">{t("tab.live.diagram.running")}</span>
					<code className="min-w-0 truncate font-mono text-foreground/85" title={running}>
						{running}
					</code>
				</span>
			) : digest.lastTool ? (
				<span className="flex min-w-0 flex-1 items-center gap-1">
					<span className="shrink-0">{t("tab.live.diagram.last")}</span>
					<code className="min-w-0 truncate font-mono text-foreground/85" title={digest.lastTool}>
						{digest.lastTool}
					</code>
				</span>
			) : idle ? (
				<span className="min-w-0 flex-1 truncate">{t("tab.live.diagram.idle")}</span>
			) : null}
			{digest.errors > 0 ? (
				<StatusChip tone="danger" className="normal-case tracking-normal">
					{t("tab.live.diagram.failed", { count: digest.errors })}
				</StatusChip>
			) : null}
		</div>
	);
}
