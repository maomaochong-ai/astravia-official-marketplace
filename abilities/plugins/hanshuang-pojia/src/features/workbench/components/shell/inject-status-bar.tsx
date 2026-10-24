import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LabState } from "../../../../domain/lab-mode";
import type { PromptLibrary } from "../../../../domain/prompt-library";
import { estimateTokens, getActivePrompt } from "../../../../domain/prompt-library";

export interface InjectStatusBarProps {
	lab: LabState;
	library: PromptLibrary;
}

/**
 * 注入状态条：显示当前激活的提示词、注入模式、token 数，以及 Lab 状态。
 * 等价于寒霜注入工具的 RoleCardStrip。
 */
export function InjectStatusBar({ lab, library }: InjectStatusBarProps) {
	const { t } = useTranslation();
	const active = getActivePrompt(library);

	if (!active && !lab.enabled) return null;

	return (
		<div className="flex items-center gap-2 border-b border-line-subtle bg-surface-3/50 px-3 py-1.5 text-[10.5px]">
			{lab.enabled ? (
				<span className="flex items-center gap-1 rounded-full bg-risk-low/10 px-2 py-0.5 font-medium text-risk-low">
					<span className="size-1.5 rounded-full bg-risk-low" />
					LAB
				</span>
			) : null}
			{active ? (
				<span className="flex items-center gap-1.5 rounded-full bg-purple/10 px-2 py-0.5 font-medium text-purple">
					<span className="truncate max-w-[160px]">{active.name}</span>
					<span className="text-text-4">·</span>
					<span className="text-text-3">{t(`prompt.mode.${active.mode}`)}</span>
					<span className="text-text-4">·</span>
					<span className="text-text-3">{t("prompt.editor.tokens", { count: estimateTokens(active.content) })}</span>
				</span>
			) : null}
			{!active && lab.enabled ? (
				<span className="text-text-4">{t("inject.noActivePrompt")}</span>
			) : null}
		</div>
	);
}
