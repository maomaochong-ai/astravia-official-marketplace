/**
 * TableInfoPanel — 表属性面板（多 Tab 展示）。
 *
 * 从查询网格顶部工具栏的"表属性"按钮触发，以右侧抽屉形式展开。
 * 支持多个 Tab：概览、列、索引、外键、触发器、约束、分区。
 *
 * 参考主流数据库管理工具的表信息面板设计。
 */

import { useEffect, useState, type JSX } from "react";
import { useWorkbench, type EngineColumn } from "../hooks/use-workbench";
import { engineDescribeByName } from "../../../shared/services/engine-client";

export type TableInfoTab = "overview" | "columns" | "indexes" | "foreignKeys" | "triggers" | "constraints" | "partitions";

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
	{ key: "overview", label: "概览", icon: "icon-[lucide--info]" },
	{ key: "columns", label: "列", icon: "icon-[lucide--columns-3]" },
	{ key: "indexes", label: "索引", icon: "icon-[lucide--search]" },
	{ key: "foreignKeys", label: "外键", icon: "icon-[lucide--link]" },
	{ key: "triggers", label: "触发器", icon: "icon-[lucide--zap]" },
	{ key: "constraints", label: "约束", icon: "icon-[lucide--shield]" },
	{ key: "partitions", label: "分区", icon: "icon-[lucide--layout-grid]" },
];

export function TableInfoPanel({ selection, onClose }: Props): JSX.Element {
	const [activeTab, setActiveTab] = useState<TableInfoTab>("columns");
	const [columns, setColumns] = useState<EngineColumn[]>([]);
	const [loading, setLoading] = useState(false);

	const { state } = useWorkbench();

	// 加载表结构信息
	useEffect(() => {
		if (!selection) return;
		setLoading(true);
		setColumns([]);
		
		engineDescribeByName(selection.connectionName, { 
			schema: selection.schema, 
			table: selection.tableName 
		})
			.then((outcome) => {
				const cols: EngineColumn[] = outcome.columns.map((c) => ({
					name: c.name,
					type: c.type,
					nullable: c.nullable,
					hasDefault: c.hasDefault,
					defaultValue: c.defaultValue,
					comment: c.comment,
					isPrimaryKey: c.isPrimaryKey,
				}));
				setColumns(cols);
			})
			.catch(() => setColumns([]))
			.finally(() => setLoading(false));
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

			{/* Tab 栏 */}
			<div className="dbx-table-info-tabs">
				{TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						className={`dbx-table-info-tab ${activeTab === tab.key ? "active" : ""}`}
						onClick={() => setActiveTab(tab.key)}
					>
						<span className={`${tab.icon} h-3 w-3`} />
						{tab.label}
					</button>
				))}
			</div>

			{/* 内容区 */}
			<div className="dbx-table-info-content">
				{loading ? (
					<div className="flex items-center justify-center py-8 text-muted-foreground">
						<span className="icon-[lucide--loader] h-5 w-5 animate-spin mr-2" />
						<span className="text-[11px]">加载中…</span>
					</div>
				) : (
					<>
						{activeTab === "overview" && <OverviewTab selection={selection} columns={columns} />}
						{activeTab === "columns" && <ColumnsTab columns={columns} />}
				{activeTab === "indexes" && <PlaceholderTab feature="索引" />}
				{activeTab === "foreignKeys" && <PlaceholderTab feature="外键" />}
				{activeTab === "triggers" && <PlaceholderTab feature="触发器" />}
				{activeTab === "constraints" && <PlaceholderTab feature="约束" />}
				{activeTab === "partitions" && <PlaceholderTab feature="分区" />}
					</>
				)}
			</div>
		</div>
	);
}

/** 概览 Tab */
function OverviewTab({ selection, columns }: { selection: TableInfoSelection; columns: EngineColumn[] }): JSX.Element {
	const primaryKeyCount = columns.filter((c) => c.isPrimaryKey).length;
	const nullableCount = columns.filter((c) => c.nullable).length;
	const withDefaultCount = columns.filter((c) => c.hasDefault).length;

	return (
		<div className="space-y-4">
			<div className="dbx-table-info-section">
				<div className="dbx-table-info-section-title">基本信息</div>
				<div className="dbx-table-info-grid">
					<InfoItem label="表名" value={selection.tableName} />
					<InfoItem label="Schema" value={selection.schema ?? "(默认)"} />
					<InfoItem label="连接" value={selection.connectionName} />
					<InfoItem label="列数" value={String(columns.length)} />
				</div>
			</div>

			<div className="dbx-table-info-section">
				<div className="dbx-table-info-section-title">统计</div>
				<div className="dbx-table-info-grid">
					<InfoItem label="主键列" value={String(primaryKeyCount)} />
					<InfoItem label="可空列" value={String(nullableCount)} />
					<InfoItem label="有默认值" value={String(withDefaultCount)} />
				</div>
			</div>
		</div>
	);
}

/** 列信息 Tab */
function ColumnsTab({ columns }: { columns: EngineColumn[] }): JSX.Element {
	if (columns.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
				<span className="icon-[lucide--columns-3] h-8 w-8 opacity-30 mb-2" />
				<span className="text-[11px]">无列信息</span>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			{columns.map((col) => (
				<div key={col.name} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--dbx-hover)]">
					<span className={`shrink-0 ${col.isPrimaryKey ? "icon-[lucide--key-round] text-amber-400" : col.nullable ? "icon-[lucide--circle-dot] text-muted-foreground/70" : "icon-[lucide--dot] text-muted-foreground"} h-3 w-3`} />
					<span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground" title={col.name}>{col.name}</span>
					<span className="shrink-0 rounded bg-[var(--dbx-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{col.type}</span>
					{col.isPrimaryKey && <span className="shrink-0 rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-400">PK</span>}
					{!col.nullable && !col.isPrimaryKey && <span className="shrink-0 text-[9px] text-muted-foreground/70">NOT NULL</span>}
					{col.hasDefault && col.defaultValue && (
						<span className="shrink-0 text-[9px] font-mono text-muted-foreground" title={col.defaultValue}>
							= {col.defaultValue.length > 12 ? col.defaultValue.slice(0, 11) + "…" : col.defaultValue}
						</span>
					)}
				</div>
			))}
		</div>
	);
}

/** 占位 Tab（引擎不支持的功能） */
function PlaceholderTab({ feature }: { feature: string }): JSX.Element {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
			<span className="icon-[lucide--puzzle] h-8 w-8 opacity-30 mb-2" />
			<span className="text-[11px] font-medium mb-1">{feature} 需要引擎支持</span>
			<span className="text-[10px] text-muted-foreground/60 text-center px-4">
				当前引擎版本暂不支持该功能，请升级后重试
			</span>
		</div>
	);
}

/** 信息项 */
function InfoItem({ label, value }: { label: string; value: string }): JSX.Element {
	return (
		<div className="dbx-table-info-item">
			<span className="dbx-table-info-label">{label}</span>
			<span className="dbx-table-info-value" title={value}>{value}</span>
		</div>
	);
}
