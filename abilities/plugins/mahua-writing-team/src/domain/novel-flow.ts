/**
 * 确定性路由：`routeNovel(state) → Instruction | null`。
 *
 * 这是 ADR 0001 里"可枚举的状态迁移交给代码"的那一半。三条纪律：
 * 1. 纯函数 —— 不读存储、不取时间、不调模型，同样的输入永远同样的输出；
 * 2. 只输出意图 —— 返回"该由谁、做什么、为什么"，不返回"去调用某个工具"；
 * 3. 返回 null 表示没有可推进的下一步（完本，或等人干预）。
 *
 * 说明文案只给 catalog key + 参数：这里不出任何自然语言，英文/中文由调用方
 * （界面用 `useTranslation`，工具用 `ctx.i18n`）各自解析。
 */

import type { Arc, Chapter, Instruction, NovelBook } from "./novel-types.js";

/** 评审总分达到该值才允许提交。低于它一律进修订，不看模型的主观"我觉得可以了"。 */
export const PASS_SCORE = 72;

export interface RouteFacts {
	phase: NovelBook["phase"];
	targetChapters: number;
	progress: NovelBook["progress"];
	chapters: readonly Chapter[];
	volumes: readonly VolumeLike[];
}

export interface VolumeLike {
	arcs: readonly Arc[];
}

function chapterAt(chapters: readonly Chapter[], n: number): Chapter | undefined {
	return chapters.find((chapter) => chapter.n === n);
}

/** 章序 → 所属弧。路由与推进共用这一份实现，避免两处「弧归属」悄悄分叉。 */
export function arcForChapter(volumes: readonly VolumeLike[], n: number): Arc | null {
	for (const volume of volumes) {
		for (const arc of volume.arcs) {
			if (n >= arc.from && n <= arc.to) return arc;
		}
	}
	return null;
}


export function routeNovel(state: RouteFacts): Instruction | null {
	const { phase, progress, chapters, volumes, targetChapters } = state;

	if (phase === "completed") return null;
	if (progress.committedCount >= targetChapters) {
		return { worker: "engine", task: "finalize", chapter: null, reasonKey: "reason.targetReached" };
	}

	if (phase === "briefing") {
		return {
			worker: "architect",
			task: "brief",
			chapter: null,
			reasonKey: "reason.briefMissing",
		};
	}

	if (phase === "planning") {
		// 弧表为空不是"都规划完了"。新书接受过 brief 之后就在这个状态，此时必须先铺第一弧，
		// 否则会去发 `outline-chapter`，而建章纲要求章节落在已规划的弧里——第一步就走不下去。
		if (volumes.every((volume) => volume.arcs.length === 0)) {
			return {
				worker: "architect",
				task: "plan-arc",
				chapter: progress.currentChapter,
				reasonKey: "reason.noArcYet",
				reasonParams: { chapter: progress.currentChapter },
			};
		}

		// 弧已存在但指针所在的章还不在任何弧里（追写 / 重开）：先补弧，别去建一张注定被拒的章纲。
		if (!arcForChapter(volumes, progress.currentChapter)) {
			return {
				worker: "architect",
				task: "plan-arc",
				chapter: progress.currentChapter,
				reasonKey: "reason.arcUncovered",
				reasonParams: { chapter: progress.currentChapter },
			};
		}

		// 规划阶段只做两件事：铺弧、写章纲。章纲齐了就不推进——正文的开头由作者按下
		// 「开始写作」（`startDrafting`）决定，路由不替人做这个别离决定。
		const planned = chapterAt(chapters, progress.currentChapter);
		if (!planned || planned.title.trim().length === 0) {
			return {
				worker: "architect",
				task: "outline-chapter",
				chapter: progress.currentChapter,
				reasonKey: "reason.chapterUnplanned",
				reasonParams: { chapter: progress.currentChapter },
			};
		}
		return null;
	}

	if (phase === "arc_close") {
		const arc = arcForChapter(volumes, progress.currentChapter - 1);
		return {
			worker: "engine",
			task: "close-arc",
			chapter: arc ? arc.to : progress.currentChapter - 1,
			reasonKey: "reason.arcEnded",
		};
	}

	// 指针走出了弧的覆盖范围（重开追写、弧被改小）：补弧，而不是发一条写不了的指令。
	if (!arcForChapter(volumes, progress.currentChapter)) {
		return {
			worker: "architect",
			task: "plan-arc",
			chapter: progress.currentChapter,
			reasonKey: "reason.arcUncovered",
			reasonParams: { chapter: progress.currentChapter },
		};
	}

	const current = chapterAt(chapters, progress.currentChapter);

	if (!current || current.title.trim().length === 0) {
		return {
			worker: "architect",
			task: "outline-chapter",
			chapter: progress.currentChapter,
			reasonKey: "reason.chapterUnplanned",
			reasonParams: { chapter: progress.currentChapter },
		};
	}

	switch (current.status) {
		case "planned":
			return {
				worker: "writer",
				task: "draft-chapter",
				chapter: current.n,
				reasonKey: "reason.chapterAwaitingDraft",
				reasonParams: { chapter: current.n },
			};
		case "blocked":
			return {
				worker: "writer",
				task: "revise-chapter",
				chapter: current.n,
				reasonKey: "reason.chapterBlocked",
				reasonParams: { chapter: current.n },
			};
		case "drafting":
			return {
				worker: "editor",
				task: "review-chapter",
				chapter: current.n,
				reasonKey: "reason.chapterAwaitingReview",
				reasonParams: { chapter: current.n },
			};
		case "reviewed": {
			const score = current.reviewScore ?? 0;
			if (score < PASS_SCORE) {
				return {
					worker: "writer",
					task: "revise-chapter",
					chapter: current.n,
					reasonKey: "reason.belowPass",
					reasonParams: { chapter: current.n, score, pass: PASS_SCORE },
				};
			}
			return {
				worker: "engine",
				task: "commit-chapter",
				chapter: current.n,
				reasonKey: "reason.readyToCommit",
				reasonParams: { chapter: current.n, score },
			};
		}
		case "committed":
			// 提交后 currentChapter 已自增；走到这里说明进度指针落后于事实，让 engine 对齐。
			return {
				worker: "engine",
				task: "commit-chapter",
				chapter: current.n,
				reasonKey: "reason.pointerDrift",
			};
	}
}
