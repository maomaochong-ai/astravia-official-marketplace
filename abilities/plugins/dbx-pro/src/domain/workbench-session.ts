/**
 * 工作台会话持久化 — 跨插件重载/重挂载恢复现场。
 *
 * 存的是「用户正在编辑的工作状态」（不是查询结果）：
 * 活动连接、打开的查询 tab 及其 SQL、活动 tab、展开的树节点、
 * 三栏宽度、左右栏折叠态。结果数据体积大且会过期，不入库。
 *
 * 这是修复「重载插件后界面全部改变/重置」的关键：module federation 重新
 * 挂载时内存状态全部清空，会话必须从宿主存储恢复，行为对齐标准桌面应用。
 */

import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import { getStorage } from "../runtime-contract.ts";

const SESSION_PATH = "workbench-session.json";

/** 一个查询 tab 的最小持久化形态（不含结果/运行态）。 */
export interface StoredTab {
	id: string;
	label: string;
	connectionName: string | null;
	sql: string;
	/** 可视化产物数据（如果是可视化标签页） */
	visualization?: {
		id?: string;
		title: string;
		type: "dashboard" | "screen";
		template: string;
		presetId?: string;
		connection: string;
		table: string;
		html: string;
		charts?: Array<{
			id: string;
			type: string;
			title: string;
			columns?: string[];
			rows?: Array<Record<string, unknown>>;
			config?: Record<string, unknown>;
			layout?: Record<string, number>;
		}>;
		widgets?: Array<{
			id: string;
			type: string;
			title: string;
			columns?: string[];
			rows?: Array<Record<string, unknown>>;
			config?: Record<string, unknown>;
			layout?: Record<string, number>;
		}>;
		createdAt?: number;
	};
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
	rightCollapsed?: boolean;
}

/** 读取会话；不存在或损坏时返回 null（调用方回落到默认初始态）。 */
export async function readSession(): Promise<StoredSession | null> {
	try {
		const doc = await readJsonFile<StoredSession>(getStorage(), SESSION_PATH);
		if (!doc || !Array.isArray(doc.tabs)) return null;
		return doc;
	} catch {
		return null;
	}
}

/** 写会话；落盘失败由调用方吞掉（不能因持久化打断主操作）。 */
export async function writeSession(session: StoredSession): Promise<void> {
	await writeJsonFile(getStorage(), SESSION_PATH, session);
}
