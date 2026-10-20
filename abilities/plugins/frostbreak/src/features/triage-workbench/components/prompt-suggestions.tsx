import { useTranslation } from "@astravia-org/plugin-sdk";

const PROMPTS = ["panel.intro.prompts.one", "panel.intro.prompts.two", "panel.intro.prompts.three"];

export interface PromptSuggestionsProps {
	onPick: (prompt: string) => void;
}

/**
 * 面板不是唯一的入口：真正干活的是对话里的 Agent。这里把「该怎么问」写成可直接复制的句子，
 * 用户不必先学会工具名。
 */
export function PromptSuggestions({ onPick }: PromptSuggestionsProps) {
	const { t } = useTranslation();
	return (
		<div className="w-full space-y-1">
			<div className="flex items-baseline gap-1">
				<h3 className="min-w-0 flex-1 text-[10.5px] font-semibold uppercase tracking-wide text-foreground/45">
					{t("panel.intro.prompts.title")}
				</h3>
				<span className="shrink-0 text-[10px] text-foreground/30">{t("panel.intro.prompts.hint")}</span>
			</div>
			<ul className="space-y-1">
				{PROMPTS.map(key => {
					const prompt = t(key);
					return (
						<li key={key}>
							<button
								type="button"
								onClick={() => onPick(prompt)}
								title={t("panel.intro.prompts.copy")}
								className="group flex w-full items-start gap-2 rounded border border-black/[0.07] bg-background px-2 py-1.5 text-left transition-colors hover:border-foreground/20 hover:bg-foreground/[0.03] dark:border-white/10"
							>
								<span className="min-w-0 flex-1 text-[11px] leading-relaxed text-foreground/65">{prompt}</span>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.6"
									className="mt-0.5 h-3 w-3 shrink-0 text-foreground/30 group-hover:text-foreground/60"
									aria-hidden
								>
									<rect x="9" y="9" width="11" height="11" rx="2" />
									<path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" strokeLinecap="round" />
								</svg>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
