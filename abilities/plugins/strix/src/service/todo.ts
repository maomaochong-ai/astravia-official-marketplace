/**
 * The assessment plan, as todos.
 *
 * Upstream keeps a per-agent list in `todos.json` and sorts it by status then
 * priority (`strix/tools/todo`). The ordering matters to the panel: what is being
 * worked on sits above what is done, and a critical item above a low one.
 *
 * One list per assessment: with several agents the plan is shared, which is the
 * point - a specialist can see what the lead already covered.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveDataDir, sessionKey } from "./paths";

export const TODO_STATUSES = ["pending", "in_progress", "done"] as const;
export const TODO_PRIORITIES = ["low", "normal", "high", "critical"] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];
export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export interface Todo {
	id: string;
	title: string;
	status: TodoStatus;
	priority: TodoPriority;
	created_at: string;
	updated_at: string;
}

const STATUS_RANK: Record<TodoStatus, number> = { in_progress: 0, pending: 1, done: 2 };
const PRIORITY_RANK: Record<TodoPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export function sortTodos(todos: readonly Todo[]): Todo[] {
	return [...todos].sort(
		(left, right) =>
			STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
			PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] ||
			left.created_at.localeCompare(right.created_at),
	);
}

function status(value: unknown): TodoStatus {
	const text = String(value ?? "").trim().toLowerCase();
	if (!(TODO_STATUSES as readonly string[]).includes(text)) {
		throw new Error(`status must be one of ${TODO_STATUSES.join(", ")}`);
	}
	return text as TodoStatus;
}

function priority(value: unknown): TodoPriority {
	const text = String(value ?? "").trim().toLowerCase();
	return (TODO_PRIORITIES as readonly string[]).includes(text) ? (text as TodoPriority) : "normal";
}

export class TodoStore {
	constructor(private readonly dir: string = resolveDataDir()) {}

	private file(sessionId: string): string {
		return join(this.dir, "todos", `${sessionKey(sessionId)}.json`);
	}

	private async read(sessionId: string): Promise<Todo[]> {
		try {
			const parsed: unknown = JSON.parse(await readFile(this.file(sessionId), "utf8"));
			return Array.isArray(parsed) ? (parsed as Todo[]) : [];
		} catch {
			return [];
		}
	}

	private async write(sessionId: string, todos: Todo[]): Promise<void> {
		await mkdir(join(this.dir, "todos"), { recursive: true });
		await writeFile(this.file(sessionId), `${JSON.stringify(todos, null, 2)}\n`, "utf8");
	}

	async create(sessionId: string, params: Record<string, unknown>): Promise<{ count: number; todos: Todo[] }> {
		const requested = Array.isArray(params.todos) ? (params.todos as Record<string, unknown>[]) : [];
		if (!requested.length) throw new Error("todos must list at least one item");
		const now = new Date().toISOString();
		const created = requested.map((item) => {
			const title = String(item.title ?? "").trim();
			if (!title) throw new Error("every todo needs a title");
			return {
				id: randomUUID().replace(/-/g, "").slice(0, 6),
				title,
				status: "pending" as TodoStatus,
				priority: priority(item.priority),
				created_at: now,
				updated_at: now,
			};
		});
		const todos = sortTodos([...(await this.read(sessionId)), ...created]);
		await this.write(sessionId, todos);
		return { count: todos.length, todos };
	}

	async update(sessionId: string, params: Record<string, unknown>): Promise<{ count: number; todos: Todo[] }> {
		const ids = Array.isArray(params.ids) ? params.ids.map(String) : [];
		if (!ids.length) throw new Error("ids must list at least one todo");
		const next = status(params.status);
		const now = new Date().toISOString();
		const todos = await this.read(sessionId);
		let touched = 0;
		for (const todo of todos) {
			if (!ids.includes(todo.id)) continue;
			todo.status = next;
			todo.updated_at = now;
			touched += 1;
		}
		if (!touched) throw new Error(`no todo matched ${ids.join(", ")}`);
		const ordered = sortTodos(todos);
		await this.write(sessionId, ordered);
		return { count: ordered.length, todos: ordered };
	}

	async list(sessionId: string): Promise<{ count: number; todos: Todo[] }> {
		const todos = sortTodos(await this.read(sessionId));
		return { count: todos.length, todos };
	}

	/**
	 * 删掉计划项（上游 `delete_todo`）。
	 *
	 * 为什么要这个：计划是会变的——一条“先试 /admin”在确认不可达之后不应继续占着面板，
	 * 也不应该被改成 done 假装做过。只能 create/update 的话，唯一的清理方式是做完它，
	 * 那会让计划与实际不符。
	 */
	async remove(sessionId: string, params: Record<string, unknown>): Promise<{ removed: string[]; count: number; todos: Todo[] }> {
		const ids = Array.isArray(params.ids) ? params.ids.map(String) : [];
		if (!ids.length) throw new Error("ids must list at least one todo");
		const todos = await this.read(sessionId);
		const removed = todos.filter((todo) => ids.includes(todo.id)).map((todo) => todo.id);
		if (!removed.length) throw new Error(`no todo matched ${ids.join(", ")}`);
		const kept = sortTodos(todos.filter((todo) => !removed.includes(todo.id)));
		await this.write(sessionId, kept);
		return { removed, count: kept.length, todos: kept };
	}
}
