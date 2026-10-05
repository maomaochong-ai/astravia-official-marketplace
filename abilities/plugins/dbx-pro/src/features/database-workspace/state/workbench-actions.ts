/**
 * 工作台 Action — 从 use-workbench 抽出的联合类型（状态机可接受的全部事件）。
 * 纯类型；reducer 据此分支，Provider 只发 action 不直接改 state。
 */

import type { StoredSession } from "../../../domain/workbench-session";
import type { DbConnection } from "../../../domain/connection-config";
import type { TreeNode } from "../../../domain/tree-node-key";
import type { SelectedNodeInfo } from "../../../shared/ai/send-context";
import type {
	EditorTab,
	EngineColumn,
	RightPanelSelection,
	WorkbenchState,
} from "./workbench-types";

export type WorkbenchAction =
	| { type: "setConnections"; connections: DbConnection[] }
	| { type: "refreshConnection" }
	| { type: "connectionsLoaded"; connections: DbConnection[]; invalidateTree?: boolean }
	| { type: "setActiveConnection"; name: string | null }
	| { type: "toggleNode"; key: string }
	| { type: "nodeLoading"; key: string }
	| { type: "nodeLoaded"; key: string; children: TreeNode[]; keepExpanded?: Set<string> }
	| { type: "nodeFailed"; key: string }
	| { type: "selectRightTable"; selection: RightPanelSelection | null }
	| { type: "setTabColumns"; connectionName: string; tableName: string; columns: EngineColumn[] }
	| { type: "addTab"; tab: EditorTab }
	| { type: "setTabTotalCount"; id: string; totalCount: number; ranSql: string }
	| { type: "closeTab"; id: string }
	| { type: "setActiveTab"; id: string }
	| { type: "updateTab"; id: string; patch: Partial<EditorTab> }
	| { type: "renameTab"; id: string; label: string }
	| { type: "setError"; message: string | null }
	| { type: "setConnectionStatus"; name: string; status: WorkbenchState["connectionStatuses"][string] }
	| { type: "toggleSelectionMode"; enabled?: boolean }
	| { type: "toggleNodeSelection"; key: string; info: SelectedNodeInfo }
	| { type: "clearNodeSelection" }
	| { type: "restoreSession"; session: StoredSession }
	| { type: "invalidateConnectionTree"; name: string };
