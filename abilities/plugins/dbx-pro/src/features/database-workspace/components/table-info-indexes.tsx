/**
 * 表属性 · 索引页签（按方言查目录视图，见 services/table-metadata.ts）。
 */

import type { JSX } from "react";
import { useTableMetadata } from "../hooks/use-table-metadata";
import type { TableInfoSelection } from "./table-info-panel";
import { MetadataTable } from "./table-info-metadata-table";

export function TableInfoIndexes({
	enabled,
	selection,
	dbType,
	database,
}: {
	enabled: boolean;
	selection: TableInfoSelection;
	dbType?: string;
	database?: string;
}): JSX.Element {
	const state = useTableMetadata(enabled, selection.connectionName, dbType, {
		schema: selection.schema,
		table: selection.tableName,
		database,
	}, "indexes");
	return <MetadataTable {...state} objectLabel="索引" />;
}
