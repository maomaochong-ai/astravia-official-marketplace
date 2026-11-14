/**
 * The three ledgers beside the findings: plan, coverage, notes.
 *
 * Upstream docks these as their own TUI panels because a pentest is a process, not a list of
 * results. Here they are the only place those artefacts exist — the chat shows that
 * `strix_note_create` was called, never the note's body.
 *
 * 所以这一栏的规则是**可展开**（ADR strix-0008）：一行只写标题的行，在面板里等于装饰——
 * 读者看得到"有 3 条笔记"，却打不开任何一条，那能不能读到正文就只能回聊天区翻工具调用。
 * 现在：
 *
 *  - 笔记：点一行展开正文（`strix_note_get`，只在点开时取，不预取全部内容）；
 *  - 覆盖：标题上给按结果分的计数，行数超过上限时明说"还有 N 行"，而不是静默截断；
 *  - 计划：标题给 `done/total`，行内保留优先级。
 *
 * 面板只读：写入属于 agent（它才有工具），这里不提供"帮我加一条"——那会变成第二个
 * 决定计划的地方（ADR 0008 的职责表）。
 */

import { useState } from "react";
import type { CoverageOutcome, NoteSummary, ShellSessionSummary, TodoItem } from "../../../runtime-contract";
import { PanelBox } from "../../../shared/components/panel-box";

const TODO_STATUS_ORDER = ["in_progress", "pending", "done"];
/** How many rows a panel shows before it says there are more. */
const ROW_LIMIT = 8;

function TodoPanel({ t, todos }: { t: (key: string, params?: Record<string, string | number>) => string; todos: readonly TodoItem[] }): React.ReactElement {
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
	t: (key: string, params?: Record<string, string | number>) => string;
	coverage: readonly CoverageOutcome[];
}): React.ReactElement {
	if (!coverage.length) return <p className="astra-strix-dim">{t("coverage.empty")}</p>;
	const shown = coverage.slice(0, ROW_LIMIT);
	const hidden = coverage.length - shown.length;
	return (
		<>
			<ul className="astra-strix-list">
				{shown.map((entry, index) => (
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
						<span className="astra-strix-list-text" title={`${entry.surface}${entry.note ? ` — ${entry.note}` : ""}`}>
							{entry.surface}
						</span>
					</li>
				))}
			</ul>
			{hidden > 0 ? <p className="astra-strix-list-more">{t("panels.moreRows", { count: hidden })}</p> : null}
		</>
	);
}

function NotesPanel({
	t,
	notes,
	onOpen,
}: {
	t: (key: string, params?: Record<string, string | number>) => string;
	notes: readonly NoteSummary[];
	onOpen?: (id: string) => Promise<string>;
}): React.ReactElement {
	const [openId, setOpenId] = useState<string | null>(null);
	const [body, setBody] = useState<string>("");
	const [loading, setLoading] = useState(false);

	if (!notes.length) return <p className="astra-strix-dim">{t("notes.empty")}</p>;

	const toggle = (id: string): void => {
		if (openId === id) {
			setOpenId(null);
			setBody("");
			return;
		}
		setOpenId(id);
		setBody("");
		if (!onOpen) return;
		setLoading(true);
		void onOpen(id)
			.then((text) => setBody(text))
			.catch((cause: unknown) => setBody(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setLoading(false));
	};
	const shown = notes.slice(0, ROW_LIMIT);
	const hidden = notes.length - shown.length;

	return (
		<>
			<ul className="astra-strix-list">
				{shown.map((note) => (
					<li key={note.id} className="astra-strix-list-row" data-open={openId === note.id ? "yes" : "no"}>
						<button
							type="button"
							className="astra-strix-list-open"
							onClick={() => toggle(note.id)}
							aria-expanded={openId === note.id}
							title={`${note.title}${note.category ? ` · ${note.category}` : ""}`}
						>
							<span className="astra-strix-mono astra-strix-micro astra-strix-dim">{note.id}</span>
							<span className="astra-strix-list-text">
								{note.title}
								{note.preview ? <span className="astra-strix-note-preview">{note.preview}</span> : null}
							</span>
							<span className="astra-strix-dim astra-strix-micro">{openId === note.id ? "▾" : "▸"}</span>
						</button>
					</li>
				))}
			</ul>
			{hidden > 0 ? <p className="astra-strix-list-more">{t("panels.moreRows", { count: hidden })}</p> : null}
			{openId ? (
				<div className="astra-strix-note-body">
					{loading ? <p className="astra-strix-dim">{t("panels.loading")}</p> : null}
					{body ? <pre>{body}</pre> : null}
				</div>
			) : null}
		</>
	);
}

/**
 * 工作单元（ADR 0010）：上游 agents 面板在本插件的诚实等价物。
 *
 * 上游列的是它自己派生的子智能体（名字、状态、任务、携带的技能）。本插件没有模型循环
 * （ADR 0003），所以**不存在**可派生的子智能体；能如实列出的是同一个沙箱里并行干活的东西：
 * agent 用 `strix_exec background:true` 留下、用 `strix_write_stdin` 驱动的 shell 会话。
 *
 * 它只读：启动/写入/停止都走工具（那是 agent 的动作）。面板不提供按钮，
 * 否则就成了第二个决定“要并行跑什么”的地方。
 */
function SessionPanel({
	t,
	sessions,
}: {
	t: (key: string, params?: Record<string, string | number>) => string;
	sessions: readonly ShellSessionSummary[];
}): React.ReactElement {
	if (!sessions.length) return <p className="astra-strix-dim">{t("sessions.empty")}</p>;
	return (
		<ul className="astra-strix-list">
			{sessions.slice(0, ROW_LIMIT).map((session) => (
				<li key={session.id} className="astra-strix-list-row" data-state={session.running ? "in_progress" : "done"}>
					<span className={session.running ? "astra-strix-green" : "astra-strix-dim"} aria-hidden="true">
						{session.running ? "●" : "○"}
					</span>
					<span className="astra-strix-list-text" title={`${session.command}${session.tty ? " · tty" : ""}`}>
						{session.command}
					</span>
					<span className="astra-strix-dim astra-strix-micro">
						{session.uptimeSec}s{session.tty ? " · tty" : ""}
					</span>
				</li>
			))}
		</ul>
	);
}

export function ArtefactPanels({
	t,
	todos,
	notes,
	coverage,
	sessions = [],
	coverageTally,
	onOpenNote,
}: {
	t: (key: string, params?: Record<string, string | number>) => string;
	todos: readonly TodoItem[];
	notes: readonly NoteSummary[];
	coverage: readonly CoverageOutcome[];
	/** Counts by outcome, from the service; shown on the coverage title. */
	/** Kept shell sessions; empty when the bridge has none (ADR 0010). */
	sessions?: readonly ShellSessionSummary[];
	coverageTally?: Record<string, number>;
	/** Fetches a note's body on demand (`strix_note_get`). */
	onOpenNote?: (id: string) => Promise<string>;
}): React.ReactElement {
	const done = todos.filter((todo) => todo.status === "done").length;
	const vulnerable = coverageTally?.vulnerable ?? coverage.filter((entry) => entry.outcome === "vulnerable").length;
	const clean = coverageTally?.clean ?? coverage.filter((entry) => entry.outcome === "clean").length;

	return (
		<>
			<PanelBox
				title={t("todos.title")}
				hint={todos.length ? `${done}/${todos.length}` : undefined}
				emptyLabel={t("rail.empty.todos")}
			>
				<TodoPanel t={t} todos={todos} />
			</PanelBox>
			<PanelBox
				title={t("coverage.title")}
				hint={coverage.length ? `${vulnerable}/${clean}` : undefined}
				emptyLabel={t("rail.empty.coverage")}
			>
				<CoveragePanel t={t} coverage={coverage} />
			</PanelBox>
			<PanelBox title={t("notes.title")} hint={notes.length ? String(notes.length) : undefined} emptyLabel={t("rail.empty.notes")}>
				<NotesPanel t={t} notes={notes} {...(onOpenNote ? { onOpen: onOpenNote } : {})} />
			</PanelBox>
			<PanelBox
				title={t("sessions.title")}
				hint={sessions.length ? `${sessions.filter((session) => session.running).length}/${sessions.length}` : undefined}
				emptyLabel={t("rail.empty.sessions")}
			>
				<SessionPanel t={t} sessions={sessions} />
			</PanelBox>
		</>
	);
}
