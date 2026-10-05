/**
 * 连接管理面板 — 参考 dbx 桌面壳的两步流程设计。
 *
 * 两步流程：
 * 1. 选择数据库类型（带搜索和分类导航）
 * 2. 填写连接配置
 *
 * 也支持从列表页直接管理已有连接。
 */

import { useState, type JSX } from "react";
import { ConnectionFields } from "./connection-fields";
import { ConnectionList } from "./connection-list";
import { useConnectionEditor } from "../hooks/use-connection-editor";
import { DB_TYPE_MANIFEST, type DbType } from "../../../domain/connection-config";
import { getDatabaseTypeVisual } from "../../../domain/database-type-visual";

export interface ConnectionEditorSheetProps {
	/** 连接增 / 删 / 改后通知外层重载工作台（回传受影响连接名）。 */
	onChange?: (name?: string) => void;
	onCancel: () => void;
}

type DialogStep = "list" | "select" | "config";

export function ConnectionEditorSheet({ onChange, onCancel }: ConnectionEditorSheetProps): JSX.Element {
	const editor = useConnectionEditor({ onChange });
	const [step, setStep] = useState<DialogStep>(editor.editing ? "config" : "list");
	const [selectedDbType, setSelectedDbType] = useState<DbType>("mysql");
	const [searchQuery, setSearchQuery] = useState("");

	// 从列表页进入新建流程
	function handleCreateNew(): void {
		editor.startNew();
		setStep("select");
	}

	// 从列表页进入编辑流程
	function handleEdit(conn: { name: string; db_type: string }): void {
		editor.startEdit({ ...conn, db_type: conn.db_type } as any);
		setSelectedDbType(conn.db_type as DbType);
		setStep("config");
	}

	// 从类型选择进入配置
	function handleSelectDbType(dbType: DbType): void {
		setSelectedDbType(dbType);
		editor.setDbType(dbType);
		setStep("config");
	}

	// 返回列表
	function handleBackToList(): void {
		editor.back();
		setStep("list");
	}

	// 返回类型选择
	function handleBackToSelect(): void {
		setStep("select");
	}

	// 过滤数据库类型
	const filteredTypes = searchQuery.trim()
		? DB_TYPE_MANIFEST.filter((t) =>
			t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.dbType.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		: DB_TYPE_MANIFEST;

	// 按类别分组
	const categories = [
		{ key: "relational", label: "关系型", types: filteredTypes.filter((t) => ["mysql", "postgres", "mariadb", "sqlite", "sqlserver", "oracle", "db2"].includes(t.dbType)) },
		{ key: "nosql", label: "NoSQL", types: filteredTypes.filter((t) => ["mongodb", "redis", "elasticsearch", "cassandra", "neo4j"].includes(t.dbType)) },
		{ key: "analytics", label: "分析型", types: filteredTypes.filter((t) => ["clickhouse", "snowflake", "bigquery", "doris", "starrocks"].includes(t.dbType)) },
		{ key: "other", label: "其他", types: filteredTypes.filter((t) =>
			!["mysql", "postgres", "mariadb", "sqlite", "sqlserver", "oracle", "db2", "mongodb", "redis", "elasticsearch", "cassandra", "neo4j", "clickhouse", "snowflake", "bigquery", "doris", "starrocks"].includes(t.dbType),
		) },
	].filter((c) => c.types.length > 0);

	return (
		<>
			{/* 遮罩层 */}
			<div
				className="dbx-connection-backdrop"
				onClick={onCancel}
			/>

			{/* 主面板 */}
			<div className="dbx-connection-dialog">
				{/* 头部 */}
				<div className="dbx-connection-header">
					<div className="flex items-center gap-2 min-w-0 flex-1">
						{step !== "list" && (
							<button
								type="button"
								className="dbx-iconbtn"
								onClick={step === "config" ? handleBackToSelect : handleBackToList}
								title="返回"
							>
								<span className="icon-[lucide--arrow-left] h-4 w-4" />
							</button>
						)}
						<span className="icon-[lucide--database] h-4 w-4 text-muted-foreground shrink-0" />
						<h2 className="dbx-connection-title">
							{step === "list" && "管理连接"}
							{step === "select" && "选择数据库类型"}
							{step === "config" && (editor.editing?.name ? "编辑连接" : "新建连接")}
						</h2>
					</div>
					<button
						type="button"
						className="dbx-iconbtn"
						onClick={onCancel}
						title="关闭"
					>
						<span className="icon-[lucide--x] h-4 w-4" />
					</button>
				</div>

				{/* 内容区 */}
				<div className="dbx-connection-body">
					{step === "list" && (
						<ConnectionList
							connections={editor.connections}
							testing={editor.testing}
							testResult={editor.testResult}
							onEdit={(conn) => handleEdit(conn)}
							onTest={(c) => void editor.test(c)}
							onDelete={(c) => void editor.remove(c)}
							onCreate={handleCreateNew}
						/>
					)}

					{step === "select" && (
						<div className="flex flex-col h-full gap-3">
							{/* 搜索栏 */}
							<div className="relative">
								<span className="icon-[lucide--search] absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
								<input
									type="text"
									className="dbx-form-input pl-8 h-8 text-xs"
									placeholder="搜索数据库类型..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>

							{/* 分类导航 + 类型列表 */}
							<div className="flex min-h-0 flex-1 gap-3">
								{/* 分类导航 */}
								<nav className="flex shrink-0 flex-col gap-0.5 w-20 border-r border-border/50 pr-2">
									{categories.map((cat) => (
										<span
											key={cat.key}
											className="px-2 py-1 text-[10px] font-medium text-muted-foreground"
										>
											{cat.label}
										</span>
									))}
								</nav>

								{/* 类型网格 */}
								<div className="flex-1 overflow-y-auto">
									{categories.map((cat) => (
										<div key={cat.key} className="mb-3">
											<h3 className="text-[10px] font-medium text-muted-foreground mb-1.5 px-1">
												{cat.label}
											</h3>
											<div className="grid grid-cols-3 gap-1.5">
												{cat.types.map((t) => {
													const visual = getDatabaseTypeVisual(t.dbType);
													return (
														<button
															key={t.dbType}
															type="button"
															className="dbx-db-type-card"
															onClick={() => handleSelectDbType(t.dbType as DbType)}
														>
															<span
																className="flex h-7 w-7 items-center justify-center rounded text-[9px] font-bold"
																style={{ backgroundColor: visual.color, color: visual.badge === "DU" ? "#1e293b" : "#fff" }}
															>
																{visual.badge.slice(0, 2)}
															</span>
															<span className="text-[10px] font-medium truncate">
																{t.label}
															</span>
														</button>
													);
												})}
											</div>
										</div>
									))}
									{filteredTypes.length === 0 && (
										<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
											<span className="icon-[lucide--search-x] h-6 w-6 mb-2 opacity-50" />
											<span className="text-xs">无匹配结果</span>
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{step === "config" && editor.editing && (
						<ConnectionFields
							conn={editor.editing}
							onChange={(c) => editor.setEditing(c)}
							onTypeChange={(dbType) => {
								editor.setDbType(dbType);
								setSelectedDbType(dbType as DbType);
							}}
							groupedManifest={editor.groupedManifest}
							availableSchemas={editor.availableSchemas}
							loadingSchemas={editor.loadingSchemas}
							onLoadSchemas={editor.loadSchemas}
						/>
					)}
				</div>

				{/* 底部操作栏 */}
				{step === "config" && editor.editing && (
					<div className="dbx-connection-footer">
						<button className="dbx-btn ghost" onClick={handleBackToSelect}>
							上一步
						</button>
						<div className="flex-1" />
						<button className="dbx-btn ghost" onClick={handleBackToList}>
							取消
						</button>
						<button className="dbx-btn primary" onClick={() => void editor.save()}>
							保存
						</button>
					</div>
				)}
			</div>
		</>
	);
}
