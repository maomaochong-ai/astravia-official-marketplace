/**
 * 状态推进：全部是 `(book, 输入, now) → book` 的纯函数。
 *
 * 时间由调用方传入（不允许在领域层读时钟），失败用 Result 值返回（不抛异常）——
 * 工具层需要把失败原因原样交给模型，抛异常会被宿主折叠成通用错误。
 */

import type {
	Arc,
	Chapter,
	ChapterFacts,
	ChapterPlan,
	CheckpointKey,
	Foundation,
	NovelBook,
	NovelPhase,
	OutlineFeedback,
	ReviewReport,
	Volume,
} from "./novel-types.js";
import { PASS_SCORE, arcForChapter } from "./novel-flow.js";

export type ProgressResult =
	| { ok: true; book: NovelBook }
	| { ok: false; error: string };

function fail(error: string): ProgressResult {
	return { ok: false, error };
}

function withBook(book: NovelBook, patch: Partial<NovelBook>, now: string): NovelBook {
	return { ...book, ...patch, updatedAt: now };
}

function checkpoint(
	book: NovelBook,
	chapter: number,
	noteKey: CheckpointKey,
	now: string,
	noteParams?: Record<string, string | number>,
) {
	const entry = noteParams ? { at: now, chapter, phase: book.phase, noteKey, noteParams } : { at: now, chapter, phase: book.phase, noteKey };
	return [...book.checkpoints, entry].slice(-40);
}

export interface NewBookInput {
	id: string;
	title: string;
	genre: string;
	premise: string;
	targetChapters: number;
	styleSample?: string;
}

export function createBook(input: NewBookInput, now: string): NovelBook {
	return {
		schemaVersion: 1,
		id: input.id,
		title: input.title.trim(),
		genre: input.genre.trim(),
		premise: input.premise.trim(),
		targetChapters: input.targetChapters,
		styleSample: input.styleSample?.trim() ?? "",
		phase: "briefing",
		volumes: [],
		chapters: [],
		foundation: null,
		cast: [],
		userRules: {},
		plans: [],
		feedback: [],
		summaries: { arcs: [], volumes: [] },
		progress: { currentChapter: 1, committedCount: 0, pendingRewrite: [] },
		checkpoints: [{ at: now, chapter: 0, phase: "briefing", noteKey: "checkpoint.openBook" }],
		createdAt: now,
		updatedAt: now,
	};
}

/** 定题完成：题材/前提/目标章数齐备后进入规划。 */
export function acceptBrief(book: NovelBook, now: string): ProgressResult {
	if (book.phase !== "briefing") return fail(`phase is ${book.phase}, brief already accepted`);
	if (!book.title || !book.genre || !book.premise) {
		return fail("title, genre and premise must all be non-empty");
	}
	if (book.targetChapters < 1) return fail("targetChapters must be >= 1");
	const next: NovelBook = withBook(book, { phase: "planning" }, now);
	return { ok: true, book: { ...next, checkpoints: checkpoint(next, 0, "checkpoint.briefAccepted", now) } };
}

/**
 * 落一卷（含弧）。规划阶段可以多次调用：先落卷 1 的弧 1，再逐步补弧。
 * 章节在提交时才创建，规划阶段只定义 `from`/`to` 边界。
 */
export function saveVolumePlan(book: NovelBook, volume: Volume, now: string): ProgressResult {
	if (book.phase !== "planning" && book.phase !== "drafting") {
		return fail(`phase is ${book.phase}, volume planning is not open`);
	}
	if (!volume.id || !volume.title) return fail("volume id and title must be non-empty");
	if (volume.arcs.length === 0) return fail("volume must contain at least one arc");
	for (const arc of volume.arcs) {
		if (arc.from < 1 || arc.to < arc.from) return fail(`arc ${arc.id} has an invalid range`);
		if (arc.to > book.targetChapters) {
			return fail(`arc ${arc.id} ends at ${arc.to}, beyond targetChapters ${book.targetChapters}`);
		}
	}
	const others = book.volumes.filter((item) => item.id !== volume.id);
	const overlaps = others.some((item) =>
		item.arcs.some((existing) => volume.arcs.some((arc) => arc.from <= existing.to && existing.from <= arc.to)),
	);
	if (overlaps) return fail("arc ranges must not overlap existing volumes");

	const volumes = [...others, volume].sort((a, b) => a.arcs[0].from - b.arcs[0].from);
	const phase: NovelPhase = book.phase === "planning" ? "planning" : book.phase;
	const next = withBook(book, { volumes, phase }, now);
	return { ok: true, book: { ...next, checkpoints: checkpoint(next, 0, "checkpoint.volumePlanned", now, { title: volume.title }) } };
}

/** 开写：规划阶段至少有一卷之后才能进 drafting。 */
export function startDrafting(book: NovelBook, now: string): ProgressResult {
	if (book.phase !== "planning") return fail(`phase is ${book.phase}, not planning`);
	if (book.volumes.length === 0) return fail("no volume planned yet");
	const next = withBook(book, { phase: "drafting" }, now);
	return { ok: true, book: { ...next, checkpoints: checkpoint(next, 0, "checkpoint.draftingStarted", now) } };
}

function upsertChapter(book: NovelBook, chapter: Chapter): Chapter[] {
	const rest = book.chapters.filter((item) => item.n !== chapter.n);
	return [...rest, chapter].sort((a, b) => a.n - b.n);
}

/** 章纲：只写标题与所属弧，不动正文。 */
export function saveChapterOutline(
	book: NovelBook,
	input: { n: number; title: string },
	now: string,
): ProgressResult {
	const arc = arcForChapter(book.volumes, input.n);
	if (!arc) return fail(`chapter ${input.n} is not covered by any planned arc`);
	if (!input.title.trim()) return fail("chapter title must be non-empty");
	const existing = book.chapters.find((item) => item.n === input.n);
	if (existing && existing.status === "committed") {
		return fail(`chapter ${input.n} is committed, outlines are frozen`);
	}
	const chapter: Chapter = {
		n: input.n,
		title: input.title.trim(),
		arcId: arc.id,
		// 章纲只改标题，不改正文。已有进度只升不降：把 reviewed/drafting 退回 planned
		// 会让一章白评（reviewScore 还留着，状态却说"没写过"），是静默的数据损失。
		status: existing ? existing.status : "planned",
		words: existing?.words ?? 0,
		reviewScore: existing?.reviewScore ?? null,
		facts: existing?.facts ?? null,
		updatedAt: now,
	};
	return { ok: true, book: withBook(book, { chapters: upsertChapter(book, chapter) }, now) };
}

/** 存正文：只更新字数与状态，正文本身由仓储单独写（ADR 0005）。 */
export function saveChapterDraft(
	book: NovelBook,
	input: { n: number; words: number },
	now: string,
): ProgressResult {
	const existing = book.chapters.find((item) => item.n === input.n);
	if (!existing) return fail(`chapter ${input.n} has no outline yet`);
	if (existing.status === "committed") return fail(`chapter ${input.n} is committed`);
	if (input.words < 200) return fail("draft is shorter than 200 words, treat it as a sketch");
	const chapter: Chapter = {
		...existing,
		status: "drafting",
		words: input.words,
		reviewScore: null,
		updatedAt: now,
	};
	return { ok: true, book: withBook(book, { chapters: upsertChapter(book, chapter) }, now) };
}

/** 存评审：必改项非空或分数不够，一律 blocked，不给人情分。 */
export function saveChapterReview(book: NovelBook, report: ReviewReport, now: string): ProgressResult {
	const existing = book.chapters.find((item) => item.n === report.chapter);
	if (!existing) return fail(`chapter ${report.chapter} has no outline yet`);
	if (existing.status === "committed") return fail(`chapter ${report.chapter} is committed`);
	if (report.dimensions.length !== 7) return fail("review must cover all 7 dimensions");

	const passed = report.mustFix.length === 0 && report.score >= PASS_SCORE;
	const chapter: Chapter = {
		...existing,
		status: passed ? "reviewed" : "blocked",
		reviewScore: report.score,
		updatedAt: now,
	};
	const pendingRewrite = passed
		? book.progress.pendingRewrite.filter((n) => n !== report.chapter)
		: [...new Set([...book.progress.pendingRewrite, report.chapter])].sort((a, b) => a - b);
	return {
		ok: true,
		book: withBook(
			book,
			{
				chapters: upsertChapter(book, chapter),
				phase: passed ? "drafting" : "revising",
				progress: { ...book.progress, pendingRewrite },
			},
			now,
		),
	};
}

/**
 * 提交一章。这是唯一推进 `committedCount` 的入口，也是阶段转移的唯一点：
 * 写完目标章数 → completed；刚好结束一个弧 → arc_close；否则留在 drafting。
 */
export function commitChapter(book: NovelBook, n: number, now: string): ProgressResult {
	const existing = book.chapters.find((item) => item.n === n);
	if (!existing) return fail(`chapter ${n} does not exist`);
	// 已提交过的章：只修指针，不重复计数。路由把"指针落后于事实"也发到这里（`reason.pointerDrift`），
	// 所以这条指令必须能真的推进；否则那条 reason 就是一句永远做不到的话。
	if (existing.status === "committed") {
		if (book.progress.currentChapter > n || n >= book.targetChapters) {
			return fail(`chapter ${n} is already committed`);
		}
		return { ok: true, book: withBook(book, { progress: { ...book.progress, currentChapter: n + 1 } }, now) };
	}
	if (existing.status !== "reviewed") {
		return fail(`chapter ${n} is ${existing.status}, only a passed review can be committed`);
	}

	const chapter: Chapter = { ...existing, status: "committed", updatedAt: now };
	const committedCount = book.progress.committedCount + 1;
	const nextChapter = n + 1;
	const arc = arcForChapter(book.volumes, n);
	const hasMore = committedCount < book.targetChapters;

	let phase: NovelPhase;
	if (!hasMore) {
		phase = "completed";
	} else if (arc && arc.to === n) {
		phase = "arc_close";
	} else {
		phase = "drafting";
	}

	const next = withBook(
		book,
		{
			chapters: upsertChapter(book, chapter),
			phase,
			progress: {
				currentChapter: hasMore ? nextChapter : n,
				committedCount,
				pendingRewrite: book.progress.pendingRewrite.filter((item) => item !== n),
			},
		},
		now,
	);
	return { ok: true, book: { ...next, checkpoints: checkpoint(next, n, "checkpoint.chapterCommitted", now, { n }) } };
}

/** 收弧：写弧总结，然后把阶段交回 drafting（还有下一弧）或 planning（弧用完了）。 */
export function closeArc(book: NovelBook, now: string): ProgressResult {
	if (book.phase !== "arc_close") return fail(`phase is ${book.phase}, no arc to close`);
	const closedChapter = book.progress.currentChapter - 1;
	const closedArc = arcForChapter(book.volumes, closedChapter);
	const nextArc = book.volumes
		.flatMap((volume) => volume.arcs)
		.find((arc) => arc.from > closedChapter);

	const phase: NovelPhase = nextArc ? "drafting" : "planning";
	const next = withBook(book, { phase }, now);
	return {
		ok: true,
		book: {
			...next,
			checkpoints: checkpoint(next, closedChapter, "checkpoint.arcClosed", now, { title: closedArc?.title ?? String(closedChapter) }),
		},
	};
}

/** 完本收尾：写后记并冻结作品。 */
export function finalizeBook(book: NovelBook, now: string): ProgressResult {
	if (book.progress.committedCount < book.targetChapters) {
		return fail(`only ${book.progress.committedCount}/${book.targetChapters} chapters committed`);
	}
	const next = withBook(book, { phase: "completed" }, now);
	return { ok: true, book: { ...next, checkpoints: checkpoint(next, book.progress.currentChapter, "checkpoint.finished", now) } };
}

export function currentChapter(book: NovelBook): Chapter | null {
	return book.chapters.find((item) => item.n === book.progress.currentChapter) ?? null;
}

/** 基础设定：整份替换，缺项由 audit_foundation 报，不在写入时就报错（规划允许逐步补齐）。 */
export function saveFoundation(
	book: NovelBook,
	foundation: Foundation,
	cast: readonly string[],
	now: string,
): ProgressResult {
	if (book.phase === "completed") return fail("book is completed, foundation is frozen");
	const trimmed = cast.map((name) => name.trim()).filter((name) => name.length > 0);
	const next = withBook(book, { foundation, cast: [...new Set(trimmed)] }, now);
	return { ok: true, book: next };
}

/** 用户写作规则：只保存归一化后的固定字段。 */
export function saveUserRules(
	book: NovelBook,
	rules: Record<string, string | number | string[]>,
	now: string,
): ProgressResult {
	return { ok: true, book: withBook(book, { userRules: rules }, now) };
}

/** 章前计划：一章一份，重写覆盖。已提交的章不允许再改计划（历史归历史）。 */
export function saveChapterPlan(book: NovelBook, plan: ChapterPlan, now: string): ProgressResult {
	const chapter = book.chapters.find((item) => item.n === plan.n) ?? null;
	if (!chapter) return fail(`chapter ${plan.n} has no outline yet`);
	if (chapter.status === "committed") return fail(`chapter ${plan.n} is committed, its plan is history`);
	if (!arcForChapter(book.volumes, plan.n)) return fail(`chapter ${plan.n} is not covered by any planned arc`);
	const plans = [...book.plans.filter((item) => item.n !== plan.n), { ...plan, at: now }].sort((a, b) => a.n - b.n);
	return { ok: true, book: withBook(book, { plans }, now) };
}

/** 存正文时顺带落事实。没有事实字段的老书读出来是 undefined，这里统一补 null。 */
export function attachChapterFacts(book: NovelBook, n: number, facts: ChapterFacts | null, now: string): NovelBook {
	const existing = book.chapters.find((item) => item.n === n);
	if (!existing) return book;
	const chapter: Chapter = { ...existing, facts, updatedAt: now };
	return withBook(book, { chapters: upsertChapter(book, chapter) }, now);
}

/** 弧摘要：弧关闭时的交付物，重写覆盖。 */
export function saveArcSummary(book: NovelBook, arcId: string, summary: string, now: string): ProgressResult {
	const exists = book.volumes.some((volume) => volume.arcs.some((arc) => arc.id === arcId));
	if (!exists) return fail(`arc ${arcId} does not exist`);
	if (!summary.trim()) return fail("summary must be non-empty");
	const arcs = [...book.summaries.arcs.filter((item) => item.arcId !== arcId), { arcId, summary: summary.trim(), at: now }];
	return { ok: true, book: withBook(book, { summaries: { ...book.summaries, arcs } }, now) };
}

/** 卷摘要：卷末交付物。 */
export function saveVolumeSummary(
	book: NovelBook,
	volumeId: string,
	summary: string,
	now: string,
): ProgressResult {
	const exists = book.volumes.some((volume) => volume.id === volumeId);
	if (!exists) return fail(`volume ${volumeId} does not exist`);
	if (!summary.trim()) return fail("summary must be non-empty");
	const volumes = [
		...book.summaries.volumes.filter((item) => item.volumeId !== volumeId),
		{ volumeId, summary: summary.trim(), at: now },
	];
	return { ok: true, book: withBook(book, { summaries: { ...book.summaries, volumes } }, now) };
}

/** 扩弧：给已有卷续接一弧。区间必须接在当前卷最后一弧之后，且不超过目标章数。 */
export function expandArc(book: NovelBook, volumeId: string, arc: Arc, now: string): ProgressResult {
	const volume = book.volumes.find((item) => item.id === volumeId);
	if (!volume) return fail(`volume ${volumeId} does not exist`);
	if (book.phase !== "planning" && book.phase !== "drafting" && book.phase !== "arc_close") {
		return fail(`phase is ${book.phase}, arc expansion is not open`);
	}
	if (arc.to > book.targetChapters) return fail(`arc ends at ${arc.to}, beyond targetChapters ${book.targetChapters}`);
	if (arc.from < 1 || arc.to < arc.from) return fail(`arc ${arc.id} has an invalid range`);

	const others = book.volumes.filter((item) => item.id !== volumeId).flatMap((item) => item.arcs);
	const clash = [...volume.arcs, ...others].some((existing) => arc.from <= existing.to && existing.from <= arc.to);
	if (clash) return fail(`arc ${arc.id} overlaps an existing arc`);
	if (book.chapters.some((chapter) => chapter.n >= arc.from && chapter.n <= arc.to)) {
		return fail(`chapters ${arc.from}-${arc.to} already exist, expand a fresh range`);
	}

	const volumes = book.volumes.map((item) =>
		item.id === volumeId ? { ...item, arcs: [...item.arcs, arc].sort((a, b) => a.from - b.from) } : item,
	);
	return { ok: true, book: withBook(book, { volumes }, now) };
}

/** 尾段替换的入参：从 `fromChapter` 起逐章列出新章纲。 */
export interface OutlineTailInput {
	fromChapter: number;
	replacement: { chapter: number; title: string }[];
}

/**
 * 大纲尾段替换（对齐上游 `revise_outline`）：从 `fromChapter` 起整段换成 `replacement`。
 *
 * 只允许动「还没发生」的章。有正文的章（drafting / reviewed / committed / blocked）一律不许越过——
 * 那不是重排计划，那是把已写的稿子作废，必须走单章修订并留下裁定。
 */
export function reviseOutlineTail(book: NovelBook, input: OutlineTailInput, now: string): ProgressResult {
	if (book.phase !== "planning" && book.phase !== "drafting") {
		return fail(`phase is ${book.phase}, outline revision is not open`);
	}
	const from = input.fromChapter;
	if (!Number.isInteger(from) || from < 1) return fail("fromChapter must be a positive integer");
	if (from > book.targetChapters) return fail(`fromChapter ${from} is beyond targetChapters ${book.targetChapters}`);
	if (input.replacement.length === 0) return fail("replacement must not be empty");

	for (const [index, item] of input.replacement.entries()) {
		if (item.chapter !== from + index) {
			return fail(`replacement chapter ${item.chapter} is out of order, expected ${from + index}`);
		}
		if (!item.title.trim()) return fail(`chapter ${item.chapter} needs a title`);
		if (item.chapter > book.targetChapters) {
			return fail(`chapter ${item.chapter} is beyond targetChapters ${book.targetChapters}`);
		}
		if (!arcForChapter(book.volumes, item.chapter)) {
			return fail(`chapter ${item.chapter} is not covered by any planned arc`);
		}
	}

	const tail = book.chapters.filter((chapter) => chapter.n >= from);
	const moved = tail.find((chapter) => chapter.status !== "planned");
	if (moved) {
		return fail(`chapter ${moved.n} is ${moved.status}, cannot revise the outline from chapter ${from}`);
	}

	const chapters: Chapter[] = input.replacement.map((item) => ({
		n: item.chapter,
		title: item.title.trim(),
		arcId: arcForChapter(book.volumes, item.chapter)!.id,
		status: "planned",
		words: 0,
		reviewScore: null,
		facts: null,
		updatedAt: now,
	}));

	return {
		ok: true,
		book: withBook(
			book,
			{
				chapters: [...book.chapters.filter((chapter) => chapter.n < from), ...chapters],
				// 章前计划是照着旧章纲写的，尾段换过之后不再成立。
				plans: book.plans.filter((plan) => plan.n < from),
			},
			now,
		),
	};
}

/** 收到一条大纲反馈。同一章的开放反馈合并成一条，避免同一意见被记十遍。 */
export function recordFeedback(
	book: NovelBook,
	input: { chapter: number; note: string },
	now: string,
): ProgressResult {
	if (!input.note.trim()) return fail("feedback note must be non-empty");
	if (!Number.isInteger(input.chapter) || input.chapter < 1) return fail("chapter must be a positive integer");
	const id = `fb-${book.feedback.length + 1}`;
	const entry: OutlineFeedback = {
		id,
		chapter: input.chapter,
		note: input.note.trim(),
		status: "open",
		at: now,
	};
	const open = book.feedback.find(
		(item) => item.status === "open" && item.chapter === input.chapter && item.note === entry.note,
	);
	if (open) return { ok: true, book };
	return { ok: true, book: withBook(book, { feedback: [...book.feedback, entry] }, now) };
}

/** 反馈处置：accepted 原样采纳，revised 表示章纲已按意见改过，rejected 记录驳回理由。 */
export function resolveFeedback(
	book: NovelBook,
	input: { id: string; disposition: "accepted" | "revised" | "rejected"; resolution?: string },
	now: string,
): ProgressResult {
	const entry = book.feedback.find((item) => item.id === input.id);
	if (!entry) return fail(`feedback ${input.id} does not exist`);
	if (entry.status === "resolved") return fail(`feedback ${input.id} is already resolved`);
	if (input.disposition === "rejected" && !input.resolution?.trim()) {
		return fail("a rejection needs a resolution note");
	}
	const feedback = book.feedback.map((item) =>
		item.id === input.id
			? { ...item, status: "resolved" as const, disposition: input.disposition, resolution: input.resolution?.trim(), at: now }
			: item,
	);
	return { ok: true, book: withBook(book, { feedback }, now) };
}

/** 重开：已完本的书可以被追写。回到 drafting，目标章数按新目标抬高。 */
export function reopenBook(book: NovelBook, targetChapters: number, now: string): ProgressResult {
	if (book.phase !== "completed") return fail(`phase is ${book.phase}, only a completed book can be reopened`);
	if (!Number.isInteger(targetChapters) || targetChapters <= book.progress.committedCount) {
		return fail(`targetChapters must exceed ${book.progress.committedCount} committed chapters`);
	}
	// 定稿那一步把指针留在了最后一章（`commitChapter` 的 `hasMore ? n + 1 : n`），直接重开会让路由
	// 把指针指到已提交章——那条 pointerDrift 指令只会撞上提交守卫。重开应当把指针抬到下一章。
	const resumeAt = book.progress.committedCount + 1;
	const next = withBook(
		book,
		{ phase: "drafting", targetChapters, progress: { ...book.progress, currentChapter: resumeAt } },
		now,
	);
	return {
		ok: true,
		book: {
			...next,
			checkpoints: checkpoint(next, resumeAt, "checkpoint.draftingStarted", now),
		},
	};
}
