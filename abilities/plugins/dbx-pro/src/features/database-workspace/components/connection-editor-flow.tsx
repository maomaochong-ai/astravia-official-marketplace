/**
 * 连接编辑流程主体 — 模态弹窗与宿主侧边栏整页共用的三步流程。
 *
 * 三步流程：
 * 1. list   管理已有连接
 * 2. select 选择数据库类型（搜索 + 分类导航 + 宫格 / 列表视图）
 * 3. config 填写连接配置
 *
 * 本组件只渲染头部 / 内容 / 底部三段，不渲染遮罩与定位外壳：
 * - ConnectionEditorSheet 用遮罩 + 居中弹窗包裹，并传入 onClose 显示关闭按钮；
 * - ConnectionManagerView 直接整页挂载，侧边栏视图无「关闭」语义，不传 onClose。
 */

import { useState, useRef, useEffect, useCallback, type JSX } from "react";
import { ConnectionFields } from "./connection-fields";
import { ConnectionList } from "./connection-list";
import { useConnectionEditor } from "../hooks/use-connection-editor";
import { DB_TYPE_MANIFEST, type DbConnection, type DbType } from "../../../domain/connection-config";
import { DatabaseTypeIcon } from "../../../shared/components/database-type-icon";

export interface ConnectionEditorFlowProps {
	/** 连接增 / 删 / 改后通知外层重载工作台（回传受影响连接名）。 */
	onChange?: (name?: string) => void;
	/** 传入时头部显示关闭按钮（模态场景）；侧边栏整页不传。 */
	onClose?: () => void;
	/** 侧边栏整页场景：列表步显示返回总览按钮（模态不显示）。 */
	onExit?: () => void;
}

type DialogStep = "list" | "select" | "config";
type ViewMode = "grid" | "list";

interface Category {
	key: string;
	label: string;
	types: typeof DB_TYPE_MANIFEST;
}

const RELATIONAL_TYPES = ["mysql", "postgres", "mariadb", "sqlite", "sqlserver", "oracle", "db2"];
const NOSQL_TYPES = ["mongodb", "redis", "elasticsearch", "cassandra", "neo4j"];
const ANALYTICS_TYPES = ["clickhouse", "snowflake", "bigquery", "doris", "starrocks"];

export function ConnectionEditorFlow({ onChange, onClose, onExit }: ConnectionEditorFlowProps): JSX.Element {
	const editor = useConnectionEditor({ onChange });
	const [step, setStep] = useState<DialogStep>("list");
	const [_selectedDbType, setSelectedDbType] = useState<DbType>("mysql");
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [selectedCategory, setSelectedCategory] = useState<string>("relational");
	const contentRef = useRef<HTMLDivElement>(null);
	const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

	// 从列表页进入新建流程
	function handleCreateNew(): void {
		editor.startNew();
		setStep("select");
	}

	// 从列表页进入编辑流程
	function handleEdit(conn: DbConnection): void {
		editor.startEdit({ ...conn });
		setSelectedDbType(conn.db_type as DbType);
		setStep("config");
	}

	// 从类型选择进入配置
	function handleSelectDbType(dbType: DbType): void {
		setSelectedDbType(dbType);
		editor.setDbType(dbType);
		setStep("config");
	}

	// 返回列表（放弃当前草稿，hook 内部回滚未落盘的新建连接）
	function handleBackToList(): void {
		editor.back();
		setStep("list");
	}

	// 返回类型选择
	function handleBackToSelect(): void {
		setStep("select");
	}

	// 保存成功后 hook 已把草稿清空并退回列表态，流程页同步回列表
	async function handleSave(): Promise<void> {
		const ok = await editor.save();
		if (ok) setStep("list");
	}

	// 切换分类（滚动到对应位置）
	const handleCategoryClick = useCallback((categoryKey: string) => {
		setSelectedCategory(categoryKey);
		const element = categoryRefs.current[categoryKey];
		if (element && contentRef.current) {
			// 滚动到对应分类
			const containerRect = contentRef.current.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const scrollTop = elementRect.top - containerRect.top + contentRef.current.scrollTop - 8;
			contentRef.current.scrollTo({ top: scrollTop, behavior: "smooth" });
		}
	}, []);

	// 监听滚动，更新当前分类
	useEffect(() => {
		if (step !== "select") return;

		const handleScroll = () => {
			if (!contentRef.current) return;
			const containerTop = contentRef.current.getBoundingClientRect().top;

			// 找到当前可见的分类
			let currentCategory = "relational";
			for (const [key, element] of Object.entries(categoryRefs.current)) {
				if (element) {
					const elementTop = element.getBoundingClientRect().top;
					const relativeTop = elementTop - containerTop;
					if (relativeTop <= 50) {
						currentCategory = key;
					}
				}
			}
			setSelectedCategory(currentCategory);
		};

		const contentElement = contentRef.current;
		if (contentElement) {
			contentElement.addEventListener("scroll", handleScroll);
			// 初始触发一次
			handleScroll();
			return () => contentElement.removeEventListener("scroll", handleScroll);
		}
	}, [step]);

	// 过滤数据库类型
	const filteredTypes = searchQuery.trim()
		? DB_TYPE_MANIFEST.filter((t) =>
			t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.dbType.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		: DB_TYPE_MANIFEST;

	// 按类别分组
	const categories: Category[] = [
		{ key: "relational", label: "关系型", types: filteredTypes.filter((t) => RELATIONAL_TYPES.includes(t.dbType)) },
		{ key: "nosql", label: "NoSQL", types: filteredTypes.filter((t) => NOSQL_TYPES.includes(t.dbType)) },
		{ key: "analytics", label: "分析型", types: filteredTypes.filter((t) => ANALYTICS_TYPES.includes(t.dbType)) },
		{
			key: "other",
			label: "其他",
			types: filteredTypes.filter((t) =>
				![...RELATIONAL_TYPES, ...NOSQL_TYPES, ...ANALYTICS_TYPES].includes(t.dbType),
			),
		},
	].filter((c) => c.types.length > 0);

	return (
		<div className="dbx-connection-flow">
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
					{step === "list" && onExit && (
						<button
							type="button"
							className="dbx-iconbtn"
							onClick={onExit}
							title="返回总览"
						>
							<span className="icon-[lucide--arrow-left] h-4 w-4" />
						</button>
					)}
					<span className="icon-[lucide--database] h-4 w-4 shrink-0 text-muted" />
					<h2 className="dbx-connection-title">
						{step === "list" && "管理连接"}
						{step === "select" && "选择数据库类型"}
						{step === "config" && (editor.editing?.name ? "编辑连接" : "新建连接")}
					</h2>
				</div>
				{onClose && (
					<button
						type="button"
						className="dbx-iconbtn"
						onClick={onClose}
						title="关闭"
					>
						<span className="icon-[lucide--x] h-4 w-4" />
					</button>
				)}
			</div>
			{/* 步骤条：设计稿 h-11 行 */}
			<div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
				<Stepper current={step === "list" ? 0 : step === "select" ? 1 : 2} />
			</div>

			{/* 内容区 */}
			<div className={`dbx-connection-body${step === "list" ? " is-flush" : ""}`}>
				{step === "list" && (
					<>
					<ConnectionList
						connections={editor.connections}
						testing={editor.testing}
						testResult={editor.testResult}
						onEdit={(conn) => handleEdit(conn)}
						onTest={(c) => void editor.test(c)}
						onDelete={(c) => void editor.remove(c)}
						onCreate={handleCreateNew}
					/>
					<div className="dbx-connection-footer">
						<button type="button" className="dbx-btn primary" onClick={handleCreateNew}>
							<span className="icon-[lucide--plus] h-3.5 w-3.5" />
							新建连接
						</button>
						<span className="ml-1 text-[12px] whitespace-nowrap text-muted">连接配置只保存在本机</span>
					</div>
					</>
				)}

				{step === "select" && (
					<div className="flex min-h-0 flex-1 flex-col gap-3">
						{/* 搜索栏和视图切换 */}
						<div className="flex h-8 shrink-0 items-center gap-2">
							<div className="relative flex-1">
								<span className="icon-[lucide--search] pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
								<input
									type="text"
									className="dbx-form-input h-8 pl-8 text-[12px]"
									placeholder="搜索数据库类型..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>
							<div className="flex shrink-0 items-center overflow-hidden rounded-control border border-border bg-surface p-0.5">
								<button
									type="button"
									className={`dbx-view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
									onClick={() => setViewMode("grid")}
									title="宫格视图"
								>
									<span className="icon-[lucide--grid-3x3] h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									className={`dbx-view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
									onClick={() => setViewMode("list")}
									title="列表视图"
								>
									<span className="icon-[lucide--list] h-3.5 w-3.5" />
								</button>
							</div>
						</div>

						{/* 分类导航 + 类型列表 */}
						<div className="flex min-h-0 flex-1 gap-3">
							{/* 分类导航 */}
							<nav className="flex w-24 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface-raised py-2">
								{categories.map((cat) => (
									<button
										key={cat.key}
										type="button"
										className={`dbx-category-nav-item ${selectedCategory === cat.key ? "active" : ""}`}
										onClick={() => handleCategoryClick(cat.key)}
									>
										<span>{cat.label}</span>
										<span className="ml-auto font-mono text-[12px] text-faint">
											{cat.types.length}
										</span>
									</button>
								))}
							</nav>

							{/* 类型列表 */}
							<div
								ref={contentRef}
								className="flex-1 overflow-y-auto dbx-scroll"
							>
								{categories.map((cat) => (
									<div
										key={cat.key}
										ref={(el) => { categoryRefs.current[cat.key] = el; }}
										className="mb-4"
									>
										<h3 className="sticky top-0 z-10 mb-2 bg-surface px-1 py-1 text-[12px] font-semibold tracking-[0.06em] text-muted">
											{cat.label}
											<span className="ml-2 text-[12px] font-normal text-faint">
												{cat.types.length} 种
											</span>
										</h3>
										{viewMode === "grid" ? (
											<div className="grid grid-cols-3 gap-2.5">
												{cat.types.map((t) => (
													<button
														key={t.dbType}
														type="button"
														className="dbx-db-type-card"
														onClick={() => handleSelectDbType(t.dbType as DbType)}
													>
														<DatabaseTypeIcon dbType={t.dbType} size="medium" />
												<span className="w-full truncate text-left text-[13px] font-semibold text-surface-foreground">
															{t.label}
														</span>
													</button>
												))}
											</div>
										) : (
											<div className="flex flex-col gap-1">
												{cat.types.map((t) => (
													<button
														key={t.dbType}
														type="button"
														className="dbx-db-type-list-item"
														onClick={() => handleSelectDbType(t.dbType as DbType)}
													>
														<DatabaseTypeIcon dbType={t.dbType} size="small" />
														<span className="text-[12px] font-medium flex-1 text-left">
															{t.label}
														</span>
											<span className="font-mono text-[12px] text-faint">
															{t.dbType}
														</span>
													</button>
												))}
											</div>
										)}
									</div>
								))}
								{filteredTypes.length === 0 && (
									<div className="flex flex-col items-center justify-center py-8 text-muted">
										<span className="icon-[lucide--search-x] h-6 w-6 mb-2 opacity-50" />
										<span className="text-[12px]">无匹配结果</span>
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
					<button type="button" className="dbx-btn ghost" onClick={handleBackToSelect}>
						上一步
					</button>
					<div className="flex-1" />
					<button type="button" className="dbx-btn ghost" onClick={handleBackToList}>
						取消
					</button>
					<button type="button" className="dbx-btn primary" onClick={() => void handleSave()}>
						保存
					</button>
				</div>
			)}
		</div>
	);
}

/** 连接编辑三步：与设计稿 Stepper 同构。 */
const CONNECTION_STEPS = ["连接列表", "数据库类型", "连接配置"];

function Stepper({ current }: { current: number }): JSX.Element {
	return (
		<ol className="m-0 flex list-none items-center gap-2.5 p-0">
			{CONNECTION_STEPS.map((label, i) => {
				const done = i < current;
				const active = i === current;
				return (
					<li key={label} className="flex items-center gap-2.5">
						{i > 0 ? <span className="h-px w-5 bg-border-strong" /> : null}
						<span className="flex items-center gap-1.5 whitespace-nowrap">
							<span
								className={`grid size-5 place-items-center rounded-full font-mono text-[12px] tabular-nums ${
									done
										? "bg-primary text-primary-foreground"
										: active
											? "bg-accent text-accent-foreground"
											: "bg-neutral-muted text-muted"
								}`}
							>
								{done ? <span className="icon-[lucide--check] size-3" /> : i + 1}
							</span>
							<span
								className={`text-[12px] ${active ? "font-semibold text-surface-foreground" : "text-muted"}`}
							>
								{label}
							</span>
						</span>
					</li>
				);
			})}
		</ol>
	);
}
