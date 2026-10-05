/**
 * 表属性 · 外键页签。
 */

import type { JSX } from "react";
import { useTableMetadata } from "../hooks/use-table-metadata";
import type { TableInfoSelection } from "./table-info-panel";
import { MetadataTable } from "./table-info-metadata-table";

export function TableInfoForeignKeys({
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
	}, "foreignKeys");
	return <MetadataTable {...state} objectLabel="外键" />;
}
