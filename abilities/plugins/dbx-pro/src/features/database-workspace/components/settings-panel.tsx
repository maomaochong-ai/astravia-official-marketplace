/**
 * 工作台设置弹窗。
 *
 * 只做展示与收集：每次改动都通过 `onChange` 即时回写（由调用方负责持久化）。
 * 所有 min/max 都取自 `SETTINGS_BOUNDS`，数值夹逼，非法输入回落到当前值。
 */

import { useEffect, useState, type JSX } from "react";
import { clampInt } from "../../../domain/query-history";
import {
	SETTINGS_BOUNDS,
	isDefaultSettings,
	type WorkbenchSettings,
} from "../../../domain/workbench-settings";

interface Props {
	settings: WorkbenchSettings;
	onChange: (next: WorkbenchSettings) => void;
	onReset: () => void;
	onClearHistory: () => void;
	onClose: () => void;
	/** 清除全部本地数据（连接 / 加密密码 / 历史 / 设置）。 */
	onWipeData: () => void;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
	return (
		<div className="space-y-1">
			<div className="text-[11px] font-medium text-foreground">{label}</div>
			{children}
			{hint ? <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p> : null}
		</div>
	);
}

const inputCls = "w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none";

export function SettingsPanel({ settings, onChange, onReset, onClearHistory, onClose, onWipeData }: Props): JSX.Element {
	const b = SETTINGS_BOUNDS;
	const [confirmWipe, setConfirmWipe] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<>
			<div className="dbx-sheet-backdrop" onClick={onClose} />
			<div
				className="dbx-sheet w-[420px] max-w-[calc(100%-1rem)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<div className="flex shrink-0 items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--dbx-line-soft)" }}>
					<span className="icon-[lucide--settings] h-4 w-4 text-muted-foreground" />
					<h3 className="flex-1 text-[12.5px] font-semibold text-foreground">工作台设置</h3>
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
						✕
					</button>
				</div>

				<div className="dbx-scroll space-y-4 overflow-y-auto p-4">
					<div className="grid grid-cols-2 gap-3">
						<Row label="查询超时（秒）" hint="超时后自动取消查询。">
							<input
								type="number"
								className={inputCls}
								min={b.queryTimeoutSecs.min}
								max={b.queryTimeoutSecs.max}
								value={settings.queryTimeoutSecs}
								onChange={(e) =>
									onChange({
										...settings,
										queryTimeoutSecs: clampInt(
											e.target.value,
											b.queryTimeoutSecs.min,
											b.queryTimeoutSecs.max,
											settings.queryTimeoutSecs,
										),
									})
								}
							/>
						</Row>
						<Row
							label="结果行数上限"
							hint={`宿主 dbx-mcp 单次最多返回 ${b.rowLimit.max} 行（引擎制品硬上限）；超过后按行截断并标注，不改写 SQL。`}
						>
							<input
								type="number"
								className={inputCls}
								min={b.rowLimit.min}
								max={b.rowLimit.max}
								value={settings.rowLimit}
								onChange={(e) =>
									onChange({
										...settings,
										rowLimit: clampInt(e.target.value, b.rowLimit.min, b.rowLimit.max, settings.rowLimit),
									})
								}
							/>
						</Row>
					</div>

				<Row label="查询历史">
					<label className="flex items-center gap-2 text-[11px] text-foreground">
						<input
							type="checkbox"
							checked={settings.historyEnabled}
							onChange={(e) => onChange({ ...settings, historyEnabled: e.target.checked })}
						/>
						记录查询历史（仅 SQL / 耗时 / 行数，不保存结果行）
					</label>
				</Row>

				<div className="grid grid-cols-2 gap-3">
					<Row label="单击表节点" hint="单左键点击连接树中的表。">
						<select
							className={inputCls}
							value={settings.tableSingleClickAction}
							onChange={(e) =>
								onChange({ ...settings, tableSingleClickAction: e.target.value as "preview" | "structure" })
							}
						>
							<option value="structure">查看表结构</option>
							<option value="preview">SELECT * 预览</option>
						</select>
					</Row>
					<Row label="双击表节点" hint="双击时触发的动作。">
						<select
							className={inputCls}
							value={settings.tableDoubleClickAction}
							onChange={(e) =>
								onChange({ ...settings, tableDoubleClickAction: e.target.value as "preview" | "structure" })
							}
						>
							<option value="preview">SELECT * 预览</option>
							<option value="structure">查看表结构</option>
						</select>
					</Row>
				</div>


					<div className="grid grid-cols-2 items-end gap-3">
						<Row label="历史条数上限">
							<input
								type="number"
								className={inputCls}
								min={b.historyLimit.min}
								max={b.historyLimit.max}
								disabled={!settings.historyEnabled}
								value={settings.historyLimit}
								onChange={(e) =>
									onChange({
										...settings,
										historyLimit: clampInt(
											e.target.value,
											b.historyLimit.min,
											b.historyLimit.max,
											settings.historyLimit,
										),
									})
								}
							/>
						</Row>
						<button
							type="button"
							onClick={onClearHistory}
							disabled={!settings.historyEnabled}
							className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-destructive disabled:opacity-40"
						>
							清空历史
						</button>
					</div>

					{/* 数据与隐私：卸载前清理入口 */}
					<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
						<div className="flex items-center gap-2">
							<span className="icon-[lucide--trash-2] h-3.5 w-3.5 text-destructive" />
							<span className="text-[11px] font-medium text-destructive">清除本地数据</span>
						</div>
						<p className="text-[10px] leading-relaxed text-muted-foreground">
							卸载插件前，可在此一并清除全部连接信息（含已加密密码）、查询历史与设置；此操作不可撤销。若仍需保留这些内容，卸载后会留在本机。
						</p>
						{confirmWipe ? (
							<div className="flex items-center gap-2 pt-0.5">
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
								className="rounded-md border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
							>
								清除全部数据
							</button>
						)}
					</div>

					<div className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
						密码保存在宿主加密凭据库；读取走 dbx-mcp，写 / DDL 走自研驱动，执行前会弹窗展示完整 SQL 由你确认。
					</div>
				</div>
			</div>
		</>
	);
}
