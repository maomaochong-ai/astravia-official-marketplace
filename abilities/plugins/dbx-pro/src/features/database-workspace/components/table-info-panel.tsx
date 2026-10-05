/**
 * TableInfoPanel — 表属性面板容器。
 *
 * 从查询网格顶部工具栏的"表属性"按钮触发，以右侧抽屉形式展开。
 * 页签与布局对齐 dbx 桌面壳（文本横排页签 + 列表格）：
 * - 字段：sticky 表头的列信息表格（TableInfoColumns）
 * - 表信息：label/value 概览行（TableInfoOverview）
 * - DDL：按列结构生成的建表语句（TableInfoDdl）
 *
 * 数据全部来自引擎 /describe；引擎无索引 / 外键 / 触发器独立端点，不提供空占位页签。
 */

import { useEffect, useState, type JSX } from "react";
import type { EngineColumn } from "../state/workbench-types";
import { engineDescribeByName } from "../../../shared/services/engine-client";
import { TableInfoColumns } from "./table-info-columns";
import { TableInfoOverview } from "./table-info-overview";
import { TableInfoDdl } from "./table-info-ddl";

export type TableInfoTab = "columns" | "overview" | "ddl";

export interface TableInfoSelection {
	connectionName: string;
	tableName: string;
	schema?: string;
}

interface Props {
	selection: TableInfoSelection | null;
	onClose: () => void;
}

const TABS: { key: TableInfoTab; label: string }[] = [
	{ key: "columns", label: "字段" },
	{ key: "overview", label: "表信息" },
	{ key: "ddl", label: "DDL" },
];

export function TableInfoPanel({ selection, onClose }: Props): JSX.Element {
	const [activeTab, setActiveTab] = useState<TableInfoTab>("columns");
	const [columns, setColumns] = useState<EngineColumn[]>([]);
	const [loading, setLoading] = useState(false);

	// 切换查看的表时回到默认页签，避免停留在另一张表的 DDL 上。
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

	if (!selection) return <></>;

	const qualifiedName = selection.schema
		? `${selection.schema}.${selection.tableName}`
		: selection.tableName;

	return (
		<div className="dbx-table-info-drawer">
			{/* 头部 */}
			<div className="dbx-table-info-header">
				<span className="icon-[lucide--table-2] h-4 w-4 text-emerald-400" />
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

			{/* 页签栏：文本横排，激活态下划线（对齐 dbx） */}
			<div className="dbx-table-info-tabs">
				{TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						className={`dbx-table-info-tab ${activeTab === tab.key ? "active" : ""}`}
						onClick={() => setActiveTab(tab.key)}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* 内容区 */}
			<div className="dbx-table-info-content">
				{loading ? (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<span className="icon-[lucide--loader] mr-2 h-5 w-5 animate-spin" />
						<span className="text-[11px]">加载中…</span>
					</div>
				) : activeTab === "columns" ? (
					<TableInfoColumns columns={columns} />
				) : activeTab === "overview" ? (
					<TableInfoOverview selection={selection} columns={columns} />
				) : (
					<TableInfoDdl qualifiedName={qualifiedName} columns={columns} />
				)}
			</div>
		</div>
	);
}
