/**
 * Novelwright 的领域类型。
 *
 * 与 ainovel-cli 的事实层一一对应：Progress / Checkpoint / Artifact 在这里分别落到
 * `progress` / `checkpoints` / `chapters` + 卷弧计划。类型是唯一真相源，任何"状态"都必须
 * 能用这里的字段表达，不引入额外的工作流实例抽象（见 ADR 0001）。
 */

/** 作品级阶段。转移规则集中在 novel-flow.ts，本文件只声明取值。 */
export type NovelPhase =
	| "briefing"
	| "planning"
	| "drafting"
	| "revising"
	| "arc_close"
	| "completed";

/** 章节状态机：planned → drafting → reviewed → committed。blocked 是评审判定不可提交时的落点。 */
export type ChapterStatus = "planned" | "drafting" | "reviewed" | "committed" | "blocked";

/** 执行者。engine 是确定性步骤（提交、收弧、推进），不需要模型参与。 */
export type WorkerId = "architect" | "writer" | "editor" | "arbiter" | "engine";

export interface Arc {
	id: string;
	title: string;
	/** 弧目标：这一弧结束时必须发生的事。 */
	goal: string;
	/** 起始章（含）。 */
	from: number;
	/** 结束章（含）。 */
	to: number;
}

export interface Volume {
	id: string;
	title: string;
	/** 卷目标 + 卷末钩子，写作时当作硬约束。 */
	goal: string;
	hook: string;
	arcs: Arc[];
}

export interface ReviewDimension {
	key: "plot" | "character" | "pacing" | "prose" | "dialogue" | "continuity" | "hook";
	score: number;
	note: string;
}

export interface ReviewReport {
	chapter: number;
	/** 七维加权总分，0–100。 */
	score: number;
	dimensions: ReviewDimension[];
	/** 必改项：修订阶段逐条消耗。空数组才允许提交。 */
	mustFix: string[];
	reviewedAt: string;
}

/** 章前计划：写正文前一页意图。写完即历史，不参与路由。 */
export interface ChapterPlan {
	n: number;
	goal: string;
	conflict: string;
	hook: string;
	at: string;
}

/** 从正文里确定性抽出的章级事实（对应上游 chapterfacts）。 */
export interface ChapterFacts {
	/** 在演员表里出现过的角色名，去重保序。 */
	characters: string[];
	/** 首句与末句：开篇钩子与收尾钩子的原始证据。 */
	opening: string;
	closing: string;
}

export interface Chapter {
	/** 全书章序，从 1 开始。 */
	n: number;
	title: string;
	arcId: string;
	status: ChapterStatus;
	/** 正文字数（不含标记）。 */
	words: number;
	reviewScore: number | null;
	/** 存正文时顺带落盘的事实；没有正文时为 null。 */
	facts: ChapterFacts | null;
	updatedAt: string;
}

/**
 * 伏笔台账的一笔（ADR 0021）。存在独立的 `threads/<bookId>.json`，不进 `NovelBook`。
 * `weight` 三层与「浅/中/重」伏笔一一对应，决定它该被提几次。
 */
export type ThreadWeight = "light" | "medium" | "heavy";

export interface StoryThread {
	id: string;
	content: string;
	/** 埋点章号（1-based）。 */
	plantedIn: number;
	/** 承诺的回收章号；不写「以后再说」。 */
	dueIn: number;
	weight: ThreadWeight;
	status: "open" | "closed";
	/** 实际回收章号；只与 `status: "closed"` 共存。 */
	closedIn: number | null;
}

export type ThreadFindingCode =
	| "thread.plantedInFuture"
	| "thread.dueBeforePlanted"
	| "thread.overdue"
	| "thread.closedWithoutChapter"
	| "thread.duplicateContent";

/** 台账体检的一条结果。与 `Finding` 同构；code 交给模型与界面自己解释。 */
export interface ThreadFinding {
	code: ThreadFindingCode;
	detail: Record<string, string | number>;
}

/** 账本里的每一次推进写的是 key，不是句子：换语言、改措辞都不必迁移已存的稿件。 */
export type CheckpointKey =
	| "checkpoint.openBook"
	| "checkpoint.briefAccepted"
	| "checkpoint.volumePlanned"
	| "checkpoint.draftingStarted"
	| "checkpoint.chapterCommitted"
	| "checkpoint.arcClosed"
	| "checkpoint.finished";

export interface Checkpoint {
	at: string;
	chapter: number;
	phase: NovelPhase;
	noteKey: CheckpointKey;
	noteParams?: Record<string, string | number>;
}

/** 基础设定六项。任一项为空都算缺项（audit_foundation 的判据）。 */
export interface Foundation {
	theme: string;
	conflict: string;
	protagonist: string;
	ending: string;
	taboo: string;
	hook: string;
}

/** 大纲反馈池条目：只允许 open / resolved 两态，处置是封闭枚举。 */
export interface OutlineFeedback {
	id: string;
	chapter: number;
	note: string;
	status: "open" | "resolved";
	disposition?: "accepted" | "revised" | "rejected";
	resolution?: string;
	at: string;
}

export interface ArcSummary {
	arcId: string;
	summary: string;
	at: string;
}

export interface VolumeSummary {
	volumeId: string;
	summary: string;
	at: string;
}

/** 风格统计：数值全部是确定性计算的，不含模型判断。 */
export interface StyleStats {
	chapters: number;
	words: number;
	sentences: number;
	/** 平均句长（按各语言自身的句子切分口径）。 */
	avgSentence: number;
	dialogueRatio: number;
	paragraphs: number;
	topPhrases: { phrase: string; count: number }[];
}

export type FindingSeverity = "error" | "warning" | "info";

/** 一条可执行的问题。code 是 catalog key，界面与工具各自解析。 */
export interface Finding {
	code: string;
	severity: FindingSeverity;
	detail?: string;
}

export interface NovelBook {
	schemaVersion: 1;
	id: string;
	title: string;
	/** 题材 + 目标读者，一句话。 */
	genre: string;
	/** 一句话前提（logline）。 */
	premise: string;
	/** 目标章数，上游默认 200–500。 */
	targetChapters: number;
	/** 风格样本：作者可粘贴一段范文，写作时作为语感参照。 */
	styleSample: string;
	phase: NovelPhase;
	volumes: Volume[];
	chapters: Chapter[];
	foundation: Foundation | null;
	/** 演员表：章节事实只在此表内匹配角色。 */
	cast: string[];
	/** 归一化后的用户写作规则（禁用词、人称、字数区间等）。 */
	userRules: Record<string, string | number | string[]>;
	plans: ChapterPlan[];
	feedback: OutlineFeedback[];
	summaries: { arcs: ArcSummary[]; volumes: VolumeSummary[] };
	progress: {
		currentChapter: number;
		committedCount: number;
		/** 需要重写的章序列表。 */
		pendingRewrite: number[];
	};
	checkpoints: Checkpoint[];
	createdAt: string;
	updatedAt: string;
}

/** 路由输出。只有 worker + task + 理由，不含"接下来请调用 X"这类跨调度指令。 */
export interface Instruction {
	worker: WorkerId;
	task: InstructionTask;
	chapter: number | null;
	/** catalog key，例如 `reason.arcUncovered`；界面与工具各自把它解析成当前语言。 */
	reasonKey: string;
	reasonParams?: Record<string, string | number>;
}

export type InstructionTask =
	| "brief"
	| "plan-arc"
	| "outline-chapter"
	| "draft-chapter"
	| "review-chapter"
	| "revise-chapter"
	| "commit-chapter"
	| "close-arc"
	| "finalize";

/** 裁定场景是封闭枚举，不允许自由发挥（对应上游 arbiter 的逐场景 Decide 函数）。 */
export type ArbitrationScenario = "premise-conflict" | "deadlock" | "user-intervention";

export interface ArbitrationRecord {
	at: string;
	scenario: ArbitrationScenario;
	question: string;
	decision: string;
	rationale: string;
}
