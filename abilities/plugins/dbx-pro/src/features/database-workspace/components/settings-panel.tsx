/**
 * G2 工作台设置面板 — 右栏「设置」页签。
 *
 * 只做展示与收集，不持有持久化：每次改动都通过 `onChange` 交回主面板，
 * 由主面板用 `workbench-settings-store.ts` 写入 `ctx.storage`。
 * 所有 min/max 都取自 `SETTINGS_BOUNDS`，数值用 `clampInt` 夹逼，非法输入回落到当前值。
 */

import type { JSX } from "react";
import { clampInt } from "../../../domain/query-history";
import {
	ENGINE_PREFERENCES,
	PREFERENCE_HINTS,
	SETTINGS_BOUNDS,
	isDefaultSettings,
	preferenceLabel,
	type WorkbenchSettings,
} from "../../../domain/workbench-settings";

interface Props {
	settings: WorkbenchSettings;
	/** 引擎是否已绑定（bindEngineServices 拿到 services 能力）。 */
	engineBound: boolean;
	onChange: (next: WorkbenchSettings) => void;
	onReset: () => void;
	onClearHistory: () => void;
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

const inputCls = "w-full rounded-md border bg-background px-2 py-1 text-[11px] text-foreground outline-none";

export function SettingsPanel({ settings, engineBound, onChange, onReset, onClearHistory }: Props): JSX.Element {
	const b = SETTINGS_BOUNDS;
	return (
		<div className="space-y-3 p-3">
			<div className="flex items-center gap-1">
				<span className="text-[11px] font-semibold text-foreground">工作台设置</span>
				<span className="flex-1" />
				<button type="button" onClick={onReset} disabled={isDefaultSettings(settings)}
					className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40">
					恢复默认
				</button>
			</div>

			<Row label="取数路径偏好" hint={PREFERENCE_HINTS[settings.enginePreference]}>
				<select className={inputCls} value={settings.enginePreference}
					onChange={(e) => onChange({ ...settings, enginePreference: e.target.value as WorkbenchSettings["enginePreference"] })}>
					{ENGINE_PREFERENCES.map((p) => (
						<option key={p} value={p}>{preferenceLabel(p)}</option>
					))}
				</select>
			</Row>

			<div className="grid grid-cols-2 gap-2">
				<Row label="查询超时（秒）">
					<input type="number" className={inputCls} min={b.queryTimeoutSecs.min} max={b.queryTimeoutSecs.max}
						value={settings.queryTimeoutSecs}
						onChange={(e) => onChange({ ...settings, queryTimeoutSecs: clampInt(e.target.value, b.queryTimeoutSecs.min, b.queryTimeoutSecs.max, settings.queryTimeoutSecs) })} />
				</Row>
				<Row label="结果行数上限">
					<input type="number" className={inputCls} min={b.rowLimit.min} max={b.rowLimit.max}
						value={settings.rowLimit}
						onChange={(e) => onChange({ ...settings, rowLimit: clampInt(e.target.value, b.rowLimit.min, b.rowLimit.max, settings.rowLimit) })} />
				</Row>
			</div>
			<p className="-mt-2 text-[10px] leading-relaxed text-muted-foreground">
				行数上限只在引擎路径生效（按游标截断并标注「已截断」）；本地 CLI 路径受 sqlite3 自身输出限制，不会改写你的 SQL。
			</p>

			<Row label="写语句闸门" hint="默认关闭。开启后引擎与本地 CLI 两条路径都会放行写语句；关闭时写语句会被闸门拦下并如实报错，不会静默丢弃。">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" checked={settings.allowWrites}
						onChange={(e) => onChange({ ...settings, allowWrites: e.target.checked })} />
					允许执行写语句（INSERT / UPDATE / DDL 等）
				</label>
			</Row>

			<Row label="查询历史">
				<label className="flex items-center gap-2 text-[11px] text-foreground">
					<input type="checkbox" checked={settings.historyEnabled}
						onChange={(e) => onChange({ ...settings, historyEnabled: e.target.checked })} />
					记录查询历史（仅 SQL / 耗时 / 行数，不保存结果行）
				</label>
			</Row>

			<div className="grid grid-cols-2 items-end gap-2">
				<Row label="历史条数上限">
					<input type="number" className={inputCls} min={b.historyLimit.min} max={b.historyLimit.max}
						disabled={!settings.historyEnabled}
						value={settings.historyLimit}
						onChange={(e) => onChange({ ...settings, historyLimit: clampInt(e.target.value, b.historyLimit.min, b.historyLimit.max, settings.historyLimit) })} />
				</Row>
				<button type="button" onClick={onClearHistory} disabled={!settings.historyEnabled}
					className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-destructive disabled:opacity-40">
					清空历史
				</button>
			</div>

			<div className="rounded-lg bg-muted/40 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
				自持引擎：{engineBound ? "已绑定宿主 service 能力" : "未绑定（宿主不支持 services）→ 查询按偏好回退本地 sqlite3 CLI"}。
				插件的连接配置、历史与设置都存在宿主托管的插件私有目录，不写入仓库。
			</div>
		</div>
	);
}
