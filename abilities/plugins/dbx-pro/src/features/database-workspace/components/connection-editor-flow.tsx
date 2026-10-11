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
import { isReadyDbType, tierReasonText } from "../../../domain/driver-tiers";
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
	const [chosenDbType, setChosenDbType] = useState<DbType | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [selectedCategory, setSelectedCategory] = useState<string>("relational");
	const contentRef = useRef<HTMLDivElement>(null);
	const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
	// 点击左侧分类走的是平滑滚动：滚动期间的 scroll 事件不参与反算，
	// 否则滚不到顶部的末尾分类会被 scroll-spy 立刻改回上一项（左右不同步的主因）。
	const suppressSpyRef = useRef(false);
	const spySettleTimerRef = useRef<number | null>(null);

	// 从列表页进入新建流程
	function handleCreateNew(): void {
		editor.startNew();
		setStep("select");
	}

	// 从列表页进入编辑流程
	function handleEdit(conn: DbConnection): void {
		editor.startEdit({ ...conn });
		setChosenDbType(conn.db_type);
		setStep("config");
	}

	// 从类型选择进入配置
	function handleSelectDbType(dbType: DbType): void {
		setChosenDbType(dbType);
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
		// 锁住反向同步：平滑滚动结束前不让 scroll-spy 覆盖刚点选的分类
		suppressSpyRef.current = true;
		if (spySettleTimerRef.current !== null) window.clearTimeout(spySettleTimerRef.current);
		spySettleTimerRef.current = window.setTimeout(() => {
			suppressSpyRef.current = false;
			spySettleTimerRef.current = null;
		}, 480);
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
			const content = contentRef.current;
			if (!content) return;
			// 程序化滚动（点击左侧分类）期间跳过反算，避免刚选中的分类被改回去
			if (suppressSpyRef.current) return;
			const containerTop = content.getBoundingClientRect().top;

			// 找到当前可见的分类
			let currentCategory = "";
			for (const [key, element] of Object.entries(categoryRefs.current)) {
				if (element) {
					const elementTop = element.getBoundingClientRect().top;
					const relativeTop = elementTop - containerTop;
					if (relativeTop <= 50) {
						currentCategory = key;
					}
				}
			}
			// 滚到底部时最后一段可能永远够不到阈值线，此时按「最后一段」判定
			if (content.scrollTop + content.clientHeight >= content.scrollHeight - 4) {
				const keys = Object.keys(categoryRefs.current).filter((k) => categoryRefs.current[k]);
				const lastKey = keys[keys.length - 1];
				if (lastKey) currentCategory = lastKey;
			}
			setSelectedCategory(currentCategory || "relational");
		};

		const contentElement = contentRef.current;
		if (contentElement) {
			contentElement.addEventListener("scroll", handleScroll);
			// 初始触发一次
			handleScroll();
			return () => {
				contentElement.removeEventListener("scroll", handleScroll);
				if (spySettleTimerRef.current !== null) window.clearTimeout(spySettleTimerRef.current);
			};
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

	// 当前选中类型（用于「已选」chip 与卡片选中态）；未选择时不显示
	const chosenEntry = chosenDbType ? DB_TYPE_MANIFEST.find((t) => t.dbType === chosenDbType) : undefined;
	// 可直接查询的类型数：直接读 driver-tiers 的真实判定，不写死数字
	const readyTypeCount = DB_TYPE_MANIFEST.filter((t) => isReadyDbType(t.dbType)).length;
	const editingTypeLabel = editor.editing
		? (DB_TYPE_MANIFEST.find((t) => t.dbType === editor.editing?.db_type)?.label ?? editor.editing.db_type)
		: "";

	return (
		<div className="dbx-connection-flow">
			{/* 头部 */}
			<div className="dbx-connection-header">
				<div className="flex items-center gap-2 min-w-0 flex-1">
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
				{step === "select" && (
					<span className="ml-auto shrink-0 font-mono text-[12px] tabular-nums whitespace-nowrap text-muted">
						{DB_TYPE_MANIFEST.length} 种
					</span>
				)}
				{step === "config" && (
					<span className="ml-auto shrink-0 text-[12px] whitespace-nowrap text-muted">
						连接信息只保存在本机
					</span>
				)}
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
				{step === "select" && (
					<span className="ml-auto text-[12px] tabular-nums whitespace-nowrap text-faint">
						共 {DB_TYPE_MANIFEST.length} 种 · {readyTypeCount} 种可直接查询
					</span>
				)}
				{step === "config" && editor.editing && (
					<div className="ml-auto flex shrink-0 items-center gap-2">
						<div className="dbx-conn-typechip">
							<span className="dbx-conn-typechip__badge is-brand"><DatabaseTypeIcon dbType={editor.editing.db_type} size="small" /></span>
							{editingTypeLabel}
						</div>
						<button type="button" className="dbx-btn ghost" onClick={handleBackToSelect}>
							<span className="icon-[lucide--chevron-left] size-3.5" />
							更改
						</button>
					</div>
				)}
			</div>

			{/* 内容区 */}
			<div className={`dbx-connection-body${step === "list" || step === "select" ? " is-flush" : ""}`}>
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
					<>
						{/* 第 2 行：搜索 / 已选 / 视图切换（设计稿 h-11） */}
						<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
							<div className="dbx-conn-search">
								<span className="icon-[lucide--search] size-3.5 shrink-0 text-muted" />
								<input
									type="text"
									placeholder="搜索数据库类型..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>
							{chosenEntry && (
								<>
									<span className="text-[12px] whitespace-nowrap text-muted">已选</span>
									<span className="dbx-conn-chip">{chosenEntry.label}</span>
								</>
							)}
							<div className="dbx-conn-toggle ml-auto">
								<button
									type="button"
									className={`dbx-view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
									onClick={() => setViewMode("grid")}
									title="卡片视图"
								>
									<span className="icon-[lucide--layout-grid] size-3.5" />
								</button>
								<button
									type="button"
									className={`dbx-view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
									onClick={() => setViewMode("list")}
									title="列表视图"
								>
									<span className="icon-[lucide--list] size-3.5" />
								</button>
							</div>
						</div>

						{/* 分类导航（176px）+ 类型卡片（三列） */}
						<div className="flex min-h-0 flex-1">
							<nav className="dbx-conn-nav">
								<div className="dbx-conn-nav__head">分类</div>
								{categories.map((cat) => (
									<button
										key={cat.key}
										type="button"
										className={`dbx-category-nav-item ${selectedCategory === cat.key ? "active" : ""}`}
										onClick={() => handleCategoryClick(cat.key)}
									>
										<span className="truncate">{cat.label}</span>
										<span className="ml-auto font-mono text-[12px] tabular-nums text-faint">
											{cat.types.length}
										</span>
									</button>
								))}
								<div className="dbx-conn-nav__note">
									范围外的类型可以保存连接，但不能直接在插件里查询。
								</div>
							</nav>

							<div ref={contentRef} className="dbx-db-type-grid dbx-scroll">
								{categories.map((cat) => (
									<div
										key={cat.key}
										ref={(el) => { categoryRefs.current[cat.key] = el; }}
										className={
											viewMode === "grid"
												? "col-span-3 grid grid-cols-3 content-start gap-3"
												: "col-span-3 flex flex-col gap-1"
										}
									>
										<h3 className="dbx-db-type-grid__head">
											{cat.label}
											<span className="ml-2 font-normal text-faint">{cat.types.length} 种</span>
										</h3>
										{viewMode === "grid"
											? cat.types.map((t) => (
													<button
														key={t.dbType}
														type="button"
														className={`dbx-db-type-card ${chosenDbType === t.dbType ? "is-selected" : ""}`}
														onClick={() => handleSelectDbType(t.dbType as DbType)}
													>
														{chosenDbType === t.dbType && (
															<span className="dbx-db-type-card__check icon-[lucide--check]" />
														)}
														<span className="dbx-db-type-card__head">
															<span className="dbx-db-type-card__badge is-brand">
																<DatabaseTypeIcon dbType={t.dbType} size="medium" />
															</span>
															<span className="dbx-db-type-card__body">
																<span className="dbx-db-type-card__name">{t.label}</span>
																<span className="dbx-db-type-card__meta">
																	{t.defaultPort > 0 ? `${t.defaultPort} ·` : "文件 ·"}
																	<span className={tierToneClass(t.dbType)}>
																		{" "}
																		{tierText(t.dbType)}
																	</span>
																</span>
															</span>
														</span>
														<span className="dbx-db-type-card__desc">
															{tierReasonText(t.dbType)}
														</span>
													</button>
											))
											: cat.types.map((t) => (
													<button
														key={t.dbType}
														type="button"
														className={`dbx-db-type-list-item ${chosenDbType === t.dbType ? "is-selected" : ""}`}
														onClick={() => handleSelectDbType(t.dbType as DbType)}
													>
														<span className="dbx-conn-typechip__badge is-brand">
															<DatabaseTypeIcon dbType={t.dbType} size="small" />
														</span>
														<span className="flex-1 truncate text-left text-[13px] font-semibold text-surface-foreground">
															{t.label}
														</span>
														<span className="font-mono text-[12px] tabular-nums text-faint">
															{t.defaultPort > 0 ? t.defaultPort : "文件"}
														</span>
													</button>
											))}
									</div>
								))}
								{filteredTypes.length === 0 && (
									<div className="col-span-3 flex flex-col items-center justify-center py-8 text-muted">
										<span className="icon-[lucide--search-x] mb-2 size-6 opacity-50" />
										<span className="text-[12px]">无匹配结果</span>
									</div>
								)}
							</div>
						</div>
					</>
				)}

				{/* 选择步底部：上一步 / 取消 / 下一步（设计稿 h-14） */}
				{step === "select" && (
					<div className="dbx-connection-footer">
						<button type="button" className="dbx-btn ghost" onClick={handleBackToList}>
							<span className="icon-[lucide--chevron-left] size-3.5" />
							上一步
						</button>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<button type="button" className="dbx-btn" onClick={handleBackToList}>
								取消
							</button>
							<button
								type="button"
								className="dbx-btn primary"
								disabled={!chosenDbType}
								onClick={() => { if (chosenDbType) handleSelectDbType(chosenDbType); }}
							>
								下一步 · 连接配置
								<span className="icon-[lucide--chevron-right] size-3" />
							</button>
						</div>
					</div>
				)}

				{step === "config" && editor.editing && (
					<ConnectionFields
						conn={editor.editing}
						onChange={(c) => editor.setEditing(c)}
						onTypeChange={(dbType) => {
							editor.setDbType(dbType);
							setChosenDbType(dbType as DbType);
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
					<button
						type="button"
						className="dbx-btn"
						disabled={editor.testing}
						onClick={() => { if (editor.editing) void editor.test(editor.editing); }}
					>
						<span className="icon-[lucide--plug] size-3.5" />
						{editor.testing ? "测试中…" : "测试连接"}
					</button>
					{editor.testResult && (
						<div className={`dbx-conn-test${editor.testResult.startsWith("❌") ? " is-error" : ""}`}>
							<span
								className={
									editor.testResult.startsWith("❌")
										? "icon-[lucide--circle-x] size-3.5 shrink-0"
										: "icon-[lucide--circle-check] size-3.5 shrink-0"
								}
							/>
							<span className="dbx-conn-test__text">
								{editor.testResult.replace(/^[✅❌]\s*/, "")}
							</span>
						</div>
					)}
					<div className="ml-auto flex shrink-0 items-center gap-2">
						<button type="button" className="dbx-btn ghost" onClick={handleBackToList}>
							取消
						</button>
						<button type="button" className="dbx-btn primary" onClick={() => void handleSave()}>
							<span className="icon-[lucide--plug-zap] size-3.5" />
							保存并连接
						</button>
					</div>
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

/** 档位文案：引擎覆盖即「可直接查询」（domain/driver-tiers 对已支持类型统一返回 ready）。 */
function tierText(dbType: string): string {
	return isReadyDbType(dbType) ? "可直接查询" : "试验性";
}

function tierToneClass(dbType: string): string {
	return isReadyDbType(dbType) ? "text-success" : "text-warning";
}
