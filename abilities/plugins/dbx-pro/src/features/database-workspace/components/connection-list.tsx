/**
 * 已保存连接的清单 — 侧栏的列表页。
 *
 * 每行给出连接名 / 类型 / 端点摘要与三个动作：编辑、测试、删除。
 * 测试进行中禁用该行按钮，避免并发跑多次连通性检查。
 */

import type { DbConnection } from "../../../domain/connection-config";

export interface ConnectionListProps {
	connections: DbConnection[];
	/** 正在跑连通性测试。 */
	testing: boolean;
	/** 测试结果文案；null 表示不显示。 */
	testResult: string | null;
	onEdit: (conn: DbConnection) => void;
	onTest: (conn: DbConnection) => void;
	onDelete: (conn: DbConnection) => void;
	onCreate: () => void;
}

export function ConnectionList({
	connections,
	testing,
	testResult,
	onEdit,
	onTest,
	onDelete,
	onCreate,
}: ConnectionListProps): React.JSX.Element {
	return (
		<div>
			<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
				<div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>共 {connections.length} 个连接</div>
				<button className="dbx-btn primary" onClick={onCreate}>+ 新建</button>
			</div>

			{connections.length === 0 && (
				<div className="dbx-empty" style={{ padding: 24, borderRadius: 8 }}>
					暂无连接 · 点右上「新建」
				</div>
			)}

			{connections.map((c) => (
				<div
					key={c.id}
					style={{
						display: "flex", alignItems: "center", gap: 8,
						padding: "10px 12px", borderRadius: 6, marginBottom: 6,
						border: "1px solid var(--border)", fontSize: 13,
					}}
				>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
							{c.is_production && (
							<span style={{
								fontSize: 10, padding: "1px 6px", borderRadius: 10,
								background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
								color: "var(--destructive)",
							}}>PROD</span>
						)}
							{c.name}
						</div>
						<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
							{c.db_type} · {c.host}{c.port ? `:${c.port}` : ""}
							{c.database ? ` · ${c.database}` : ""}
							{c.schemas && c.schemas.length > 0 ? ` · ${c.schemas.join(",")}` : ""}
						</div>
					</div>
					<button className="dbx-btn ghost" onClick={() => onEdit(c)}>编辑</button>
					<button className="dbx-btn ghost" onClick={() => onTest(c)} disabled={testing}>
						{testing ? "…" : "测试"}
					</button>
					<button className="dbx-btn ghost" onClick={() => onDelete(c)} style={{ color: "var(--destructive)" }}>删除</button>
				</div>
			))}

			{testResult && (
				<div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, backgroundColor: "var(--dbx-surface)", fontSize: 12 }}>
					{testResult}
				</div>
			)}
		</div>
	);
}