/**
 * useTableMetadata — 表属性页签激活时按需查询元数据（索引/外键/触发器/约束）。
 *
 * 只有 enabled（用户切到该页签）时才发请求；切换表 / 页签自动重载；
 * 方言不支持时 unsupported=true，由组件渲染中性空态。
 */

import { useEffect, useState } from "react";
import {
	fetchTableMetadata,
	type MetadataColumnSpec,
	type MetadataKind,
	type MetadataTarget,
} from "../services/table-metadata";

export interface TableMetadataState {
	loading: boolean;
	rows: Record<string, unknown>[];
	columns: MetadataColumnSpec[];
	unsupported: boolean;
	error: string | null;
}

const IDLE: TableMetadataState = { loading: false, rows: [], columns: [], unsupported: false, error: null };

export function useTableMetadata(
	enabled: boolean,
	connectionName: string,
	dbType: string | undefined,
	target: MetadataTarget,
	kind: MetadataKind,
): TableMetadataState {
	const [state, setState] = useState<TableMetadataState>(IDLE);

	const { schema, table, database } = target;

	useEffect(() => {
		if (!enabled) {
			setState(IDLE);
			return;
		}
		let alive = true;
		setState({ loading: true, rows: [], columns: [], unsupported: false, error: null });
		fetchTableMetadata(connectionName, dbType, { schema, table, database }, kind)
			.then((outcome) => {
				if (!alive) return;
				setState({
					loading: false,
					rows: outcome.rows,
					columns: outcome.columns,
					unsupported: outcome.unsupported,
					error: null,
				});
			})
			.catch((err) => {
				if (!alive) return;
				setState({
					loading: false,
					rows: [],
					columns: [],
					unsupported: false,
					error: err instanceof Error ? err.message : String(err),
				});
			});
		return () => { alive = false; };
	}, [enabled, connectionName, dbType, schema, table, database, kind]);

	return state;
}
