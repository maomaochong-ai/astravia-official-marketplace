/**
 * 「真实使用案例」面板：六条可以照着说的话，每条都点名一个真实 REA 入口工具。
 *
 * 只做两件事：把当前输入框里的目标填进提示词、复制。不自动发送——发什么进对话
 * 必须由用户决定；也不假装这是「示例输出」，这里没有任何伪造的查询结果。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { copyText } from "../../../shared/services/clipboard";
import type { TargetKind } from "../data/targets";
import { USAGE_EXAMPLES } from "../data/usage-examples";

interface UsageExamplesProps {
	readonly target: string;
	readonly targetKind: TargetKind | null;
	readonly onClose: () => void;
}

export function ReaUsageExamples({ target, targetKind, onClose }: UsageExamplesProps): JSX.Element {
	const { t } = useTranslation();
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const placeholder = t("tab.examples.placeholder");
	const value = target.trim().length > 0 ? target.trim() : placeholder;

	return (
		<div className="mt-2 rounded-control border border-border bg-background/60 px-2 py-1.5">
			<div className="flex min-w-0 items-center gap-1.5">
				<span aria-hidden className="icon-[lucide--book-open] size-3 shrink-0 text-primary" />
				<span className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-foreground/90" title={t("tab.examples.title")}>
					{t("tab.examples.title")}
				</span>
				<button
					type="button"
					onClick={onClose}
					title={t("tab.examples.close")}
					className="inline-flex h-5 shrink-0 items-center rounded px-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span aria-hidden className="icon-[lucide--x] size-3" />
				</button>
			</div>
			<p className="mt-0.5 text-[10px] leading-snug text-muted-foreground" title={t("tab.examples.hint")}>
				<span className="line-clamp-2">{t("tab.examples.hint")}</span>
			</p>
			<ul className="mt-1 flex flex-col gap-1">
				{USAGE_EXAMPLES.map((example) => {
					const title = t(example.titleKey);
					const prompt = t(example.promptKey, { target: value });
					const active = targetKind !== null && example.targetKind === targetKind;
					return (
						<li
							key={example.id}
							className={`rounded-control border px-1.5 py-1 ${
								active ? "border-primary/40 bg-primary/5" : "border-border/70 bg-card/40"
							}`}
						>
							<div className="flex min-w-0 items-center gap-1.5">
								<span className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-foreground/90" title={title}>
									{title}
								</span>
								<code className="hidden shrink-0 font-mono text-[9.5px] text-muted-foreground @min-[360px]:inline" title={example.tool}>
									{example.tool}
								</code>
								<button
									type="button"
									onClick={() => {
										void copyText(prompt).then((ok) => {
											if (ok) setCopiedId(example.id);
										});
									}}
									title={`${t("tab.examples.copy")}\n${prompt}`}
									className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-border px-1.5 text-[10px] text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
								>
									<span aria-hidden className="icon-[lucide--copy] size-2.5" />
									{copiedId === example.id ? t("tab.examples.copied") : t("tab.examples.copy")}
								</button>
							</div>
							<p className="mt-0.5 font-mono text-[10px] leading-snug text-muted-foreground" title={prompt}>
								<span className="line-clamp-2">{prompt}</span>
							</p>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
