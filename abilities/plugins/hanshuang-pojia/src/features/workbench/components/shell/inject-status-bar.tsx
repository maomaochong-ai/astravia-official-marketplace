import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PromptLibrary } from "../../../../domain/prompt-library";
import { estimateTokens, getActivePrompt } from "../../../../domain/prompt-library";

export interface InjectStatusBarProps {
	library: PromptLibrary;
}

/**
 * 注入状态条：只回答「当前注入的是哪份提示词」。
 *
 * lab 状态不在这里 —— 它只在顶栏那个开关上显示。同一个事实在两处出现，
 * 一处是开关、一处是徽标，颜色还不一样，读起来像两件事。
 * 没有激活提示词时整条不渲染，省下 28px 高度。
 */
export function InjectStatusBar({ library }: InjectStatusBarProps) {
	const { t } = useTranslation();
	const active = getActivePrompt(library);

	if (!active) return null;

	return (
		<div className="flex min-h-7 shrink-0 items-center gap-2 border-b border-line-subtle bg-surface-3/40 px-4 text-[10.5px]">
			<span className="flex min-w-0 items-center gap-1.5 text-text-2">
				<span className="size-1.5 shrink-0 rounded-full bg-accent" />
				<span className="max-w-[240px] fb-wrap font-medium" title={active.name}>{active.name}</span>
				<span className="text-text-4">·</span>
				<span className="shrink-0 text-text-3">{t(`prompt.mode.${active.mode}`)}</span>
				<span className="text-text-4">·</span>
				<span className="shrink-0 text-text-3">{t("prompt.editor.tokens", { count: estimateTokens(active.content) })}</span>
			</span>
		</div>
	);
}
