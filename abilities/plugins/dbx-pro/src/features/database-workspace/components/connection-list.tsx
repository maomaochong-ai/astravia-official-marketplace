/**
 * 已保存连接的清单 — 侧栏的列表页。
 *
 * 每行给出品牌图标 / 连接名 / 端点摘要与三个动作：编辑、测试、删除。
 * 测试进行中禁用该行按钮，避免并发跑多次连通性检查。
 */

import type { DbConnection } from "../../../domain/connection-config";
import { DatabaseTypeIcon } from "../../../shared/components/database-type-icon";

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
			<div className="mb-3 flex items-center justify-between">
				<div className="text-[11px] text-muted-foreground">共 {connections.length} 个连接</div>
				<button className="dbx-btn primary" onClick={onCreate}>+ 新建</button>
			</div>

			{connections.length === 0 && (
				<div className="dbx-empty" style={{ padding: 24, borderRadius: 8 }}>
					暂无连接 · 点右上「新建」
				</div>
			)}

			<div className="flex flex-col gap-1.5">
				{connections.map((c) => (
					<div
						key={c.id}
						className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/30 px-2.5 py-2 transition hover:border-border/80 hover:bg-card/60"
					>
						<DatabaseTypeIcon dbType={c.db_type} size="small" />
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								{c.is_production && (
									<span className="shrink-0 rounded bg-amber-500/10 px-1 py-px text-[9px] font-semibold text-amber-500">
										PROD
									</span>
								)}
								{c.read_only && (
									<span className="shrink-0 rounded bg-blue-500/10 px-1 py-px text-[9px] font-semibold text-blue-500">
										RO
									</span>
								)}
								<span className="truncate text-[12px] font-medium text-foreground">{c.name}</span>
							</div>
							<div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
								{c.host}{c.port ? `:${c.port}` : ""}
								{c.database ? ` · ${c.database}` : ""}
								{c.schemas && c.schemas.length > 0 ? ` · ${c.schemas.join(",")}` : ""}
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-0.5">
							<button
								type="button"
								className="rounded px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-[var(--dbx-hover)] hover:text-foreground"
								onClick={() => onEdit(c)}
							>
								编辑
							</button>
							<button
								type="button"
								className="rounded px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-40"
								onClick={() => onTest(c)}
								disabled={testing}
							>
								{testing ? "…" : "测试"}
							</button>
							<button
								type="button"
								className="rounded px-2 py-1 text-[11px] transition hover:bg-red-500/10 hover:text-red-500"
								style={{ color: "var(--destructive)" }}
								onClick={() => onDelete(c)}
							>
								删除
							</button>
						</div>
					</div>
				))}
			</div>

			{testResult && (
				<div className="mt-3 rounded-lg bg-[var(--dbx-surface)] px-3 py-2 text-[11px] text-foreground/80">
					{testResult}
				</div>
			)}
		</div>
	);
}
