/**
 * TableInfoPanel — 表属性面板容器。
 *
 * 从查询网格顶部工具栏的"表属性"按钮触发，以右侧抽屉形式展开。
 * 七个页签：字段 / 表信息 / 索引 / 外键 / 触发器 / 约束 / DDL。
 * 字段与表信息来自引擎 /describe；索引 / 外键 / 触发器 / 约束按方言查目录视图；
 * DDL 按列结构生成并可一键发送到查询面板执行。
 */

import { useEffect, useMemo, useState, type JSX } from "react";
import type { EngineColumn } from "../state/workbench-types";
import { engineDescribeByName } from "../../../shared/services/engine-client";
import { useWorkbench } from "../hooks/use-workbench";
import { nextTabId } from "../state/tab-ids";
import { TableInfoColumns } from "./table-info-columns";
import { TableInfoOverview } from "./table-info-overview";
import { TableInfoDdl } from "./table-info-ddl";
import { TableInfoIndexes } from "./table-info-indexes";
import { TableInfoForeignKeys } from "./table-info-foreign-keys";
import { TableInfoTriggers } from "./table-info-triggers";
import { TableInfoConstraints } from "./table-info-constraints";

export type TableInfoTab =
	| "columns"
	| "overview"
	| "indexes"
	| "foreignKeys"
	| "triggers"
	| "constraints"
	| "ddl";

export interface TableInfoSelection {
	connectionName: string;
	tableName: string;
	schema?: string;
}

interface Props {
	selection: TableInfoSelection | null;
	onClose: () => void;
}

const TABS: { key: TableInfoTab; label: string; icon: string }[] = [
	{ key: "columns", label: "字段", icon: "icon-[lucide--columns-3]" },
	{ key: "overview", label: "表信息", icon: "icon-[lucide--info]" },
	{ key: "indexes", label: "索引", icon: "icon-[lucide--search]" },
	{ key: "foreignKeys", label: "外键", icon: "icon-[lucide--link]" },
	{ key: "triggers", label: "触发器", icon: "icon-[lucide--zap]" },
	{ key: "constraints", label: "约束", icon: "icon-[lucide--shield]" },
	{ key: "ddl", label: "DDL", icon: "icon-[lucide--code]" },
];

export function TableInfoPanel({ selection, onClose }: Props): JSX.Element {
	const [activeTab, setActiveTab] = useState<TableInfoTab>("columns");
	const [columns, setColumns] = useState<EngineColumn[]>([]);
	const [loading, setLoading] = useState(false);
	const { state, dispatch } = useWorkbench();

	// 切换查看的表时回到默认页签，避免停留在另一张表的元数据上。
	useEffect(() => {
		setActiveTab("columns");
	}, [selection?.connectionName, selection?.schema, selection?.tableName]);

	// 加载表结构信息
	useEffect(() => {
		if (!selection) return;
		let alive = true;
		setLoading(true);
		setColumns([]);

		engineDescribeByName(selection.connectionName, {
			schema: selection.schema,
			table: selection.tableName,
		})
			.then((outcome) => {
				if (!alive) return;
				setColumns(outcome.columns.map((c) => ({
					name: c.name,
					type: c.type,
					nullable: c.nullable,
					hasDefault: c.hasDefault,
					defaultValue: c.defaultValue,
					comment: c.comment,
					isPrimaryKey: c.isPrimaryKey,
				})));
			})
			.catch(() => { if (alive) setColumns([]); })
			.finally(() => { if (alive) setLoading(false); });

		return () => { alive = false; };
	}, [selection?.connectionName, selection?.tableName, selection?.schema]);

	const connection = useMemo(
		() => state.connections.find((c) => c.name === selection?.connectionName),
		[state.connections, selection?.connectionName],
	);

	if (!selection) return <></>;

	const qualifiedName = selection.schema
		? `${selection.schema}.${selection.tableName}`
		: selection.tableName;

	/** 把 DDL（或任意 SQL）发送到新查询 tab，绑定当前连接并关闭抽屉。 */
	function openInQuery(ddl: string): void {
		const id = nextTabId();
		dispatch({
			type: "addTab",
			tab: {
				id,
				label: `${selection!.tableName} DDL`,
				connectionName: selection!.connectionName,
				sql: ddl,
				isRunning: false,
			},
		});
		dispatch({ type: "setActiveTab", id });
		onClose();
	}

	return (
		<div className="dbx-table-info-drawer">
			{/* 头部：图标与文字垂直居中对齐 */}
			<div className="dbx-table-info-header">
				<span className="icon-[lucide--table-2] h-4 w-4 shrink-0 text-success/80" />
				<div className="min-w-0 flex-1">
					<h3 className="dbx-table-info-title">{qualifiedName}</h3>
					<p className="text-[10px] text-muted-foreground/70">连接: {selection.connectionName}</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					title="关闭"
					className="dbx-iconbtn"
					style={{ height: 24, minWidth: 24, padding: 0 }}
				>
					<span className="icon-[lucide--x] h-3.5 w-3.5" />
				</button>
			</div>

			{/* 页签栏：图标与文字同一基线对齐，激活态下划线 */}
			<div className="dbx-table-info-tabs">
				{TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						className={`dbx-table-info-tab ${activeTab === tab.key ? "active" : ""}`}
						onClick={() => setActiveTab(tab.key)}
					>
						<span className={`${tab.icon} h-3.5 w-3.5`} />
						{tab.label}
					</button>
				))}
			</div>

			{/* 内容区 */}
			<div className="dbx-table-info-content">
				{activeTab === "columns" && (
					loading ? (
						<div className="dbx-meta-state">
							<span className="icon-[lucide--loader] h-5 w-5 animate-spin text-muted-foreground" />
							<span className="text-[11px] text-muted-foreground">加载中…</span>
						</div>
					) : (
						<TableInfoColumns columns={columns} />
					)
				)}
				{activeTab === "overview" && <TableInfoOverview selection={selection} columns={columns} />}
				{activeTab === "indexes" && (
					<TableInfoIndexes
						enabled={activeTab === "indexes"}
						selection={selection}
						dbType={connection?.db_type}
						database={connection?.database}
					/>
				)}
				{activeTab === "foreignKeys" && (
					<TableInfoForeignKeys
						enabled={activeTab === "foreignKeys"}
						selection={selection}
						dbType={connection?.db_type}
						database={connection?.database}
					/>
				)}
				{activeTab === "triggers" && (
					<TableInfoTriggers
						enabled={activeTab === "triggers"}
						selection={selection}
						dbType={connection?.db_type}
						database={connection?.database}
					/>
				)}
				{activeTab === "constraints" && (
					<TableInfoConstraints
						enabled={activeTab === "constraints"}
						selection={selection}
						dbType={connection?.db_type}
						database={connection?.database}
					/>
				)}
				{activeTab === "ddl" && (
					<TableInfoDdl qualifiedName={qualifiedName} columns={columns} onOpenInQuery={openInQuery} />
				)}
			</div>
		</div>
	);
}
