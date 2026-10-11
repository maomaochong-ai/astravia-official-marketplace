/**
 * 数据库工作台设置面板
 *
 * 分类结构对齐 dbx 桌面壳 Data 标签：
 * 查询结果 / 数据网格 / 结果标签 / 导出 / 侧边栏 / 历史 / 关于
 */

import { useState, useEffect, useLayoutEffect, useRef, type JSX } from "react";
import {
	SETTINGS_BOUNDS,
	isDefaultSettings,
	parsePageSizeInput,
	type WorkbenchSettings,
} from "../../../domain/workbench-settings";
import { engineHealth } from "../../../shared/services/engine-client";
import { pageSizeNotice } from "../services/page-size-notice";
// 版本号直接取 domain 模块（plugin-version.ts 的注释即为此约定）：引 index 会把插件
// 装配入口（含全部 CSS 与 SDK）拖进组件依赖，组件也无法脱离宿主单独测试。
import { PLUGIN_VERSION } from "../../../domain/plugin-version";

interface Props {
	settings: WorkbenchSettings;
	onChange: (next: WorkbenchSettings) => void;
	onReset: () => void;
	onClearHistory: () => void;
	onClose: () => void;
	onWipeData: () => void;
}

type SettingsCategory = "query" | "grid" | "resultTab" | "export" | "sidebar" | "history" | "about";

const CATEGORY_GROUPS = ["数据管理", "其他"] as const;

const CATEGORIES: { key: SettingsCategory; label: string; subtitle: string; group: (typeof CATEGORY_GROUPS)[number] }[] = [
	{ key: "query", label: "查询结果", subtitle: "默认分页、超时与结果总量", group: "数据管理" },
	{ key: "grid", label: "数据网格", subtitle: "结果网格的显示与交互行为", group: "数据管理" },
	{ key: "resultTab", label: "结果标签", subtitle: "结果标签的命名与来源显示", group: "数据管理" },
	{ key: "export", label: "导出", subtitle: "导出全部数据时的取数与行数上限", group: "数据管理" },
	{ key: "sidebar", label: "树交互", subtitle: "连接树节点的选中与打开方式", group: "数据管理" },
	{ key: "history", label: "历史", subtitle: "查询历史的记录与保留条数", group: "数据管理" },
	{ key: "about", label: "关于", subtitle: "版本信息与本地数据管理", group: "其他" },
];

/** 设置项变更：key 与 value 类型绑定，避免用 unknown 抹掉类型安全。 */
type SettingChange = <K extends keyof WorkbenchSettings>(key: K, value: WorkbenchSettings[K]) => void;

export function SettingsPanel({ settings, onChange, onReset, onClearHistory, onClose, onWipeData }: Props): JSX.Element {
	const [activeCategory, setActiveCategory] = useState<SettingsCategory>("query");
	const [confirmWipe, setConfirmWipe] = useState(false);
	const [search, setSearch] = useState("");
	const [rowCount, setRowCount] = useState(0);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const keyword = search.trim();
	const filteredCategories = keyword ? CATEGORIES.filter((cat) => cat.label.includes(keyword)) : CATEGORIES;
	const effectiveCategory = filteredCategories.some((cat) => cat.key === activeCategory)
		? activeCategory
		: (filteredCategories[0]?.key ?? activeCategory);
	const activeMeta = CATEGORIES.find((cat) => cat.key === effectiveCategory);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	// 内容头的「N 项」按当前真正渲染出的设置行统计：条件行（如「历史条数上限」「最大导出行数」）
	// 跟着开关出现或消失，写死一份分类计数迟早会和实际渲染漂移。
	useLayoutEffect(() => {
		setRowCount(bodyRef.current?.querySelectorAll("[data-settings-row]").length ?? 0);
	}, [effectiveCategory, settings]);

	function updateSetting<K extends keyof WorkbenchSettings>(key: K, value: WorkbenchSettings[K]): void {
		onChange({ ...settings, [key]: value });
	}

	return (
		<>
			<div className="dbx-sheet-backdrop" onClick={onClose} />
			<div
				className="dbx-sheet w-[880px] max-w-[calc(100%-2rem)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-4">
					<label className="dbx-settings-search">
						<span className="icon-[lucide--search] h-3.5 w-3.5 shrink-0 text-faint" />
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="搜索设置项"
							aria-label="搜索设置项"
						/>
					</label>
					<div className="ml-auto flex shrink-0 items-center gap-1">
						<button
							type="button"
							onClick={onClose}
							title="关闭"
							className="dbx-iconbtn"
							style={{ height: 28, minWidth: 28 }}
						>
							<span className="icon-[lucide--x] h-3.5 w-3.5" />
						</button>
					</div>
				</div>

				<div className="flex flex-1 min-h-0 flex-col">
				<div className="flex min-h-0 flex-1">
					<nav className="dbx-settings-nav">
						{CATEGORY_GROUPS.map((group, groupIdx) => {
							const items = filteredCategories.filter((cat) => cat.group === group);
							if (items.length === 0) return null;
							return (
								<div key={group} className="contents">
									<div className={"dbx-settings-nav__group" + (groupIdx > 0 ? " mt-3" : "")}>{group}</div>
									{items.map((cat) => (
										<button
											key={cat.key}
											type="button"
											className={"dbx-category-nav-item" + (effectiveCategory === cat.key ? " active" : "")}
											onClick={() => setActiveCategory(cat.key)}
										>
											{cat.label}
										</button>
									))}
								</div>
							);
						})}
					</nav>

					<div className="flex min-w-0 flex-1 flex-col">
						<div className="dbx-settings-content-header">
							<h3 className="shrink-0 text-[14px] font-semibold text-surface-foreground">{activeMeta?.label ?? ""}</h3>
							<span className="truncate text-[12px] text-muted">{activeMeta?.subtitle ?? ""}</span>
							<span className="ml-auto shrink-0 text-[12px] tabular-nums text-faint">{rowCount} 项</span>
						</div>
						<div ref={bodyRef} className="dbx-settings-body dbx-scroll min-h-0 flex-1 overflow-y-auto bg-surface px-4 pb-4">
						{effectiveCategory === "query" && (
							<QueryResultSettings settings={settings} onChange={updateSetting} />
						)}
						{effectiveCategory === "grid" && (
							<DataGridSettings settings={settings} onChange={updateSetting} />
						)}
						{effectiveCategory === "resultTab" && (
							<ResultTabSettings settings={settings} onChange={updateSetting} />
						)}
						{effectiveCategory === "export" && (
							<ExportSettings settings={settings} onChange={updateSetting} />
						)}
						{effectiveCategory === "sidebar" && (
							<SidebarSettings />
						)}
						{effectiveCategory === "history" && (
							<HistorySettings settings={settings} onChange={updateSetting} onClearHistory={onClearHistory} />
						)}
						{effectiveCategory === "about" && (
							<AboutSection onWipeData={onWipeData} confirmWipe={confirmWipe} setConfirmWipe={setConfirmWipe} />
						)}
						</div>
					</div>
				</div>
				<div className="dbx-settings-footer">
					<button
						type="button"
						onClick={onReset}
						disabled={isDefaultSettings(settings)}
						className="dbx-btn ghost disabled:opacity-50"
					>
						<span className="icon-[lucide--rotate-ccw] h-3.5 w-3.5" />
						恢复默认设置
					</button>
					<span className="dbx-settings-footer__note">已保存到本地 · 偏好随插件数据目录，不写入连接配置</span>
					<button type="button" onClick={onClose} className="dbx-btn primary">
						完成
					</button>
				</div>
			</div>
			</div>
		</>
	);
}

/** 查询结果设置（对齐 dbx Data > Query Results） */
function QueryResultSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: SettingChange }): JSX.Element {
	const maxRowsBounds = SETTINGS_BOUNDS.queryResultMaxRows;
	return (
		<div className="dbx-setting-list">
			<SettingRow
				label="SQL 安全策略"
				hint="控制插件内 SQL 执行的写权限：strict=只读、writeAllowed=写/DDL 每次确认、permissive=放行所有自动确认。走自研直连驱动（不经过 dbx-mcp 的 SQL_BLOCKED 闸门）。"
			>
				<select
					className="dbx-form-input"
					value={settings.sqlSafetyMode}
					onChange={(e) => onChange("sqlSafetyMode", e.target.value as WorkbenchSettings["sqlSafetyMode"])}
				>
					<option value="strict">🔒 严格只读（默认）</option>
					<option value="writeAllowed">✏️ 允许写（每次确认）</option>
					<option value="permissive">⚠️ 全量放行（自动确认）</option>
				</select>
			</SettingRow>

			<PageSizeField
				label="默认每页行数"
				hint={`查询结果分页页大小（${SETTINGS_BOUNDS.rowLimit.min}–${SETTINGS_BOUNDS.rowLimit.max.toLocaleString()}）`}
				value={settings.rowLimit}
				bounds={SETTINGS_BOUNDS.rowLimit}
				onChange={(next) => onChange("rowLimit", next)}
			/>

			<PageSizeField
				label="表打开默认行数"
				hint={`点击树节点预览数据时的默认页大小（${SETTINGS_BOUNDS.tableOpenPageSize.min}–${SETTINGS_BOUNDS.tableOpenPageSize.max.toLocaleString()}）`}
				value={settings.tableOpenPageSize}
				bounds={SETTINGS_BOUNDS.tableOpenPageSize}
				onChange={(next) => onChange("tableOpenPageSize", next)}
			/>

			<SettingRow label="查询超时（秒）" hint="超时后自动取消查询">
				<div className="dbx-number-control">
					<input
						type="number"
						min={SETTINGS_BOUNDS.queryTimeoutSecs.min}
						max={SETTINGS_BOUNDS.queryTimeoutSecs.max}
						value={settings.queryTimeoutSecs}
						onChange={(e) => onChange("queryTimeoutSecs", clampInt(e.target.value, SETTINGS_BOUNDS.queryTimeoutSecs.min, SETTINGS_BOUNDS.queryTimeoutSecs.max, settings.queryTimeoutSecs))}
					/>
					<span className="dbx-number-control__unit">秒</span>
				</div>
			</SettingRow>

			<SettingRow label="限制查询结果总量" hint="开启后最多取回下方设定的行数（循环分页取数）；关闭后取到引擎单次上限（1000 行）即止。">
				<label className="flex items-center">
					<input
						type="checkbox"
						aria-label="限制查询结果总量"
						checked={settings.queryResultMaxRowsEnabled}
						onChange={(e) => onChange("queryResultMaxRowsEnabled", e.target.checked)}
					/>
				</label>
			</SettingRow>

			{settings.queryResultMaxRowsEnabled && (
				<SettingRow
					label="查询结果最大行数"
					hint={`${maxRowsBounds.min.toLocaleString()}–${maxRowsBounds.max.toLocaleString()}`}
				>
					<div className="dbx-number-control">
						<input
							type="number"
							min={maxRowsBounds.min}
							max={maxRowsBounds.max}
							value={settings.queryResultMaxRows}
							onChange={(e) =>
								onChange(
									"queryResultMaxRows",
									clampInt(e.target.value, maxRowsBounds.min, maxRowsBounds.max, settings.queryResultMaxRows),
								)
							}
						/>
						<span className="dbx-number-control__unit">行</span>
					</div>
				</SettingRow>
			)}

			<SettingRow
				label="总行数统计"
				hint="服务端分页结果总是自动统计总行数；失败时分页栏显示「总数未知」，可点分页栏的刷新按钮重试"
			/>

			<SettingRow label="无限滚动" hint="滚到底部时自动加载下一页数据（对齐 dbx infiniteScroll）">
				<label className="flex items-center">
					<input
						type="checkbox"
						aria-label="无限滚动"
						checked={settings.infiniteScroll}
						onChange={(e) => onChange("infiniteScroll", e.target.checked)}
					/>
				</label>
			</SettingRow>

			<SettingRow label="多语句默认视图" hint="执行多语句后的默认视图">
				<div className="dbx-segmented" role="group" aria-label="多语句默认视图">
					{([
						["result", "结果视图"],
						["messages", "消息视图"],
					] as const).map(([value, label]) => (
						<button
							key={value}
							type="button"
							aria-pressed={settings.multiStatementDefaultView === value}
							onClick={() => onChange("multiStatementDefaultView", value)}
							className="dbx-segmented__item"
						>
							{label}
						</button>
					))}
				</div>
			</SettingRow>

			<SettingRow label="执行计划默认视图" hint="EXPLAIN 的默认视图">
				<div className="dbx-segmented" role="group" aria-label="执行计划默认视图">
					{([
						["table", "表格视图"],
						["canvas", "图形视图"],
					] as const).map(([value, label]) => (
						<button
							key={value}
							type="button"
							aria-pressed={settings.defaultExplainView === value}
							onClick={() => onChange("defaultExplainView", value)}
							className="dbx-segmented__item"
						>
							{label}
						</button>
					))}
				</div>
			</SettingRow>
		</div>
	);
}

/** 数据网格显示设置（对齐 dbx Data > Data Grid Display） */
function DataGridSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: SettingChange }): JSX.Element {
	return (
		<div className="dbx-setting-list">
			<SettingRow label="斑马纹行" hint="交替行背景色（对齐 dbx dataGridStripedRows）">
				<label className="flex items-center">
					<input
						type="checkbox"
						aria-label="斑马纹行"
						checked={settings.dataGridStripedRows}
						onChange={(e) => onChange("dataGridStripedRows", e.target.checked)}
					/>
				</label>
			</SettingRow>

			<SettingRow label="十字准线高亮" hint="高亮当前单元格所在的行和列（对齐 dbx dataGridCrosshairHighlight）">
				<label className="flex items-center">
					<input
						type="checkbox"
						aria-label="十字准线高亮"
						checked={settings.dataGridCrosshairHighlight}
						onChange={(e) => onChange("dataGridCrosshairHighlight", e.target.checked)}
					/>
				</label>
			</SettingRow>

			<SettingRow label="单元格详情按钮" hint="双击单元格弹出详情弹窗（对齐 dbx dataGridCellDetailButtonVisible）">
				<label className="flex items-center">
					<input
						type="checkbox"
						aria-label="单元格详情按钮"
						checked={settings.dataGridCellDetailButtonVisible}
						onChange={(e) => onChange("dataGridCellDetailButtonVisible", e.target.checked)}
					/>
				</label>
			</SettingRow>
		</div>
	);
}

/** 结果标签设置（对齐 dbx Data > Result tab settings） */
function ResultTabSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: SettingChange }): JSX.Element {
	return (
		<div className="dbx-setting-list">
			<SettingRow label="命名方式" hint="新结果标签的命名方式（对齐 dbx resultTabNamingMode）">
				<div className="dbx-segmented" role="group" aria-label="命名方式">
					{([
						["source", "按来源命名"],
						["table", "按表名命名"],
						["sequential", "按序号命名"],
					] as const).map(([value, label]) => (
						<button
							key={value}
							type="button"
							aria-pressed={settings.resultTabNamingMode === value}
							onClick={() => onChange("resultTabNamingMode", value)}
							className="dbx-segmented__item"
						>
							{label}
						</button>
					))}
				</div>
			</SettingRow>

			<SettingRow label="显示来源数据库" hint="在结果标签中显示数据库名（对齐 dbx showResultSourceDatabase）">
				<label className="flex items-center">
					<input
						type="checkbox"
						aria-label="显示来源数据库"
						checked={settings.showResultSourceDatabase}
						onChange={(e) => onChange("showResultSourceDatabase", e.target.checked)}
					/>
				</label>
			</SettingRow>
		</div>
	);
}

/** 侧边栏设置（对齐 dbx Navigation） */
function SidebarSettings(): JSX.Element {
	return (
		<div className="dbx-setting-list">
			<SettingRow label="连接树节点" hint="选中与打开查询的方式">
				<span className="max-w-[360px] text-[12px] leading-relaxed text-muted">
					单击：连接展开、表节点只是选中，不会打开或执行查询。
					<br />
					双击：连接新建查询标签页，表节点预览数据（打开并执行 SELECT）。
					<br />
					右键：预览数据、查看表结构、生成 SQL、统计行数、可视化等。
				</span>
			</SettingRow>
		</div>
	);
}

/** 历史设置（对齐 dbx Data > History Retention） */
function HistorySettings({ settings, onChange, onClearHistory }: { settings: WorkbenchSettings; onChange: SettingChange; onClearHistory: () => void }): JSX.Element {
	return (
		<div className="dbx-setting-list">
			<SettingRow label="记录查询历史" hint="记录 SQL、耗时与行数">
				<label className="flex items-center">
					<input
						type="checkbox"
						aria-label="记录查询历史"
						checked={settings.historyEnabled}
						onChange={(e) => onChange("historyEnabled", e.target.checked)}
					/>
				</label>
			</SettingRow>

			{settings.historyEnabled && (
				<SettingRow label="历史条数上限" hint="超出后自动清理最旧的记录">
					<div className="dbx-number-control">
						<input
							type="number"
							min={SETTINGS_BOUNDS.historyLimit.min}
							max={SETTINGS_BOUNDS.historyLimit.max}
							value={settings.historyLimit}
							onChange={(e) => onChange("historyLimit", clampInt(e.target.value, SETTINGS_BOUNDS.historyLimit.min, SETTINGS_BOUNDS.historyLimit.max, settings.historyLimit))}
						/>
						<span className="dbx-number-control__unit">条</span>
					</div>
				</SettingRow>
			)}

			<button
				type="button"
				onClick={onClearHistory}
				className="dbx-btn ghost w-full text-left"
			>
				<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
				清空查询历史
			</button>
		</div>
	);
}

/** 导出设置（对齐 dbx Data > Export） */
function ExportSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: SettingChange }): JSX.Element {
	const bounds = SETTINGS_BOUNDS.exportRowLimit;
	const batchBounds = SETTINGS_BOUNDS.exportBatchSize;
	return (
		<div className="dbx-setting-list">
			<SettingRow
				label="每批取行数"
				hint={`导出全部数据时每批从引擎取回的行数（${batchBounds.min.toLocaleString()}–${batchBounds.max.toLocaleString()}）`}
			>
				<div className="dbx-number-control">
					<input
						type="number"
						min={batchBounds.min}
						max={batchBounds.max}
						value={settings.exportBatchSize}
						onChange={(e) =>
							onChange(
								"exportBatchSize",
								clampInt(e.target.value, batchBounds.min, batchBounds.max, settings.exportBatchSize),
							)
						}
					/>
					<span className="dbx-number-control__unit">行</span>
				</div>
			</SettingRow>

			<SettingRow label="限制导出行数" hint="默认关闭：「导出全部数据」循环拉取到末页；开启后最多导出下方设定的行数。">
				<label className="flex items-center gap-1.5 text-[12px] text-surface-foreground">
					<input
						type="checkbox"
						checked={settings.exportLimitEnabled}
						onChange={(e) => onChange("exportLimitEnabled", e.target.checked)}
					/>
					启用行数限制
				</label>
			</SettingRow>

			{settings.exportLimitEnabled && (
				<SettingRow
					label="最大导出行数"
					hint={`${bounds.min.toLocaleString()}–${bounds.max.toLocaleString()}`}
				>
					<div className="dbx-number-control">
						<input
							type="number"
							min={bounds.min}
							max={bounds.max}
							value={settings.exportRowLimit}
							onChange={(e) =>
								onChange(
									"exportRowLimit",
									clampInt(e.target.value, bounds.min, bounds.max, settings.exportRowLimit),
								)
							}
						/>
						<span className="dbx-number-control__unit">行</span>
					</div>
				</SettingRow>
			)}
		</div>
	);
}

/** 关于部分 */
function AboutSection({ onWipeData, confirmWipe, setConfirmWipe }: { onWipeData: () => void; confirmWipe: boolean; setConfirmWipe: (v: boolean) => void }): JSX.Element {
	const [engineVersion, setEngineVersion] = useState<string | null>(null);
	useEffect(() => {
		let cancelled = false;
		engineHealth()
			.then((health) => {
				if (!cancelled) setEngineVersion(health.version || null);
			})
			.catch(() => {
				if (!cancelled) setEngineVersion(null);
			});
		return () => {
			cancelled = true;
		};
	}, []);
	return (
		<div className="space-y-4">
			<div className="dbx-panel-group">
				<div className="dbx-panel-group-body space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-[12px] text-muted">版本</span>
						<span className="text-[12px] font-mono text-surface-foreground">{PLUGIN_VERSION}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-[12px] text-muted">引擎版本</span>
						<span className="text-[12px] font-mono text-surface-foreground">{engineVersion ?? "—"}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-[12px] text-muted">协议版本</span>
						<span className="text-[12px] font-mono text-surface-foreground">2.0.0</span>
					</div>
				</div>
			</div>

			<div className="dbx-panel-group">
				<div className="dbx-panel-group-header">数据管理</div>
				<div className="dbx-panel-group-body space-y-2">
					{confirmWipe ? (
						<div className="flex items-center gap-2 pt-2">
							<span className="text-[12px] font-medium text-danger">确认清除全部本地数据？</span>
							<span className="flex-1" />
							<button
								type="button"
								onClick={() => { setConfirmWipe(false); onWipeData(); }}
								className="rounded-control bg-danger px-2 py-1 text-[12px] font-medium text-primary-fg hover:bg-danger/90"
							>
								确认清除
							</button>
							<button
								type="button"
								onClick={() => setConfirmWipe(false)}
								className="rounded-control border border-border px-2 py-1 text-[12px] text-muted hover:bg-neutral-muted"
							>
								保留数据
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setConfirmWipe(true)}
							className="dbx-btn ghost w-full text-left text-destructive"
						>
							<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
							清除全部本地数据
						</button>
					)}
				</div>
			</div>

			<div className="rounded-control bg-surface-raised px-3 py-2 text-[12px] leading-relaxed text-muted">
				密码保存在宿主加密凭据库；读取走引擎服务，写 / DDL 走自研驱动，执行前会弹窗展示完整 SQL 由你确认。
			</div>
		</div>
	);
}

/**
 * 每页行数输入框：编辑期间只改本地文本，失焦 / 回车才写回设置。
 *
 * 历史缺陷：每次按键都夹逼，且超上限时被静默改回上限值。用户输入 2000 时看不到自己
 * 敲的字符，输入 20000 时数字自己变小又没有任何解释，只能以为自定义行数没生效。
 * 这里把夹逼推迟到提交，并在越界时说明实际会取哪个值。
 */
function PageSizeField({ label, hint, value, bounds, onChange }: {
	label: string;
	hint: string;
	value: number;
	bounds: { min: number; max: number };
	onChange: (next: number) => void;
}): JSX.Element {
	const [text, setText] = useState(String(value));
	const [notice, setNotice] = useState<string | null>(null);
	const editingRef = useRef(false);
	// 自己提交出去的值：只有外部把设置改成别的（重置 / 底栏「设为默认」）才覆盖输入框。
	const committedRef = useRef(value);

	useEffect(() => {
		if (editingRef.current || value === committedRef.current) return;
		committedRef.current = value;
		setText(String(value));
		setNotice(null);
	}, [value]);

	function edit(next: string): void {
		editingRef.current = true;
		setText(next);
		setNotice(pageSizeNotice(parsePageSizeInput(next, value)));
	}

	function commit(): void {
		editingRef.current = false;
		const parsed = parsePageSizeInput(text, value);
		// 提示按用户原输入算：提交后继续说明「你敲的值被改成了上限」。
		setText(String(parsed.value));
		setNotice(pageSizeNotice(parsed));
		if (parsed.value === value) return;
		committedRef.current = parsed.value;
		onChange(parsed.value);
	}

	return (
		<SettingRow label={label} hint={hint}>
			<div className="flex flex-col items-end gap-1">
			<div className="dbx-number-control">
				<input
					type="number"
					inputMode="numeric"
					aria-label={label}
					min={bounds.min}
					max={bounds.max}
					value={text}
					onFocus={() => { editingRef.current = true; }}
					onChange={(e) => edit(e.target.value)}
					onBlur={commit}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commit();
						}
					}}
				/>
				<span className="dbx-number-control__unit">行</span>
			</div>
				{notice ? <p className="text-[11px] leading-relaxed text-warning">{notice}</p> : null}
			</div>
		</SettingRow>
	);
}

/** 设置行组件 */
// children 可缺省：用于只有 label + hint 的说明行（例如「总行数统计」）。
function SettingRow({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }): JSX.Element {
	// data-settings-row 供内容头统计「N 项」，见 SettingsPanel 里的 useLayoutEffect。
	return (
		<div className="dbx-setting-row" data-settings-row="">
			<div className="dbx-setting-row__text">
				<div className="dbx-setting-row__label">{label}</div>
				{hint ? <p className="dbx-setting-row__hint">{hint}</p> : null}
			</div>
			<div className="dbx-setting-row__control">{children}</div>
		</div>
	);
}

/** 整数夹逼工具函数 */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric)) return fallback;
	const rounded = Math.trunc(numeric);
	if (rounded < min) return min;
	if (rounded > max) return max;
	return rounded;
}
