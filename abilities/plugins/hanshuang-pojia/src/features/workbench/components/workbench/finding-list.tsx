/**
 * 发现列表：把 `Finding[]` 渲染成可点的行，并给出空态。
 *
 * 不排序、不再判级别——入参已经是排好序的结论；加排序会与「发现」页的筛选次序打架。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Finding } from "../../../../domain/audit/findings";
import { EmptyState } from "../shell/empty-state";
import { FindingRow } from "./finding-row";

export interface FindingListProps {
	findings: readonly Finding[];
	busy: boolean;
	onAsk(finding: Finding): void;
}

export function FindingList({ findings, busy, onAsk }: FindingListProps) {
	const { t } = useTranslation();
	if (findings.length === 0) {
		return <EmptyState icon="check" title={t("findings.empty.title")} body={t("findings.empty.body")} />;
	}
	return (
		<div>
			{findings.map(finding => (
				<FindingRow key={finding.ruleId} finding={finding} busy={busy} onAsk={() => onAsk(finding)} />
			))}
		</div>
	);
}
