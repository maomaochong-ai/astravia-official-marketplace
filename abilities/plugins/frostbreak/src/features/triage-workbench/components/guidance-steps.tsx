import { useTranslation } from "@astravia-org/plugin-sdk";

const STEPS = [
	{ index: 1, title: "panel.intro.step1.title", body: "panel.intro.step1.body" },
	{ index: 2, title: "panel.intro.step2.title", body: "panel.intro.step2.body" },
	{ index: 3, title: "panel.intro.step3.title", body: "panel.intro.step3.body" },
];

/** 三步使用路径。用户抱怨的正是「打开面板不知道下一步做什么」，所以固定顺序、带序号。 */
export function GuidanceSteps() {
	const { t } = useTranslation();
	return (
		<ol className="w-full space-y-1.5">
			{STEPS.map(step => (
				<li key={step.index} className="flex items-start gap-2">
					<span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/10 text-[9.5px] font-semibold text-foreground/50 dark:border-white/15">
						{step.index}
					</span>
					<div className="min-w-0">
						<p className="text-[11.5px] font-medium text-foreground/75">{t(step.title)}</p>
						<p className="text-[10.5px] leading-relaxed text-foreground/45">{t(step.body)}</p>
					</div>
				</li>
			))}
		</ol>
	);
}
