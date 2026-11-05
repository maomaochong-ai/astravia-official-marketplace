import {
	DESTINATIONS,
	SITE_ROOT,
	boardmixUrlOf,
	originOf,
	phaseOf,
	type BoardmixPhase,
} from "./boardmix-destinations";

/** 存储里的唯一一份导航状态。schema 变了就加字段，不改名。 */
export const ENTRY_STATE_PATH = "entry/state.json";

export interface EntryState {
	lastGoodUrl: string | null;
	landedAt: string | null;
	/** 人工覆盖：给一个「这个地址请一直用它」的逃生口。 */
	entryUrlOverride: string | null;
}

export const EMPTY_ENTRY_STATE: EntryState = {
	lastGoodUrl: null,
	landedAt: null,
	entryUrlOverride: null,
};

export interface BoardmixSeed {
	/** 1 = 上次落地的真实地址，2 = 工作台根，3 = 站点根。 */
	level: 1 | 2 | 3;
	url: string;
}

/** 工具与界面共用的返回体（见 ADR 0003「统一返回体」）。 */
export interface BoardmixSnapshot {
	open: boolean;
	url: string;
	origin: string;
	phase: BoardmixPhase;
	seedLevel: number;
	landedAt: string | null;
}

export const CLOSED_SNAPSHOT: BoardmixSnapshot = {
	open: false,
	url: "",
	origin: "",
	phase: "unknown",
	seedLevel: 0,
	landedAt: null,
};

export function snapshotOf(url: string, seedLevel: number, landedAt: string | null): BoardmixSnapshot {
	return {
		open: true,
		url,
		origin: originOf(url),
		phase: phaseOf(url),
		seedLevel,
		landedAt,
	};
}

/** 只信 https + boardmix 域的地址；别的字符串一律当成「没有」。 */
export function readEntryState(value: unknown): EntryState {
	if (!value || typeof value !== "object") return EMPTY_ENTRY_STATE;
	const raw = value as Partial<Record<keyof EntryState, unknown>>;
	const lastGood = boardmixUrlOf(raw.lastGoodUrl)?.toString() ?? null;
	const override = boardmixUrlOf(raw.entryUrlOverride)?.toString() ?? null;
	const landedAt = typeof raw.landedAt === "string" && raw.landedAt.length > 0 ? raw.landedAt : null;
	return {
		lastGoodUrl: lastGood,
		landedAt: lastGood ? landedAt : null,
		entryUrlOverride: override,
	};
}

export function serializeEntryState(state: EntryState): EntryState {
	const clean = readEntryState(state);
	return clean;
}

/**
 * 三级种子阶梯。去重后按可信度排序：人工覆盖永远排第一（level 仍是它自己的级），
 * 其次是上次落地的地址，最后是写死的两级根。
 */
export function seedLadder(state: EntryState): BoardmixSeed[] {
	const ordered: BoardmixSeed[] = [];
	const seen = new Set<string>();
	const push = (url: string | null, level: 1 | 2 | 3) => {
		if (!url) return;
		const normalized = boardmixUrlOf(url)?.toString();
		if (!normalized || seen.has(normalized)) return;
		seen.add(normalized);
		ordered.push({ level, url: normalized });
	};
	push(state.entryUrlOverride, 1);
	push(state.lastGoodUrl, 1);
	push(DESTINATIONS.workspace, 2);
	push(SITE_ROOT, 3);
	return ordered;
}

export function nextSeed(ladder: BoardmixSeed[], currentLevel: number): BoardmixSeed | null {
	return ladder.find(seed => seed.level > currentLevel) ?? null;
}

/**
 * `did-fail-load` 里只有主框架的真实失败才算数：子资源失败、用户主动中断（-3 aborted）
 * 都不能把整页判死，否则拖动一下就会掉种子。
 */
export function isFatalLoadFailure(input: {
	isMainFrame?: boolean;
	errorCode?: number;
}): boolean {
	if (input.isMainFrame === false) return false;
	const code = input.errorCode ?? 0;
	return code !== 0 && code !== -3;
}
