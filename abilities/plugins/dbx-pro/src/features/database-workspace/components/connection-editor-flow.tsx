/**
 * 连接编辑流程主体 — 模态弹窗与宿主侧边栏整页共用的三步流程。
 *
 * 三步流程（对齐 dbx 桌面壳）：
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
import { resolveDatabaseIcon } from "../../../domain/database-icons";

export interface ConnectionEditorFlowProps {
	/** 连接增 / 删 / 改后通知外层重载工作台（回传受影响连接名）。 */
	onChange?: (name?: string) => void;
	/** 传入时头部显示关闭按钮（模态场景）；侧边栏整页不传。 */
	onClose?: () => void;
}

type DialogStep = "list" | "select" | "config";
type ViewMode = "grid" | "list";

interface Category {
	key: string;
	label: string;
	types: typeof DB_TYPE_MANIFEST;
}

/** 判定插件根当前是否深色（按背景亮度，兼容宿主强制主题）。 */
function detectDark(): boolean {
	const root = document.querySelector('[data-astravia-plugin-root="dbx-pro"]');
	const bg = root ? getComputedStyle(root).backgroundColor : "";
	const m = bg.match(/\d+(?:\.\d+)?/g);
	if (!m || m.length < 3) return true;
	const [r, g, b] = m.slice(0, 3).map(Number);
	return 0.299 * r + 0.587 * g + 0.114 * b < 90;
}

/**
 * 数据库类型图标 — 使用本地打包的真实品牌图形。
 * 未收录品牌回退到通用数据库图标（不是彩色字母占位块）。
 */
function DatabaseTypeIcon({ dbType, size = "medium" }: { dbType: string; size?: "small" | "medium" | "large" }): JSX.Element {
	const [isDark] = useState(detectDark);
	const sizeClasses = {
		small: "h-5 w-5",
		medium: "h-8 w-8",
		large: "h-10 w-10",
	};
	const icon = resolveDatabaseIcon(dbType, isDark);

	if (!icon) {
		// 通用数据库图形：明确的中性兜底，不伪造品牌
		return (
			<span
				className={`${sizeClasses[size]} flex items-center justify-center text-muted-foreground`}
			>
				<span className={`icon-[lucide--database] ${size === "small" ? "h-4 w-4" : "h-5 w-5"}`} />
			</span>
		);
	}

	return (
		<span className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden`}>
			<img
				src={icon.src}
				alt=""
				aria-hidden="true"
				className="h-full w-full object-contain"
				style={{
					transform: `scale(${icon.scale ?? 1})`,
					...(icon.darkFilter ? { filter: icon.darkFilter } : {}),
				}}
			/>
		</span>
	);
}

const RELATIONAL_TYPES = ["mysql", "postgres", "mariadb", "sqlite", "sqlserver", "oracle", "db2"];
const NOSQL_TYPES = ["mongodb", "redis", "elasticsearch", "cassandra", "neo4j"];
const ANALYTICS_TYPES = ["clickhouse", "snowflake", "bigquery", "doris", "starrocks"];

export function ConnectionEditorFlow({ onChange, onClose }: ConnectionEditorFlowProps): JSX.Element {
	const editor = useConnectionEditor({ onChange });
	const [step, setStep] = useState<DialogStep>("list");
	const [selectedDbType, setSelectedDbType] = useState<DbType>("mysql");
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
			const scrollTop = contentRef.current.scrollTop;
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
					<span className="icon-[lucide--database] h-4 w-4 text-muted-foreground shrink-0" />
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
						{/* 搜索栏和视图切换 */}
						<div className="flex items-center gap-2">
							<div className="relative flex-1">
								<span className="icon-[lucide--search] absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
								<input
									type="text"
									className="dbx-form-input pl-9 h-9 text-xs"
									placeholder="搜索数据库类型..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>
							<div className="flex items-center border border-border rounded-md overflow-hidden shrink-0">
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
							<nav className="flex shrink-0 flex-col gap-1 w-20 border-r border-border/50 pr-2 overflow-y-auto">
								{categories.map((cat) => (
									<button
										key={cat.key}
										type="button"
										className={`dbx-category-nav-item ${selectedCategory === cat.key ? "active" : ""}`}
										onClick={() => handleCategoryClick(cat.key)}
									>
										<span>{cat.label}</span>
										<span className="text-[9px] text-muted-foreground/60 ml-auto">
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
										<h3 className="text-[11px] font-semibold text-foreground mb-2 px-1 sticky top-0 bg-background py-1 z-10">
											{cat.label}
											<span className="text-[10px] font-normal text-muted-foreground ml-2">
												{cat.types.length} 种
											</span>
										</h3>
										{viewMode === "grid" ? (
											<div className="grid grid-cols-3 gap-2">
												{cat.types.map((t) => (
													<button
														key={t.dbType}
														type="button"
														className="dbx-db-type-card"
														onClick={() => handleSelectDbType(t.dbType as DbType)}
													>
														<DatabaseTypeIcon dbType={t.dbType} size="medium" />
														<span className="text-[11px] font-medium truncate text-center">
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
														<span className="text-[10px] text-muted-foreground">
															{t.dbType}
														</span>
													</button>
												))}
											</div>
										)}
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
