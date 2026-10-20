import { useTranslation } from "@astravia-org/plugin-sdk";

const PROMPTS = ["panel.report.next.explain", "panel.report.next.strings", "panel.report.next.export"];

export interface ReportNextStepsProps {
	sampleName: string;
	onPick: (prompt: string) => void;
}

/**
 * 面板只到「报告」为止，真正的追问发生在对话里。这里把下一步的问法带上样本名，
 * 用户复制过去就是一句能直接执行的指令。
 */
export function ReportNextSteps({ sampleName, onPick }: ReportNextStepsProps) {
	const { t } = useTranslation();
	return (
		<section className="space-y-1.5 rounded-md border border-black/[0.07] p-2.5 dark:border-white/10">
			<h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-foreground/45">
				{t("panel.report.next.title")}
			</h3>
			<ul className="space-y-1">
				{PROMPTS.map(key => {
					const prompt = t(key, { name: sampleName });
					return (
						<li key={key}>
							<button
								type="button"
								onClick={() => onPick(prompt)}
								title={t("panel.intro.prompts.copy")}
								className="w-full rounded px-1.5 py-1 text-left text-[11px] leading-relaxed text-foreground/60 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/80"
							>
								{prompt}
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
