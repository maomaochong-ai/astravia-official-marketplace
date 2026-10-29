/**
 * 伏笔台账的领域逻辑（ADR 0021）。
 *
 * 台账是独立文件 `threads/<bookId>.json`，不参与 `NovelBook` 的 schema。
 * 本模块只做纯计算：编号分配、增改、体检。读写由仓储与服务层负责。
 */

import type { StoryThread, ThreadFinding, ThreadWeight } from "./novel-types.js";

export const THREAD_WEIGHTS: readonly ThreadWeight[] = ["light", "medium", "heavy"];

export interface ThreadInput {
	content: string;
	plantedIn: number;
	dueIn: number;
	weight: ThreadWeight;
}

export type ThreadMutation =
	| { ok: true; threads: StoryThread[]; thread: StoryThread }
	| { ok: false; error: "thread.invalid" | "thread.not-found" | "thread.already-closed"; detail: string };

export interface ThreadAudit {
	findings: ThreadFinding[];
	open: number;
	/** 过期的未回收条数。 */
	overdue: number;
	/** 未回收率，两位小数；台账为空时是 0。 */
	unresolvedRate: number;
}

function nextId(threads: readonly StoryThread[]): string {
	let max = 0;
	for (const thread of threads) {
		const n = Number.parseInt(thread.id.replace(/^t/, ""), 10);
		if (Number.isFinite(n) && n > max) max = n;
	}
	return `t${max + 1}`;
}

function sortedByDue(threads: readonly StoryThread[]): StoryThread[] {
	return [...threads].sort((a, b) => a.dueIn - b.dueIn || a.plantedIn - b.plantedIn);
}

export function addThread(threads: readonly StoryThread[], input: ThreadInput): ThreadMutation {
	const content = input.content.trim();
	if (!content) return { ok: false, error: "thread.invalid", detail: "content is empty" };
	if (!Number.isInteger(input.plantedIn) || input.plantedIn < 1) {
		return { ok: false, error: "thread.invalid", detail: "plantedIn must be a positive integer" };
	}
	if (!Number.isInteger(input.dueIn) || input.dueIn < input.plantedIn) {
		return { ok: false, error: "thread.invalid", detail: "dueIn must be an integer not before plantedIn" };
	}
	if (!THREAD_WEIGHTS.includes(input.weight)) {
		return { ok: false, error: "thread.invalid", detail: `weight must be one of ${THREAD_WEIGHTS.join(", ")}` };
	}

	const thread: StoryThread = {
		id: nextId(threads),
		content,
		plantedIn: input.plantedIn,
		dueIn: input.dueIn,
		weight: input.weight,
		status: "open",
		closedIn: null,
	};
	return { ok: true, threads: sortedByDue([...threads, thread]), thread };
}

export function closeThread(
	threads: readonly StoryThread[],
	id: string,
	chapter: number,
): ThreadMutation {
	const target = threads.find((thread) => thread.id === id);
	if (!target) return { ok: false, error: "thread.not-found", detail: `no thread ${id}` };
	if (target.status === "closed") {
		return { ok: false, error: "thread.already-closed", detail: `thread ${id} closed in chapter ${target.closedIn}` };
	}
	if (!Number.isInteger(chapter) || chapter < target.plantedIn) {
		return { ok: false, error: "thread.invalid", detail: "closedIn must be an integer not before plantedIn" };
	}
	const closed: StoryThread = { ...target, status: "closed", closedIn: chapter };
	return {
		ok: true,
		threads: threads.map((thread) => (thread.id === id ? closed : thread)),
		thread: closed,
	};
}

/**
 * `committedMax` 是已提交章的最大章号（没有已提交章时为 0）。
 * 所有判据都只跟它比，不读时钟——体检结果因此可复现。
 */
export function auditThreads(threads: readonly StoryThread[], committedMax: number): ThreadAudit {
	const findings: ThreadFinding[] = [];
	const seen = new Map<string, string>();

	for (const thread of threads) {
		const key = thread.content.trim();
		const first = seen.get(key);
		if (first) {
			findings.push({
				code: "thread.duplicateContent",
				detail: { threadId: thread.id, duplicateOf: first, content: key },
			});
		} else {
			seen.set(key, thread.id);
		}

		if (thread.dueIn < thread.plantedIn) {
			findings.push({
				code: "thread.dueBeforePlanted",
				detail: { threadId: thread.id, plantedIn: thread.plantedIn, dueIn: thread.dueIn },
			});
		}
		if (thread.plantedIn > committedMax) {
			findings.push({
				code: "thread.plantedInFuture",
				detail: { threadId: thread.id, plantedIn: thread.plantedIn, committedMax },
			});
		}
		if (thread.status === "open" && thread.dueIn < committedMax) {
			findings.push({
				code: "thread.overdue",
				detail: { threadId: thread.id, dueIn: thread.dueIn, committedMax },
			});
		}
		if (thread.status === "closed" && (thread.closedIn === null || thread.closedIn > committedMax)) {
			findings.push({
				code: "thread.closedWithoutChapter",
				detail: { threadId: thread.id, closedIn: thread.closedIn ?? 0, committedMax },
			});
		}
	}

	const open = threads.filter((thread) => thread.status === "open").length;
	const overdue = findings.filter((finding) => finding.code === "thread.overdue").length;
	const unresolvedRate = threads.length === 0 ? 0 : Math.round((open / threads.length) * 100) / 100;
	return { findings, open, overdue, unresolvedRate };
}

export function openThreads(threads: readonly StoryThread[]): StoryThread[] {
	return sortedByDue(threads.filter((thread) => thread.status === "open"));
}
