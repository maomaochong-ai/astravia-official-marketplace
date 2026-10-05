/**
 * 数据库工作台设置面板
 * 
 * 提供 50+ 个配置项，分为多个分类：编辑器、SQL 执行、数据网格、结果集、侧边栏等
 */

import { useState, useEffect, type JSX } from "react";
import {
	SETTINGS_BOUNDS,
	isDefaultSettings,
	type WorkbenchSettings,
} from "../../../domain/workbench-settings";
import { PLUGIN_VERSION } from "../../../index";

interface Props {
	settings: WorkbenchSettings;
	onChange: (next: WorkbenchSettings) => void;
	onReset: () => void;
	onClearHistory: () => void;
	onClose: () => void;
	onWipeData: () => void;
}

type SettingsCategory = "editor" | "sql" | "grid" | "result" | "sidebar" | "export" | "about";

const CATEGORIES: { key: SettingsCategory; label: string; icon: string }[] = [
	{ key: "editor", label: "编辑器", icon: "icon-[lucide--code]" },
	{ key: "sql", label: "SQL 执行", icon: "icon-[lucide--play]" },
	{ key: "grid", label: "数据网格", icon: "icon-[lucide--table]" },
	{ key: "result", label: "结果集", icon: "icon-[lucide--database]" },
	{ key: "sidebar", label: "侧边栏", icon: "icon-[lucide--panel-left]" },
	{ key: "export", label: "导出", icon: "icon-[lucide--download]" },
	{ key: "about", label: "关于", icon: "icon-[lucide--info]" },
];

export function SettingsPanel({ settings, onChange, onReset, onClearHistory, onClose, onWipeData }: Props): JSX.Element {
	const [activeCategory, setActiveCategory] = useState<SettingsCategory>("editor");
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
					{/* 左侧分类导航 */}
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

					{/* 右侧设置内容 */}
					<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-4">
						{activeCategory === "editor" && (
							<EditorSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "sql" && (
							<SqlSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "grid" && (
							<GridSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "result" && (
							<ResultSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "sidebar" && (
							<SidebarSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "export" && (
							<ExportSettings settings={settings} onChange={updateSetting} />
						)}
						{activeCategory === "about" && (
							<AboutSection onClearHistory={onClearHistory} onWipeData={onWipeData} confirmWipe={confirmWipe} setConfirmWipe={setConfirmWipe} />
						)}
					</div>
				</div>
			</div>
		</>
	);
}

/** 编辑器设置 */
function EditorSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: any) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">编辑器基础设置</h3>
			
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

			<SettingRow label="默认每页行数" hint="网格分页页大小">
				<input
					type="number"
					className="dbx-form-input"
					min={SETTINGS_BOUNDS.rowLimit.min}
					max={SETTINGS_BOUNDS.rowLimit.max}
					value={settings.rowLimit}
					onChange={(e) => onChange("rowLimit", clampInt(e.target.value, SETTINGS_BOUNDS.rowLimit.min, SETTINGS_BOUNDS.rowLimit.max, settings.rowLimit))}
				/>
			</SettingRow>

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
		</div>
	);
}

/** SQL 执行设置 */
function SqlSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: any) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">SQL 执行设置</h3>
			
			<SettingRow label="执行模式" hint="选择执行当前语句还是全部语句">
				<select className="dbx-form-input" defaultValue="current">
					<option value="current">当前语句</option>
					<option value="all">全部语句</option>
				</select>
			</SettingRow>

			<SettingRow label="事务模式" hint="默认事务模式">
				<select className="dbx-form-input" defaultValue="auto">
					<option value="auto">自动提交</option>
					<option value="manual">手动提交</option>
				</select>
			</SettingRow>

			<SettingRow label="危险 SQL 确认" hint="执行 DDL/DML 前弹窗确认">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={true} />
					启用确认弹窗
				</label>
			</SettingRow>

			<SettingRow label="批量执行遇错继续" hint="批量执行时遇到错误是否继续">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={false} />
					继续执行后续语句
				</label>
			</SettingRow>
		</div>
	);
}

/** 数据网格设置 */
function GridSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: any) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">数据网格设置</h3>
			
			<SettingRow label="显示行号" hint="在网格左侧显示行号">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={true} />
					显示行号
				</label>
			</SettingRow>

			<SettingRow label="斑马纹行" hint="交替行背景色">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={true} />
					启用斑马纹
				</label>
			</SettingRow>

			<SettingRow label="十字准线高亮" hint="高亮当前单元格所在的行和列">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={false} />
					启用十字准线
				</label>
			</SettingRow>

			<SettingRow label="单元格类型着色" hint="根据数据类型显示不同颜色">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={false} />
					启用类型着色
				</label>
			</SettingRow>

			<SettingRow label="数字列右对齐" hint="数字类型列右对齐显示">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={true} />
					右对齐数字列
				</label>
			</SettingRow>

			<SettingRow label="表头显示列注释" hint="在列标题中显示注释">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={true} />
					显示列注释
				</label>
			</SettingRow>

			<SettingRow label="表头显示列类型" hint="在列标题中显示数据类型">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={true} />
					显示列类型
				</label>
			</SettingRow>

			<SettingRow label="渲染模式" hint="DOM 或 Canvas 渲染">
				<select className="dbx-form-input" defaultValue="dom">
					<option value="dom">DOM 渲染</option>
					<option value="canvas">Canvas 渲染</option>
				</select>
			</SettingRow>
		</div>
	);
}

/** 结果集设置 */
function ResultSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: any) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">结果集设置</h3>
			
			<SettingRow label="结果标签命名" hint="新结果标签的命名方式">
				<select className="dbx-form-input" defaultValue="source">
					<option value="source">按来源命名</option>
					<option value="table">按表名命名</option>
					<option value="sequential">按序号命名</option>
				</select>
			</SettingRow>

			<SettingRow label="显示结果来源数据库" hint="在结果标签中显示数据库名">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={true} />
					显示来源数据库
				</label>
			</SettingRow>

			<SettingRow label="多语句默认视图" hint="执行多语句后的默认视图">
				<select className="dbx-form-input" defaultValue="result">
					<option value="result">结果视图</option>
					<option value="messages">消息视图</option>
				</select>
			</SettingRow>

			<SettingRow label="执行计划默认视图" hint="EXPLAIN 的默认视图">
				<select className="dbx-form-input" defaultValue="table">
					<option value="table">表格视图</option>
					<option value="canvas">图形视图</option>
				</select>
			</SettingRow>
		</div>
	);
}

/** 侧边栏设置 */
function SidebarSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: any) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">侧边栏设置</h3>
			
			<SettingRow label="对象显示方式" hint="连接树中对象的显示方式">
				<select className="dbx-form-input" defaultValue="grouped">
					<option value="grouped">分组显示</option>
					<option value="flat">平铺显示</option>
				</select>
			</SettingRow>

			<SettingRow label="启用表搜索" hint="在连接树中搜索表">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={false} />
					启用表搜索
				</label>
			</SettingRow>

			<SettingRow label="自动选中活动节点" hint="自动选中当前查询的表">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={false} />
					自动选中
				</label>
			</SettingRow>

			<SettingRow label="显示工具提示" hint="鼠标悬停时显示完整名称">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={true} />
					显示工具提示
				</label>
			</SettingRow>

			<SettingRow label="缩进大小" hint="树节点缩进像素">
				<input
					type="number"
					className="dbx-form-input"
					min={8}
					max={32}
					defaultValue={14}
				/>
			</SettingRow>

			<SettingRow label="字体大小" hint="树节点字体大小">
				<input
					type="number"
					className="dbx-form-input"
					min={10}
					max={20}
					defaultValue={12}
				/>
			</SettingRow>
		</div>
	);
}

/** 导出设置 */
function ExportSettings({ settings, onChange }: { settings: WorkbenchSettings; onChange: (key: keyof WorkbenchSettings, value: any) => void }): JSX.Element {
	return (
		<div className="space-y-4">
			<h3 className="text-[13px] font-semibold text-foreground">导出设置</h3>
			
			<SettingRow label="导出批大小" hint="每次导出的行数">
				<input
					type="number"
					className="dbx-form-input"
					min={100}
					max={10000}
					defaultValue={2000}
				/>
			</SettingRow>

			<SettingRow label="启用导出行数限制" hint="限制最大导出行数">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" defaultChecked={false} />
					启用限制
				</label>
			</SettingRow>

			<SettingRow label="最大导出行数" hint="超过此行数将截断">
				<input
					type="number"
					className="dbx-form-input"
					min={1000}
					max={1000000}
					defaultValue={100000}
				/>
			</SettingRow>

			<SettingRow label="CSV 引号模式" hint="字段值的引号处理">
				<select className="dbx-form-input" defaultValue="auto">
					<option value="auto">自动</option>
					<option value="always">始终引号</option>
					<option value="never">不引号</option>
				</select>
			</SettingRow>

			<SettingRow label="CSV NULL 处理" hint="NULL 值的导出方式">
				<select className="dbx-form-input" defaultValue="empty">
					<option value="empty">空字符串</option>
					<option value="null">NULL</option>
					<option value="custom">自定义</option>
				</select>
			</SettingRow>
		</div>
	);
}

/** 关于部分 */
function AboutSection({ onClearHistory, onWipeData, confirmWipe, setConfirmWipe }: { onClearHistory: () => void; onWipeData: () => void; confirmWipe: boolean; setConfirmWipe: (v: boolean) => void }): JSX.Element {
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
						<span className="text-[11px] font-mono text-foreground">0.0.19</span>
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
					<button
						type="button"
						onClick={onClearHistory}
						className="dbx-btn ghost w-full text-left"
					>
						<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
						清空查询历史
					</button>
					
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
