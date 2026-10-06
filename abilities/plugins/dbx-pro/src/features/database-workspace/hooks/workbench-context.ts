/**
 * WorkbenchContext 类型定义 — 三栏工作台的集中状态与异步流程接口。
 *
 * 涵盖：连接列表、活动连接、连接树展开/懒加载状态、编辑器 tab 集合、
 * 活动 tab、右栏选中表、查询执行与写确认。
 */

import { createContext, useContext } from "react";
import type { DbConnection } from "../../../domain/connection-config";
import type { QueryHistoryEntry } from "../../../domain/query-history";
import type { WorkbenchSettings } from "../../../domain/workbench-settings";
import type { SelectedNodeInfo } from "../../../shared/ai/send-context";
import type { EditorTab, WorkbenchState } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";

export interface WorkbenchContextValue {
	state: WorkbenchState;
	dispatch: React.Dispatch<WorkbenchAction>;
	refreshConnections: () => Promise<void>;
	/** 加载树节点子节点（懒加载入口） */
	loadNodeChildren: (nodeKey: string, connectionName?: string, extra?: { schema?: string; dbType?: string }) => Promise<void>;
	/** 清除某连接的树缓存（编辑 schema 选择后调用，使下次展开按新选择重算）。 */
	invalidateConnection: (name: string) => void;
	/** 执行一个 tab 的 SQL；overrideSql 存在时只执行给定片段（选中执行 / 过滤包装）。 */
	runTabSql: (
		tabId: string,
		overrideSql?: string,
		overrideConn?: string,
		options?: { pageIndex?: number; pageSize?: number; mode?: "server" | "client" },
	) => Promise<void>;
	/** 翻到服务端分页的第 pageIndex 页（0-based）；pageSize 变化时回到第 0 页。 */
	goToResultPage: (tabId: string, pageIndex: number, pageSize?: number) => Promise<void>;
	/** 停止当前 tab 的执行（视觉复位）。 */
	cancelExecution: (tabId: string) => void;
	/** 打开一个新 tab 并执行（常用于预览） */
	openPreviewTab: (connectionName: string, sql: string, label?: string) => Promise<void>;

	// ─── 设置 ──
	settings: WorkbenchSettings;
	updateSettings: (next: WorkbenchSettings) => Promise<void>;
	/** 刷新总计行统计（异步执行 COUNT 查询）。 */
	refreshTotalCount: (tabId: string, connectionName: string, sql: string) => Promise<void>;

	// ─── 查询历史 ───
	history: QueryHistoryEntry[];
	loadHistoryIntoEditor: (entry: QueryHistoryEntry) => void;
	rerunHistoryEntry: (entry: QueryHistoryEntry) => Promise<void>;
	removeHistory: (id: string) => Promise<void>;
	clearAllHistory: () => Promise<void>;

	/** 清除全部本地数据：连接（含引擎+密文）、历史、设置、密码 secret。 */
	wipeAllData: () => Promise<void>;

	// ─── 连接树多选 ───
	selectionMode: boolean;
	selectedNodes: Map<string, SelectedNodeInfo>;
	toggleSelectionMode: (enabled?: boolean) => void;
	toggleNodeSelection: (key: string, info: SelectedNodeInfo) => void;
	clearNodeSelection: () => void;
}

export const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function useWorkbench(): WorkbenchContextValue {
	const ctx = useContext(WorkbenchContext);
	if (!ctx) throw new Error("useWorkbench 必须在 WorkbenchProvider 内使用");
	return ctx;
}

/** 工具：根据 db 类型推断 catalog family（为连接树渲染 hint） */
export function inferTreeKindFor(_dbType: string): "connection" {
	return "connection";
}
