/**
 * 工作台状态模型 — 从 use-workbench 抽出的纯类型（无逻辑/无副作用）。
 * 三栏工作台在内存中的工作状态；与 Reducer/Action 同属 feature 的 state 层。
 */

import type { DbConnection } from "../../../domain/connection-config";
import type { TreeNode } from "../../../domain/tree-node-key";
import type { SelectedNodeInfo } from "../../../shared/ai/send-context";

export interface EngineColumn {
	name: string;
	type: string;
	nullable: boolean;
	hasDefault: boolean;
	defaultValue: string;
	comment: string;
	isPrimaryKey: boolean;
}

/** 一个查询 tab：编辑中的 SQL 与执行结果/运行态。 */
export interface EditorTab {
	id: string;
	label: string;
	connectionName: string | null;
	sql: string;
	/** 执行结果（成功/失败都写这里） */
	result?: {
		ok: boolean;
		columns: string[];
		rows: Record<string, unknown>[];
		rowCount: number;
		/** 写 / DDL 的影响行数（direct-write 返回）；SELECT 为 null。 */
		affectedRows?: number | null;
		elapsedMs: number;
		error?: string;
		note?: string;
		/** 响应是服务端分页中的一页。 */
		paged?: boolean;
		/** COUNT 得到的真实总行数；未统计前为 undefined。 */
		totalCount?: number;
		/** 当前服务端页码（0-based）。 */
		serverPage?: number;
		/** 产生该结果的实际 SQL；选中执行时与 tab.sql 不同，翻页必须重跑它。 */
		ranSql?: string;
	};
	/** 该 tab 的页大小；未设置时回落到设置里的默认每页行数。 */
	pageSize?: number;
	isRunning: boolean;
}

export interface WorkbenchState {
	connections: DbConnection[];
	activeConnectionName: string | null;
	expandedNodes: Set<string>;
	loadingNodes: Set<string>;
	treeChildren: Map<string, TreeNode[]>;
	tabColumnsMap: Map<string, EngineColumn[]>;
	tabs: EditorTab[];
	activeTabId: string | null;
	connectionStatuses: Record<string, "idle" | "ok" | "error" | "running">;
	errorBanner: string | null;
	/** 连接树多选模式（用于批量选库 / 表作为 AI 上下文）。 */
	selectionMode: boolean;
	/** 选中节点：key → 节点信息（连接 / schema / 表）。 */
	selectedNodes: Map<string, SelectedNodeInfo>;
}
