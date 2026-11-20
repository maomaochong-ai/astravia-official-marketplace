import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Finding } from "../../../../domain/audit/findings";
import { SEVERITY_DOT } from "../../severity";
import { AiButton } from "../shell/ai-button";
import { Tag } from "../shell/tag";

export interface FindingRowProps {
	finding: Finding;
	/** 证据默认折叠，行内只展示前两条，其余在标题里计数。 */
	busy: boolean;
	onAsk(): void;
}

/** 一条发现：严重度点 + 规则 id + 标题 + 证据，右侧一个「让 AI 解释」。 */
export function FindingRow({ finding, busy, onAsk }: FindingRowProps) {
	const { t } = useTranslation();
	return (
		<div className="group flex items-start gap-2.5 border-b border-line-subtle px-3.5 py-2.5 last:border-0 hover:bg-surface-hover">
			<span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[finding.severity]}`} />
			<div className="min-w-0 flex-1">
				{/*
				 * 级别只出现一次，且是译文。
				 * 上一版同一条发现既印原始枚举（critical/high）又印标签（严重/高危），
				 * 两行字说同一件事，还让中文界面里露出英文枚举。
				 */}
				<div className="flex min-w-0 flex-wrap items-center gap-1.5">
					<Tag>{t(`severity.${finding.severity}`)}</Tag>
					<span className="fb-wrap font-mono text-[10.5px] leading-snug text-text-4">{finding.ruleId}</span>
				</div>
				<div className="mt-0.5 text-[12px] font-medium leading-snug text-text">{finding.title}</div>
				<div className="mt-0.5 break-words text-[11.5px] leading-relaxed text-text-3">{finding.detail}</div>
				{finding.evidence.length > 0 ? (
					<ul className="mt-1 space-y-0.5">
						{finding.evidence.slice(0, 3).map(item => (
							<li key={item} className="truncate font-mono text-[10.5px] text-text-4" title={item}>
								{item}
							</li>
						))}
						{finding.evidence.length > 3 ? <li className="font-mono text-[10.5px] text-text-4">{t("findings.moreEvidence", { count: finding.evidence.length - 3 })}</li> : null}
					</ul>
				) : null}
			</div>
			<div className="opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
				<AiButton label={t("findings.askAi")} onClick={onAsk} busy={busy} compact />
			</div>
		</div>
	);
}
