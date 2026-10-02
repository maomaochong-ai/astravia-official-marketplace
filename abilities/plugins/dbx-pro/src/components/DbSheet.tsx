import { useEffect, useState } from "react";

/**
 * 管理连接侧栏。
 *
 * dbx CLI 本身没有 connections add/delete 命令——连接配置只能通过 dbx 桌面应用的
 * SQLite dbx.db 写入。所以这里的策略是：
 *   1. 检查 dbx 桌面应用是否在跑（dbx doctor 看 bridge_url）
 *   2. 一键打开 dbx 桌面应用的连接管理
 *   3. 提供"快速填写"表单让用户对照 UI 在 dbx 里录入，回来刷新列表
 */

interface ConnectionDraft {
	name: string;
	type: string;
	host: string;
	port: number;
	database: string;
	user?: string;
}

const DB_TYPES = [
	"postgres", "mysql", "sqlite", "redshift", "clickhouse", "mongodb",
	"redis", "duckdb", "snowflake", "sqlserver", "oracle", "elasticsearch",
];

interface Props {
	open: boolean;
	onClose: () => void;
	onSaved: () => void;
}

export function DbSheet({ open, onClose, onSaved }: Props) {
	const [form, setForm] = useState<ConnectionDraft>({
		name: "", type: "postgres", host: "127.0.0.1", port: 5432, database: "", user: "",
	});
	const [doctorInfo, setDoctorInfo] = useState<{ bridgeUrl?: string; dbExists: boolean } | null>(null);
	const [checking, setChecking] = useState(false);

	useEffect(() => {
		if (open) {
			setForm({ name: "", type: "postgres", host: "127.0.0.1", port: 5432, database: "", user: "" });
			checkBridge();
		}
	}, [open]);

	async function checkBridge() {
		setChecking(true);
		try {
			// 用 ctx 里的 command？DbSheet 是纯组件，没有 ctx——所以这里留空，
			// 主面板打开 DbSheet 前会先跑 dbx doctor 一次
			setDoctorInfo({ dbExists: true });
		} catch {
			setDoctorInfo({ dbExists: false });
		} finally {
			setChecking(false);
		}
	}

	if (!open) return null;

	function openDbxApp() {
		// 插件可以调用 shell.openExternal（已声明权限），打开 dbx 桌面应用
		// macOS: open -a "DBX"
		window.open("dbx://connections", "_blank");
	}

	return (
		<>
			<div className="dbx-sheet-backdrop" onClick={onClose} />
			<div className="dbx-sheet">
				<div className="dbx-sheet-header">
					<div style={{ fontWeight: 600, fontSize: 14 }}>管理连接</div>
					<button className="dbx-btn ghost" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
				</div>

				<div className="dbx-sheet-body">
					{/* 顶部提示条：dbx 连接只能在桌面应用里写 */}
					<div style={{
						padding: 12, marginBottom: 16, borderRadius: 6,
						background: "rgba(0,0,0,0.03)", fontSize: 12, lineHeight: 1.6,
					}}>
						dbx CLI 会读取 <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 4px", borderRadius: 3 }}>~/.astravia/dbx-pro</code>
						下的连接配置。添加或修改连接请通过 <b>dbx 桌面应用</b>，或使用下方表单快速对照。
					</div>

					<button className="dbx-btn primary" onClick={openDbxApp} style={{ width: "100%", marginBottom: 16 }}>
						🟢 打开 dbx 桌面应用
					</button>

					<div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "var(--muted-foreground)" }}>
						快速对照填写（请在 dbx 桌面应用中录入）
					</div>

					<div className="dbx-form-row">
						<label className="dbx-form-label">连接名称</label>
						<input
							className="dbx-form-input"
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
							placeholder="例如 prod-postgres"
						/>
					</div>

					<div className="dbx-form-row">
						<label className="dbx-form-label">数据库类型</label>
						<select
							className="dbx-form-input"
							value={form.type}
							onChange={(e) => setForm({ ...form, type: e.target.value })}
						>
							{DB_TYPES.map((t) => (
								<option key={t} value={t}>{t}</option>
							))}
						</select>
					</div>

					<div className="dbx-form-row">
						<label className="dbx-form-label">Host</label>
						<input
							className="dbx-form-input"
							value={form.host}
							onChange={(e) => setForm({ ...form, host: e.target.value })}
							placeholder="127.0.0.1"
						/>
					</div>

					<div className="dbx-form-row">
						<label className="dbx-form-label">Port</label>
						<input
							className="dbx-form-input"
							type="number"
							value={form.port}
							onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 0 })}
						/>
					</div>

					<div className="dbx-form-row">
						<label className="dbx-form-label">默认数据库</label>
						<input
							className="dbx-form-input"
							value={form.database}
							onChange={(e) => setForm({ ...form, database: e.target.value })}
							placeholder="可选"
						/>
					</div>
				</div>

				<div className="dbx-sheet-footer">
					<button className="dbx-btn ghost" onClick={onClose}>取消</button>
					<button className="dbx-btn primary" onClick={onSaved}>我已添加 · 刷新列表</button>
				</div>
			</div>
		</>
	);
}
