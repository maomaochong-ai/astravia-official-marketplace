import { useTranslation } from "@astravia-org/plugin-sdk";
import { GuidanceSteps } from "./guidance-steps";
import { PromptSuggestions } from "./prompt-suggestions";
import { SupportedFormats } from "./supported-formats";

export interface WorkbenchIntroProps {
	/** 工作区没有绑定目录时，把「换个地方打开」这句提示换成具体的补救办法。 */
	hasWorkspace: boolean;
	onPickPrompt: (prompt: string) => void;
}

const BADGES = ["panel.intro.badge.readonly", "panel.intro.badge.noexec", "panel.intro.badge.offline"];

/**
 * 空状态即使用说明。面板本身只有一列样本 + 一块结果区，光看界面看不出「分析完还能干什么」，
 * 所以第一屏就把三步、支持的格式和现成的问法摆出来。
 */
export function WorkbenchIntro({ hasWorkspace, onPickPrompt }: WorkbenchIntroProps) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-1 items-start justify-center overflow-y-auto px-6 py-6">
			<div className="flex w-full max-w-[460px] flex-col items-center gap-3.5 text-center">
				<div className="flex flex-wrap justify-center gap-1">
					{BADGES.map(badge => (
						<span
							key={badge}
							className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-700 dark:text-emerald-400"
						>
							{t(badge)}
						</span>
					))}
				</div>

				<div className="space-y-1">
					<h2 className="text-[13.5px] font-semibold text-foreground/85">{t("panel.intro.title")}</h2>
					<p className="text-[11px] leading-relaxed text-foreground/50">
						{hasWorkspace ? t("panel.intro.body") : t("panel.intro.bodyNoWorkspace")}
					</p>
				</div>

				<SupportedFormats />

				{hasWorkspace ? (
					<p className="text-[10.5px] leading-relaxed text-foreground/40">{t("panel.intro.scope")}</p>
				) : null}

				<div className="h-px w-full bg-black/[0.06] dark:bg-white/10" />

				<GuidanceSteps />

				<PromptSuggestions onPick={onPickPrompt} />
			</div>
		</div>
	);
}
