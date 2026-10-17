/**
 * 「Agent 侧动作」清单里的一行：工具名 + 本会话真实调用情况。
 *
 * 状态来自 session-store 的真实调用记录，没有记录就写「未调用」——
 * 这里只是把已经发生的事摊开，不代表这个工具「应该」被调过。
 * 入口工具（该目标类型在 Route 阶段的第一把刀）标 `ENTRY`。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { AgentAction } from "../live/agent-actions";

interface RowProps {
	readonly action: AgentAction;
}

const STATE_CLASS: Record<AgentAction["state"], string> = {
	active: "border-primary/60 text-primary",
	hit: "border-border text-foreground/80",
	failed: "border-red-500/50 text-red-600 dark:text-red-400",
	idle: "border-border/70 text-muted-foreground",
};

export function ReaAgentActionRow({ action }: RowProps): JSX.Element {
	const { t } = useTranslation();
	const status =
		action.state === "active"
			? t("tab.detail.action.running")
			: action.state === "failed"
				? t("tab.detail.action.failed", { calls: action.calls, errors: action.errors })
				: action.state === "hit"
					? t("tab.detail.action.calls", { calls: action.calls })
					: t("tab.detail.action.idle");
	return (
		<li className="flex min-w-0 items-center gap-1.5">
			<code
				className={`inline-block min-w-0 max-w-[190px] truncate rounded border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] ${STATE_CLASS[action.state]}`}
				title={action.name}
			>
				{action.name}
			</code>
			{action.entry ? (
				<span
					className="shrink-0 rounded-[2px] bg-primary/15 px-1 py-px font-mono text-[8.5px] uppercase leading-tight tracking-[0.06em] text-primary"
					title={t("tab.detail.action.entryHint")}
				>
					{t("tab.detail.action.entry")}
				</span>
			) : null}
			<span className="min-w-0 shrink-0 text-[9.5px] leading-tight tabular-nums text-muted-foreground" title={status}>
				{status}
			</span>
		</li>
	);
}
