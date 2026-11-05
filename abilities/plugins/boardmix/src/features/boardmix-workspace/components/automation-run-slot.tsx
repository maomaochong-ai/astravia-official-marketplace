import type { PluginToolCallSlotProps } from "@astravia-org/plugin-sdk";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { newerRun, readAutomationRun, type AutomationRun } from "../../../domain/boardmix-run";
import { getRuntime } from "../../../runtime-contract";
import { useAutomationRun } from "../hooks/use-automation-run";
import { AutomationTimeline } from "./automation-timeline";

/** 工具自己的返回体就是一份运行记录（多了 ok / next 两个字段），直接读回来。 */
function runFromToolResult(result: unknown): AutomationRun | null {
	if (typeof result !== "string") return null;
	const text = result.trim();
	if (!text.startsWith("{")) return null;
	try {
		return readAutomationRun(JSON.parse(text));
	} catch {
		return null;
	}
}

/**
 * `boardmix_automate` 在对话里显示成一条步骤时间线，而不是一段 JSON。
 * 实时状态与面板共用一个 `useAutomationRun`；读不到实时状态就退到工具返回体。
 */
export function AutomationRunSlot({ toolCall }: PluginToolCallSlotProps) {
	const { t } = useTranslation();
	const live = useAutomationRun(getRuntime());
	const run = newerRun(live, runFromToolResult(toolCall.result));

	if (!run) {
		return (
			<div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
				{t("run.title")}
			</div>
		);
	}

	return (
		<div className="rounded-md border border-border bg-background px-3 py-2">
			<AutomationTimeline run={run} translate={key => t(key)} />
		</div>
	);
}
