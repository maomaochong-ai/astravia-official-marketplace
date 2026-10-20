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
