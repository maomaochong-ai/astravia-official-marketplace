/**
 * The working artefacts beside the findings: the specialists, the plan, the coverage,
 * the notes.
 *
 * Upstream docks these as their own panels because a pentest is a process, not a list
 * of results: the operator wants to see who is working on what, what the lead meant to
 * test, and which surfaces have actually been touched. The boxes are deliberately
 * terse - one row per item, status carried by a glyph and colour.
 */

import type { AgentStatus } from "../../../agent/strix-agent";
import type { CoverageOutcome, NoteSummary, TodoItem } from "../../../runtime-contract";
import { PanelBox } from "../../../shared/components/panel-box";
const TODO_STATUS_ORDER = ["in_progress", "pending", "done"];

function TodoPanel({ t, todos }: { t: (key: string) => string; todos: readonly TodoItem[] }): React.ReactElement {
	if (!todos.length) return <p className="astra-strix-dim">{t("todos.empty")}</p>;
	const ordered = [...todos].sort(
		(left, right) => TODO_STATUS_ORDER.indexOf(left.status) - TODO_STATUS_ORDER.indexOf(right.status),
	);
	return (
		<ul className="astra-strix-list">
			{ordered.map((todo) => (
				<li key={todo.id} className="astra-strix-list-row" data-state={todo.status}>
					<span className="astra-strix-glyph" aria-hidden="true">
						{todo.status === "done" ? "✓" : todo.status === "in_progress" ? "●" : "○"}
					</span>
					<span className="astra-strix-list-text" title={todo.title}>
						{todo.title}
					</span>
					{todo.priority === "critical" || todo.priority === "high" ? (
						<span className="astra-strix-amber astra-strix-micro">{todo.priority}</span>
					) : null}
				</li>
			))}
		</ul>
	);
}

function CoveragePanel({
	t,
	coverage,
}: {
	t: (key: string) => string;
	coverage: readonly CoverageOutcome[];
}): React.ReactElement {
	if (!coverage.length) return <p className="astra-strix-dim">{t("coverage.empty")}</p>;
	const alive = coverage.slice(0, 8);
	return (
		<ul className="astra-strix-list">
			{alive.map((entry, index) => (
				<li key={`${entry.surface}-${index}`} className="astra-strix-list-row" data-state={entry.outcome}>
					<span
						className={
							entry.outcome === "vulnerable"
								? "astra-strix-red"
								: entry.outcome === "clean"
									? "astra-strix-green"
									: "astra-strix-dim"
						}
						aria-hidden="true"
					>
						{entry.outcome === "vulnerable" ? "✗" : entry.outcome === "clean" ? "✓" : "–"}
					</span>
					<span className="astra-strix-list-text" title={entry.surface}>
						{entry.surface}
					</span>
				</li>
			))}
		</ul>
	);
}

function NotesPanel({ t, notes }: { t: (key: string) => string; notes: readonly NoteSummary[] }): React.ReactElement {
	if (!notes.length) return <p className="astra-strix-dim">{t("notes.empty")}</p>;
	return (
		<ul className="astra-strix-list">
			{notes.slice(0, 8).map((note) => (
				<li key={note.id} className="astra-strix-list-row">
					<span className="astra-strix-mono astra-strix-micro astra-strix-dim">{note.id}</span>
					<span className="astra-strix-list-text" title={`${note.title}${note.category ? ` · ${note.category}` : ""}`}>
						{note.title}
					</span>
				</li>
			))}
		</ul>
	);
}

function AgentsPanel({ t, agents }: { t: (key: string) => string; agents: readonly AgentStatus[] }): React.ReactElement {
	if (!agents.length) return <p className="astra-strix-dim">{t("agents.empty")}</p>;
	return (
		<ul className="astra-strix-list">
			{agents.map((agent) => (
				<li key={agent.name} className="astra-strix-list-row" data-state={agent.status}>
					<span
						className={
							agent.status === "running"
								? "astra-strix-amber astra-strix-glyph"
								: agent.status === "done"
									? "astra-strix-green astra-strix-glyph"
									: "astra-strix-red astra-strix-glyph"
						}
						aria-hidden="true"
					>
						{agent.status === "running" ? "●" : agent.status === "done" ? "✓" : "✗"}
					</span>
					<span className="astra-strix-list-text" title={agent.task}>
						{agent.name}
					</span>
					<span className="astra-strix-micro astra-strix-dim">{agent.status}</span>
				</li>
			))}
		</ul>
	);
}

export function ArtefactPanels({
	t,
	agents,
	todos,
	notes,
	coverage,
}: {
	t: (key: string) => string;
	agents: readonly AgentStatus[];
	todos: readonly TodoItem[];
	notes: readonly NoteSummary[];
	coverage: readonly CoverageOutcome[];
}): React.ReactElement {
	const done = todos.filter((todo) => todo.status === "done").length;
	return (
		<>
			<PanelBox
				title={t("agents.title")}
				hint={agents.length ? String(agents.length) : undefined}
				emptyLabel={t("rail.empty")}
			>
				<AgentsPanel t={t} agents={agents} />
			</PanelBox>
			<PanelBox
				title={t("todos.title")}
				hint={todos.length ? `${done}/${todos.length}` : undefined}
				emptyLabel={t("rail.empty")}
			>
				<TodoPanel t={t} todos={todos} />
			</PanelBox>
			<PanelBox title={t("coverage.title")} hint={coverage.length ? String(coverage.length) : undefined} emptyLabel={t("rail.empty")}>
				<CoveragePanel t={t} coverage={coverage} />
			</PanelBox>
			<PanelBox title={t("notes.title")} hint={notes.length ? String(notes.length) : undefined} emptyLabel={t("rail.empty")}>
				<NotesPanel t={t} notes={notes} />
			</PanelBox>
		</>
	);
}
