/**
 * 工作台会话持久化 — 跨插件重载/重挂载恢复现场。
 *
 * 存的是「用户正在编辑的工作状态」（不是查询结果）：
 * 活动连接、打开的查询 tab 及其 SQL、活动 tab、展开的树节点、三栏宽度、左栏折叠态。
 * 结果数据（查询返回的 rows）体积大且会过期，不入库。
 * 唯一的例外是可视化 tab 的产物快照：预览无法从别处重建，故连 HTML 与图表数据一起存，
 * 体积由可视化仓库的条数上限约束。
 *
 * 这是修复「重载插件后界面全部改变/重置」的关键：module federation 重新
 * 挂载时内存状态全部清空，会话必须从宿主存储恢复，行为对齐标准桌面应用。
 *
 * 写入模型：**单写者 + 按字段合并**。会话文档有多个互不相关的写入方
 * （tab 自动保存、三栏宽度、左栏折叠态）。早期实现各自「读全文 → 覆盖写回」，
 * 自动保存只带 tab 字段，会把其它写入方的布局字段整块抹掉（拖过的栏宽最多活过一次重载），
 * 并发写入之间还会互相丢更新。现在所有写入统一走 patchSession：只合并自己负责的字段，
 * 且同一进程内的「读 → 合并 → 写」串行执行，避免交错覆盖。
 */

import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import { getStorage } from "../runtime-contract.ts";
import type { Visualization } from "./chart-contract";

const SESSION_PATH = "workbench-session.json";

/** 一个查询 tab 的最小持久化形态（不含结果/运行态）。 */
export interface StoredTab {
	id: string;
	label: string;
	connectionName: string | null;
	sql: string;
	/** 可视化产物（与 tools 侧同源：domain/visualization；画廊等瞬时 tab 不入库）。 */
	visualization?: Visualization;
}

export interface StoredSession {
	activeConnectionName: string | null;
	activeTabId: string | null;
	tabs: StoredTab[];
	expandedNodes: string[];
	/** 三栏像素宽度；未拖过时为空，按比例初始化。 */
	leftW?: number;
	rightW?: number;
	leftCollapsed?: boolean;
}

/** 会话字段的增量更新；只覆盖显式给出的字段（undefined 视为「不修改」）。 */
export type SessionPatch = Partial<StoredSession>;

/** 无会话文件时的空文档（与调用方原回退值一致）。 */
export const EMPTY_SESSION: StoredSession = {
	activeConnectionName: null,
	activeTabId: null,
	tabs: [],
	expandedNodes: [],
};

/** 只接受结构可信的文档；损坏时按「无会话」处理，调用方回退默认初始态。 */
function normalizeSession(doc: StoredSession | null | undefined): StoredSession | null {
	if (!doc || !Array.isArray(doc.tabs)) return null;
	return doc;
}

/**
 * 读取会话；不存在或损坏时返回 null（调用方回退到默认初始态）。
 * 每次调用都取当前存储内容：外部（另一个窗口/进程）改动可见。
 */
export async function readSession(): Promise<StoredSession | null> {
	try {
		return normalizeSession(await readJsonFile<StoredSession>(getStorage(), SESSION_PATH));
	} catch {
		return null;
	}
}

/**
 * 全量写会话（底层原语）。落盘失败由调用方吞掉，不能因持久化打断主操作。
 * 一般应改用 patchSession，避免抹掉其它写入方负责的字段。
 */
export async function writeSession(session: StoredSession): Promise<void> {
	await writeJsonFile(getStorage(), SESSION_PATH, session);
}

/**
 * 串行化同进程内的读改写，防止两个写入方同时「读到同一份旧文档」再各写一份。
 * 写入方是按字段隔离的，排队后后写者能看到先写者的结果，不会互相覆盖。
 */
let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
	const run = writeChain.then(task, task);
	// 队列本身不能因为某次写入失败而中断，失败仍原样抛给调用方。
	writeChain = run.catch(() => undefined);
	return run;
}

/**
 * 增量合并写入会话：只改 patch 里显式给出的字段，其余字段（含其它写入方维护的布局）
 * 原样保留。undefined 字段被跳过，因此「未拖过栏宽」不会把已有宽度清成空。
 */
export async function patchSession(patch: SessionPatch): Promise<void> {
	await enqueue(async () => {
		const current = (await readSession()) ?? EMPTY_SESSION;
		const next: StoredSession = { ...current };
		const target = next as unknown as Record<string, unknown>;
		for (const [key, value] of Object.entries(patch)) {
			if (value !== undefined) target[key] = value;
		}
		await writeSession(next);
	});
}
