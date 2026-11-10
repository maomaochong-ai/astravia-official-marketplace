/**
 * Agent tree for the sidebar, mirroring upstream's `agentsView`.
 *
 * Upstream draws one indented row per agent with a status glyph, and the parent
 * relationship from the coordinator graph decides indentation. The bridge only
 * forwards projected events, so the set of agents is derived from the agents a
 * run has spoken as; status comes from the last tool record for that agent.
 */

import type { TuiUiEvent } from "./trace-block";

export interface AgentRow {
	id: string;
	status: "running" | "completed" | "failed";
}

export interface AgentListProps {
	t: (key: string) => string;
	events: readonly TuiUiEvent[];
}

function glyph(status: AgentRow["status"]): { mark: string; tone: string } {
	switch (status) {
		case "running":
			return { mark: "●", tone: "astra-strix-amber" };
		case "failed":
			return { mark: "✗", tone: "astra-strix-red" };
		default:
			return { mark: "✓", tone: "astra-strix-green" };
	}
}

/** One row per agent, newest tool status wins; order of first appearance is kept. */
export function deriveAgents(events: readonly TuiUiEvent[]): AgentRow[] {
	const rows = new Map<string, AgentRow>();
	for (const event of events) {
		const id = event.agent_id;
		if (!id) continue;
		const data = event.data ?? {};
		const status = String(data.status ?? "");
		const next: AgentRow["status"] =
			status === "failed" || status === "error" ? "failed" : status === "completed" ? "completed" : "running";
		const existing = rows.get(id);
		if (!existing) rows.set(id, { id, status: next });
		else if (next !== "running") existing.status = next;
	}
	return [...rows.values()];
}

export function AgentList({ t, events }: AgentListProps): React.ReactElement {
	const agents = deriveAgents(events);
	if (!agents.length) return <p className="astra-strix-dim">{t("agents.empty")}</p>;
	return (
		<ul className="astra-strix-agents">
			{agents.map((agent) => {
				const mark = glyph(agent.status);
				return (
					<li key={agent.id} className="astra-strix-agent">
						<span className={mark.tone}>{mark.mark}</span>
						<span className="astra-strix-agent-id">{agent.id}</span>
					</li>
				);
			})}
		</ul>
	);
}
