/**
 * useWorkbenchTree — 连接树懒加载与刷新逻辑。
 *
 * 从 use-workbench.tsx 拆分出来，专注树节点加载相关的异步逻辑。
 */

import { useCallback } from "react";
import {
	engineListTables,
	engineListSchemas,
	engineDescribeByName,
} from "../../../shared/services/engine-client";
import {
	connectionFromNodeKey,
	parseRoutinesFolderKey,
	parseTableNodeKey,
	routineNodeKey,
	routinesFolderNodeKey,
	schemaNodeKey,
	tableNodeKey,
	columnNodeKey,
	type TreeNode,
	treeNodeKind,
} from "../../../domain/tree-node-key";
import {
	loadRoutines,
	routineKeyName,
	routineLabel,
	routinesCatalogSql,
} from "../services/routines-catalog";
import type { EngineColumn, WorkbenchState } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";

/**
 * 例程分组节点。方言不支持时返回 null —— 宁可不显示，也不要一个点开就报错的分组。
 */
function routinesFolderNode(connectionName: string, schema: string, dbType?: string): TreeNode | null {
	if (!connectionName || !routinesCatalogSql(dbType, schema)) return null;
	return {
		key: routinesFolderNodeKey(connectionName, schema),
		kind: "routine-folder",
		label: "存储过程 / 函数",
		hasChildren: true,
	};
}

interface TreeDeps {
	stateRef: React.MutableRefObject<WorkbenchState>;
	dispatch: React.Dispatch<WorkbenchAction>;
}

export function useWorkbenchTree(deps: TreeDeps) {
	const { stateRef, dispatch } = deps;

	/** 列某个 schema（或默认 scope）下的表节点。 */
	const listTableNodes = useCallback(
		async (connectionName: string, schema?: string): Promise<TreeNode[]> => {
			const outcome = await engineListTables(connectionName, schema ? { schema } : {});
			return outcome.tables.map((t) => ({
				key: tableNodeKey(connectionName, schema, t.name),
				kind: "table",
				label: t.name,
				tableKind: t.kind,
				hasChildren: false,
			}));
		},
		[],
	);

	/** 加载树节点子节点（懒加载入口）。 */
	const loadNodeChildren = useCallback(
		async (nodeKey: string, connectionName?: string, extra?: { schema?: string; dbType?: string }) => {
			if (stateRef.current.treeChildren.has(nodeKey)) return;

			dispatch({ type: "nodeLoading", key: nodeKey });
			try {
				const kind = treeNodeKind(nodeKey);
				if (kind === "connection") {
					const name = connectionName ?? connectionFromNodeKey(nodeKey) ?? "";
					const connConfig = stateRef.current.connections.find((c) => c.name === name);
					const selectedSchemas = connConfig?.schemas ?? [];
					const dbType = extra?.dbType ?? connConfig?.db_type;

					let children: TreeNode[];
					let schemaLayer = false;
					try {
						const schemas = await engineListSchemas(name, dbType);
						if (schemas.supported && schemas.schemas.length > 0) {
							schemaLayer = true;
							let visible = schemas.schemas;
							if (selectedSchemas.length > 0) {
								visible = selectedSchemas.filter((s) => schemas.schemas.includes(s));
							}
							children = visible.map((s) => ({
								key: schemaNodeKey(name, s),
								kind: "schema" as const,
								label: s,
								hasChildren: true,
							}));
						} else {
							children = await listTableNodes(name, selectedSchemas[0]);
						}
					} catch {
						children = await listTableNodes(name, selectedSchemas[0]);
					}
					// 无 schema 层的库（SQLite 等）没有 schema 节点可挂，例程分组直接挂在连接下。
					if (!schemaLayer) {
						const folder = routinesFolderNode(name, "", dbType);
						if (folder) children = [...children, folder];
					}
					dispatch({ type: "nodeLoaded", key: nodeKey, children });
				} else if (kind === "schema") {
					const name = connectionName ?? connectionFromNodeKey(nodeKey) ?? "";
					const schemaName = extra?.schema;
					const dbType = extra?.dbType ?? stateRef.current.connections.find((c) => c.name === name)?.db_type;
					const children = await listTableNodes(name, schemaName);
					const folder = routinesFolderNode(name, schemaName ?? "", dbType);
					dispatch({ type: "nodeLoaded", key: nodeKey, children: folder ? [...children, folder] : children });
				} else if (kind === "routine-folder") {
					const ref = parseRoutinesFolderKey(nodeKey);
					const name = connectionName ?? ref?.connection ?? "";
					const schemaName = extra?.schema ?? ref?.schema ?? "";
					const dbType = extra?.dbType ?? stateRef.current.connections.find((c) => c.name === name)?.db_type;
					const result = await loadRoutines(name, schemaName, dbType);
					const routines: TreeNode[] = result.routines.map((r) => ({
						key: routineNodeKey(name, schemaName, routineKeyName(r)),
						kind: "routine" as const,
						label: routineLabel(r),
						routineName: r.name,
						routineKind: r.kind,
						routineArgs: r.args,
						hasChildren: false,
					}));
					dispatch({ type: "nodeLoaded", key: nodeKey, children: routines });
				} else if (kind === "table") {
					const ref = parseTableNodeKey(nodeKey);
					const conn = connectionName ?? ref?.connection ?? "";
					const schemaName = extra?.schema ?? ref?.schema ?? undefined;
					const table = ref?.table ?? nodeKey;
					const outcome = await engineDescribeByName(conn, { schema: schemaName, table });
					const cols: TreeNode[] = outcome.columns.map((c) => ({
						key: columnNodeKey(conn, schemaName, table, c.name),
						kind: "column",
						label: c.name,
						hasChildren: false,
					}));
					dispatch({ type: "nodeLoaded", key: nodeKey, children: cols });
					const fullCols: EngineColumn[] = outcome.columns.map((c) => ({
						name: c.name,
						type: c.type,
						nullable: c.nullable,
						hasDefault: c.hasDefault,
						defaultValue: c.defaultValue,
						comment: c.comment,
						isPrimaryKey: c.isPrimaryKey,
					}));
					dispatch({ type: "setTabColumns", connectionName: conn, tableName: table, columns: fullCols });
				} else {
					dispatch({ type: "nodeLoaded", key: nodeKey, children: [] });
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				dispatch({ type: "nodeFailed", key: nodeKey });
				dispatch({ type: "setError", message: `加载失败：${msg}` });
			}
		},
		[dispatch, stateRef, listTableNodes],
	);

	return { loadNodeChildren };
}
