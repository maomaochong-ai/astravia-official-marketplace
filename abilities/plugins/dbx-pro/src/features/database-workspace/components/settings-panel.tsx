/**
 * 数据库工作台设置面板
 *
 * 分类结构对齐 dbx 桌面壳 Data 标签：
 * 查询结果 / 数据网格 / 结果标签 / 导出 / 侧边栏 / 历史 / 关于
 */

import { useState, useEffect, type JSX } from "react";
import {
	SETTINGS_BOUNDS,
	isDefaultSettings,
	type WorkbenchSettings,
} from "../../../domain/workbench-settings";
import { engineHealth } from "../../../shared/services/engine-client";
import { PLUGIN_VERSION } from "../../../index";

interface Props {
	settings: WorkbenchSettings;
	onChange: (next: WorkbenchSettings) => void;
	onReset: () => void;
	onClearHistory: () => void;
	onClose: () => void;
	onWipeData: () => void;
}

type SettingsCategory = "query" | "grid" | "resultTab" | "export" | "sidebar" | "history" | "about";

const CATEGORIES: { key: SettingsCategory; label: string; icon: string }[] = [
	{ key: "query", label: "查询结果", icon: "icon-[lucide--play]" },
	{ key: "grid", label: "数据网格", icon: "icon-[lucide--table]" },
	{ key: "resultTab", label: "结果标签", icon: "icon-[lucide--database]" },
	{ key: "export", label: "导出", icon: "icon-[lucide--download]" },
	{ key: "sidebar", label: "树交互", icon: "icon-[lucide--panel-left]" },
	{ key: "history", label: "历史", icon: "icon-[lucide--history]" },
	{ key: "about", label: "关于", icon: "icon-[lucide--info]" },
];

export function SettingsPanel({ settings, onChange, onReset, onClearHistory, onClose, onWipeData }: Props): JSX.Element {
	const [activeCategory, setActiveCategory] = useState<SettingsCategory>("query");
	const [confirmWipe, setConfirmWipe] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	function updateSetting<K extends keyof WorkbenchSettings>(key: K, value: WorkbenchSettings[K]): void {
		onChange({ ...settings, [key]: value });
	}

	return (
		<>
			<div className="dbx-sheet-backdrop" onClick={onClose} />
			<div
				className="dbx-sheet w-[720px] max-w-[calc(100%-2rem)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<div className="dbx-panel-header">
					<span className="icon-[lucide--settings] h-4 w-4 text-muted-foreground" />
					<div className="flex flex-col min-w-0 flex-1">
						<h3 className="dbx-panel-header-title">工作台设置</h3>
						<span className="text-[10px] text-muted-foreground/60 font-mono">v{PLUGIN_VERSION}</span>
					</div>
					<div className="dbx-panel-header-actions">
						<button
							type="button"
							onClick={onReset}
							disabled={isDefaultSettings(settings)}
							className="dbx-iconbtn"
							style={{ height: 24 }}
						>
							恢复默认
						</button>
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
				</div>

				<div className="flex min-h-0 flex-1">
					<nav className="w-32 shrink-0 border-r border-border/50 bg-[var(--dbx-surface)] p-2">
						{CATEGORIES.map((cat) => (
							<button
								key={cat.key}
								type="button"
								className={`dbx-category-nav-item ${activeCategory === cat.key ? "active" : ""}`}
								onClick={() => setActiveCategory(cat.key)}
							>
								<span className={`${cat.icon} h-3.5 w-3.5`} />
								<span>{cat.label}</span>
							</button>
						))}
					</nav>

					<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-4">
						{activeCategory === "query" && (
							<QueryResultSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "grid" && (
							<DataGridSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "resultTab" && (
							<ResultTabSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "export" && (
							<ExportSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "sidebar" && (
							<SidebarSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "history" && (
							<HistorySettings settings={settings} onChange={updateSetting} onClearHistory={onClearHistory} />
						)}
						{activeCategory === "about" && (
							<AboutSection onWipeData={onWipeData} confirmWipe={confirmWipe} setConfirmWipe={setConfirmWipe} />
						)}
					</div>
				</div>
			</div>
		</>
	);
}

/** 查询结果设置（对齐 dbx Data > Query Results） */
function QueryResultSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: unknown) => void }): JSX.Element {
	const maxRowsBounds = SETTINGS_BOUNDS.queryResultMaxRows;
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">查询结果</h3>

			<SettingRow label="默认每页行数" hint={`查询结果分页页大小（1–${SETTINGS_BOUNDS.rowLimit.max.toLocaleString()}）`}>
				<input
					type="number"
					className="dbx-form-input"
					min={SETTINGS_BOUNDS.rowLimit.min}
					max={SETTINGS_BOUNDS.rowLimit.max}
					value={settings.rowLimit}
					onChange={(e) => onChange("rowLimit", clampInt(e.target.value, SETTINGS_BOUNDS.rowLimit.min, SETTINGS_BOUNDS.rowLimit.max, settings.rowLimit))}
				/>
			</SettingRow>

			<SettingRow label="表打开默认行数" hint={`点击树节点预览数据时的默认页大小（1–${SETTINGS_BOUNDS.tableOpenPageSize.max.toLocaleString()}）`}>
				<input
					type="number"
					className="dbx-form-input"
					min={SETTINGS_BOUNDS.tableOpenPageSize.min}
					max={SETTINGS_BOUNDS.tableOpenPageSize.max}
					value={settings.tableOpenPageSize}
					onChange={(e) => onChange("tableOpenPageSize", clampInt(e.target.value, SETTINGS_BOUNDS.tableOpenPageSize.min, SETTINGS_BOUNDS.tableOpenPageSize.max, settings.tableOpenPageSize))}
				/>
			</SettingRow>

			<SettingRow label="查询超时（秒）" hint="超时后自动取消查询">
				<input
					type="number"
					className="dbx-form-input"
					min={SETTINGS_BOUNDS.queryTimeoutSecs.min}
					max={SETTINGS_BOUNDS.queryTimeoutSecs.max}
					value={settings.queryTimeoutSecs}
					onChange={(e) => onChange("queryTimeoutSecs", clampInt(e.target.value, SETTINGS_BOUNDS.queryTimeoutSecs.min, SETTINGS_BOUNDS.queryTimeoutSecs.max, settings.queryTimeoutSecs))}
				/>
			</SettingRow>

			<SettingRow label="限制查询结果总量" hint="开启后最多取回下方设定的行数（循环分页取数）；关闭后取到引擎单次上限（1000 行）即止。">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input
						type="checkbox"
						checked={settings.queryResultMaxRowsEnabled}
						onChange={(e) => onChange("queryResultMaxRowsEnabled", e.target.checked)}
					/>
					启用总量限制
				</label>
			</SettingRow>

			{settings.queryResultMaxRowsEnabled && (
				<SettingRow
					label="查询结果最大行数"
					hint={`${maxRowsBounds.min.toLocaleString()}–${maxRowsBounds.max.toLocaleString()}`}
				>
					<input
						type="number"
						className="dbx-form-input"
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
				</SettingRow>
			)}

			<SettingRow label="自动计算总行数" hint="查询后自动执行 COUNT(*) 统计总行数（对齐 dbx autoCalculateTotalRows）">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input
						type="checkbox"
						checked={settings.autoCalculateTotalRows}
						onChange={(e) => onChange("autoCalculateTotalRows", e.target.checked)}
					/>
					自动统计
				</label>
			</SettingRow>

			<SettingRow label="无限滚动" hint="滚到底部时自动加载下一页数据（对齐 dbx infiniteScroll）">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input
						type="checkbox"
						checked={settings.infiniteScroll}
						onChange={(e) => onChange("infiniteScroll", e.target.checked)}
					/>
					启用无限滚动
				</label>
			</SettingRow>

			<SettingRow label="多语句默认视图" hint="执行多语句后的默认视图">
				<select
					className="dbx-form-input"
					value={settings.multiStatementDefaultView}
					onChange={(e) => onChange("multiStatementDefaultView", e.target.value as "result" | "messages")}
				>
					<option value="result">结果视图</option>
					<option value="messages">消息视图</option>
				</select>
			</SettingRow>

			<SettingRow label="执行计划默认视图" hint="EXPLAIN 的默认视图">
				<select
					className="dbx-form-input"
					value={settings.defaultExplainView}
					onChange={(e) => onChange("defaultExplainView", e.target.value as "table" | "canvas")}
				>
					<option value="table">表格视图</option>
					<option value="canvas">图形视图</option>
				</select>
			</SettingRow>
		</div>
	);
}

/** 数据网格显示设置（对齐 dbx Data > Data Grid Display） */
function DataGridSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: unknown) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">数据网格显示</h3>

			<SettingRow label="斑马纹行" hint="交替行背景色（对齐 dbx dataGridStripedRows）">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input
						type="checkbox"
						checked={settings.dataGridStripedRows}
						onChange={(e) => onChange("dataGridStripedRows", e.target.checked)}
					/>
					启用斑马纹
				</label>
			</SettingRow>

			<SettingRow label="十字准线高亮" hint="高亮当前单元格所在的行和列（对齐 dbx dataGridCrosshairHighlight）">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input
						type="checkbox"
						checked={settings.dataGridCrosshairHighlight}
						onChange={(e) => onChange("dataGridCrosshairHighlight", e.target.checked)}
					/>
					启用十字准线
				</label>
			</SettingRow>

			<SettingRow label="单元格详情按钮" hint="双击单元格弹出详情弹窗（对齐 dbx dataGridCellDetailButtonVisible）">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input
						type="checkbox"
						checked={settings.dataGridCellDetailButtonVisible}
						onChange={(e) => onChange("dataGridCellDetailButtonVisible", e.target.checked)}
					/>
					启用详情按钮
				</label>
			</SettingRow>
		</div>
	);
}

/** 结果标签设置（对齐 dbx Data > Result tab settings） */
function ResultTabSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: unknown) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">结果标签</h3>

			<SettingRow label="命名方式" hint="新结果标签的命名方式（对齐 dbx resultTabNamingMode）">
				<select
					className="dbx-form-input"
					value={settings.resultTabNamingMode}
					onChange={(e) => onChange("resultTabNamingMode", e.target.value as "source" | "table" | "sequential")}
				>
					<option value="source">按来源命名</option>
					<option value="table">按表名命名</option>
					<option value="sequential">按序号命名</option>
				</select>
			</SettingRow>

			<SettingRow label="显示来源数据库" hint="在结果标签中显示数据库名（对齐 dbx showResultSourceDatabase）">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input
						type="checkbox"
						checked={settings.showResultSourceDatabase}
						onChange={(e) => onChange("showResultSourceDatabase", e.target.checked)}
					/>
					显示来源数据库
				</label>
			</SettingRow>
		</div>
	);
}

/** 侧边栏设置（对齐 dbx Navigation） */
function SidebarSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: unknown) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">侧边栏</h3>

			<SettingRow label="单击表节点行为" hint="单击连接树中的表时">
				<select
					className="dbx-form-input"
					value={settings.tableSingleClickAction}
					onChange={(e) => onChange("tableSingleClickAction", e.target.value as "preview" | "structure")}
				>
					<option value="structure">查看表结构</option>
					<option value="preview">预览数据</option>
				</select>
			</SettingRow>

			<SettingRow label="双击表节点行为" hint="双击连接树中的表时">
				<select
					className="dbx-form-input"
					value={settings.tableDoubleClickAction}
					onChange={(e) => onChange("tableDoubleClickAction", e.target.value as "preview" | "structure")}
				>
					<option value="preview">预览数据</option>
					<option value="structure">查看表结构</option>
				</select>
			</SettingRow>
		</div>
	);
}

/** 历史设置（对齐 dbx Data > History Retention） */
function HistorySettings({ settings, onChange, onClearHistory }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: unknown) => void; onClearHistory: () => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">历史保留</h3>

			<SettingRow label="记录查询历史" hint="记录 SQL、耗时与行数">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input
						type="checkbox"
						checked={settings.historyEnabled}
						onChange={(e) => onChange("historyEnabled", e.target.checked)}
					/>
					启用历史记录
				</label>
			</SettingRow>

			{settings.historyEnabled && (
				<SettingRow label="历史条数上限" hint="超出后自动清理最旧的记录">
					<input
						type="number"
						className="dbx-form-input"
						min={SETTINGS_BOUNDS.historyLimit.min}
						max={SETTINGS_BOUNDS.historyLimit.max}
						value={settings.historyLimit}
						onChange={(e) => onChange("historyLimit", clampInt(e.target.value, SETTINGS_BOUNDS.historyLimit.min, SETTINGS_BOUNDS.historyLimit.max, settings.historyLimit))}
					/>
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
function ExportSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: unknown) => void }): JSX.Element {
	const bounds = SETTINGS_BOUNDS.exportRowLimit;
	const batchBounds = SETTINGS_BOUNDS.exportBatchSize;
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">导出</h3>

			<SettingRow
				label="每批取行数"
				hint={`导出全部数据时每批从引擎取回的行数（${batchBounds.min.toLocaleString()}–${batchBounds.max.toLocaleString()}）`}
			>
				<input
					type="number"
					className="dbx-form-input"
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
			</SettingRow>

			<SettingRow label="限制导出行数" hint="默认关闭：「导出全部数据」循环拉取到末页；开启后最多导出下方设定的行数。">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
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
					<input
						type="number"
						className="dbx-form-input"
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
			<h3 className="text-[13px] font-semibold text-foreground">关于 dbx-pro</h3>

			<div className="dbx-panel-group">
				<div className="dbx-panel-group-body space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-[11px] text-muted-foreground">版本</span>
						<span className="text-[11px] font-mono text-foreground">{PLUGIN_VERSION}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-[11px] text-muted-foreground">引擎版本</span>
						<span className="text-[11px] font-mono text-foreground">{engineVersion ?? "—"}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-[11px] text-muted-foreground">协议版本</span>
						<span className="text-[11px] font-mono text-foreground">2.0.0</span>
					</div>
				</div>
			</div>

			<div className="dbx-panel-group">
				<div className="dbx-panel-group-header">数据管理</div>
				<div className="dbx-panel-group-body space-y-2">
					{confirmWipe ? (
						<div className="flex items-center gap-2 pt-2">
							<span className="text-[10px] font-medium text-destructive">确认清除全部本地数据？</span>
							<span className="flex-1" />
							<button
								type="button"
								onClick={() => { setConfirmWipe(false); onWipeData(); }}
								className="rounded bg-destructive px-2 py-0.5 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90"
							>
								确认清除
							</button>
							<button
								type="button"
								onClick={() => setConfirmWipe(false)}
								className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
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

			<div className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
				密码保存在宿主加密凭据库；读取走引擎服务，写 / DDL 走自研驱动，执行前会弹窗展示完整 SQL 由你确认。
			</div>
		</div>
	);
}

/** 设置行组件 */
function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
	return (
		<div className="space-y-1">
			<div className="text-[11px] font-medium text-foreground">{label}</div>
			{children}
			{hint ? <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p> : null}
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
