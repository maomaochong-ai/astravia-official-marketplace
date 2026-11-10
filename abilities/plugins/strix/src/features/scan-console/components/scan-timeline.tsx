/**
 * Live transcript of the running scan.
 *
 * Records come from Strix's own event projection, so a tool call row shows the
 * tool the agent actually ran. Unknown record types are shown as their raw
 * content instead of being dropped - an unfamiliar event is still evidence.
 */

import type { ScanRecord } from "../../../runtime-contract";

export interface ScanTimelineProps {
	t: (key: string) => string;
	records: readonly ScanRecord[];
}

function label(record: ScanRecord): string {
	if (record.tool_name) return String(record.tool_name);
	if (record.type) return String(record.type);
	return "event";
}

function body(record: ScanRecord): string {
	if (typeof record.content === "string" && record.content.trim()) return record.content.trim();
	if (record.tool_args !== undefined) {
		try {
			return JSON.stringify(record.tool_args, null, 2);
		} catch {
			return String(record.tool_args);
		}
	}
	return "";
}

export function ScanTimeline({ t, records }: ScanTimelineProps): React.ReactElement {
	if (!records.length) {
		return <p className="astra-strix-empty">{t("timeline.empty")}</p>;
	}
	return (
		<ol className="astra-strix-timeline" aria-label={t("timeline.label")}>
			{records.map((record, index) => (
				<li key={`${record.id ?? index}-${record.timestamp ?? index}`} className="astra-strix-timeline-item">
					<div className="astra-strix-timeline-head">
						<span className="astra-strix-timeline-kind">{label(record)}</span>
						{record.agent_id ? <span className="astra-strix-timeline-agent">{record.agent_id}</span> : null}
					</div>
					<pre className="astra-strix-timeline-body">{body(record)}</pre>
				</li>
			))}
		</ol>
	);
}
