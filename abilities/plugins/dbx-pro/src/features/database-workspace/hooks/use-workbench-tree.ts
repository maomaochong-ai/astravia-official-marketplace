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
	parseTableNodeKey,
	schemaNodeKey,
	tableNodeKey,
	columnNodeKey,
	type TreeNode,
	treeNodeKind,
} from "../../../domain/tree-node-key";
import type { EngineColumn, WorkbenchState } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";

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

					let children: TreeNode[];
					try {
						const dbType = extra?.dbType ?? connConfig?.db_type;
						const schemas = await engineListSchemas(name, dbType);
						if (schemas.supported && schemas.schemas.length > 0) {
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
					dispatch({ type: "nodeLoaded", key: nodeKey, children });
				} else if (kind === "schema") {
					const children = await listTableNodes(connectionName ?? "", extra?.schema);
					dispatch({ type: "nodeLoaded", key: nodeKey, children });
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
