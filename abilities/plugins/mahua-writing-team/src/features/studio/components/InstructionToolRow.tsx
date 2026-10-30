import type { PluginToolCallSlotProps } from "@astravia-org/plugin-sdk";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { InstructionSummary } from "../../shared/components/InstructionSummary.js";
import { parseToolResult } from "../tool-result.js";

interface NextInstructionPayload {
	ok?: boolean;
	error?: string;
	instruction?: {
		worker: string;
		task: string;
		chapter?: number | null;
		reason: string;
	} | null;
}

/**
 * `mahua_next_instruction` 的行内渲染（ADR 0011 §2.1）。
 *
 * 工具返回的 `reason` 已经是本地化过的句子，所以这里不再查任何 key——它是事实，
 * 不是给自己看的代码。渲染只做一件事：把「谁/做什么/为什么」摆成人能读的三行。
 */
export function InstructionToolRow({ toolCall }: PluginToolCallSlotProps) {
	const { t } = useTranslation();
	const payload = parseToolResult<NextInstructionPayload>(toolCall.result);

	if (toolCall.status === "pending") {
		return <p className="px-1 py-1.5 text-xs text-muted-foreground">{t("row.working")}</p>;
	}

	const instruction = payload?.ok ? payload.instruction : null;
	if (!instruction) {
		return (
			<p className="px-1 py-1.5 text-xs text-muted-foreground">
				{t(payload?.error ? "row.failed" : "instruction.none")}
			</p>
		);
	}

	return (
		<div className="rounded-[13px] bg-card px-3 py-2.5 shadow-xs">
			<InstructionSummary
				worker={instruction.worker}
				task={instruction.task}
				detail={instruction.reason}
				chapter={instruction.chapter ?? null}
			/>
		</div>
	);
}
