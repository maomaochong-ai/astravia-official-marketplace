/**
 * 已保存连接的清单 — 首屏与侧栏列表页共用。
 *
 * 布局对齐插件工作台（参考 xiaohongshu）：概览卡 + 搜索/过滤行 + 自适应卡片网格。
 * 卡片内所有文本都走 min-w-0 + truncate，宽度由网格分配，不再有固定像素列宽：
 * 宿主侧边栏被拖窄时不会再把文字挤出圆角容器。
 */

import { useEffect, useMemo, useState, type JSX } from "react";
import { findDbType, type DbConnection } from "../../../domain/connection-config";
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
	onDuplicate: (conn: DbConnection) => void;
	onCreate: () => void;
	/** 首屏整页：在搜索行上方显示概览卡。模态弹窗高度有限，不传。 */
	showSummary?: boolean;
}

type AccessFilter = "all" | "ro" | "rw";

/** 卡片里的端点摘要：host:port · database */
function endpointOf(conn: DbConnection): string {
	const host = conn.host ?? "";
	const port = conn.port ? `:${conn.port}` : "";
	const database = conn.database ? ` · ${conn.database}` : "";
	return `${host}${port}${database}`;
}

function OverviewCard({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: string }): JSX.Element {
	return (
		<div className="min-w-0 rounded-xl border border-border/60 bg-card/45 p-3 shadow-xs">
			<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
				<span className={`size-1.5 shrink-0 rounded-full ${tone}`} />
				<span className="truncate">{label}</span>
			</div>
			<div className="mt-1 font-mono text-xl leading-none font-semibold tabular-nums text-surface-foreground">{value}</div>
			<div className="mt-2 truncate border-t border-border/40 pt-1.5 text-[11px] text-faint">{hint}</div>
		</div>
	);
}

export function ConnectionList({
	connections,
	testing,
	testResult,
	onEdit,
	onTest,
	onDelete,
	onDuplicate,
	onCreate,
	showSummary = false,
}: ConnectionListProps): JSX.Element {
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<AccessFilter>("all");
	/** 卡片内二次确认删除：删除按钮第一次点击进入 pending，2s 内再点才真删。 */
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	useEffect(() => {
		if (!pendingDeleteId) return;
		const t = setTimeout(() => setPendingDeleteId(null), 2000);
		return () => clearTimeout(t);
	}, [pendingDeleteId]);

	const readOnlyCount = connections.filter((c) => c.read_only).length;
	const writableCount = connections.length - readOnlyCount;

	const visible = useMemo(() => {
		const keyword = query.trim().toLowerCase();
		return connections.filter((c) => {
			if (filter === "ro" && !c.read_only) return false;
			if (filter === "rw" && c.read_only) return false;
			if (!keyword) return true;
			return [c.name, c.host, c.database, c.db_type]
				.filter(Boolean)
				.some((field) => String(field).toLowerCase().includes(keyword));
		});
	}, [connections, filter, query]);

	const filterChip = (key: AccessFilter, label: string, count: number): JSX.Element => (
		<button
			type="button"
			onClick={() => setFilter(key)}
			className={`shrink-0 rounded-chip px-2 py-1 text-[12px] whitespace-nowrap transition ${
				filter === key
					? "border border-border bg-neutral-muted text-surface-foreground"
					: "text-muted hover:text-surface-foreground"
			}`}
		>
			{label} {count}
		</button>
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{showSummary ? (
				<div className="grid shrink-0 grid-cols-3 gap-2.5 px-5 pt-3 pb-1" data-testid="connection-summary-grid">
					<OverviewCard label="数据源" value={connections.length} hint="已保存到本机" tone="bg-accent" />
					<OverviewCard label="可写" value={writableCount} hint="允许执行变更" tone="bg-warning" />
					<OverviewCard label="只读" value={readOnlyCount} hint="仅查询，不改数据" tone="bg-success" />
				</div>
			) : null}

			{/* 搜索 + 过滤：窄面板自动换行，永远不撑破容器 */}
			<div className="flex shrink-0 flex-wrap items-center gap-2 px-5 py-3">
				<div className="flex h-8 min-w-[132px] flex-1 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5">
					<span className="icon-[lucide--search] size-3.5 shrink-0 text-muted" />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="搜索名称、主机…"
						className="h-full min-w-0 flex-1 appearance-none border-none bg-transparent text-[12px] text-surface-foreground outline-none placeholder:text-muted"
					/>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{filterChip("all", "全部", connections.length)}
					{filterChip("rw", "可写", writableCount)}
					{filterChip("ro", "只读", readOnlyCount)}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
				{connections.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
						<span className="icon-[lucide--database] mx-auto block size-6 text-faint" />
						<p className="mt-3 mb-0 text-[13px] font-medium text-surface-foreground">还没有保存的数据源</p>
						<p className="mt-1 mb-0 text-[12px] text-muted">连接 MySQL、PostgreSQL、ClickHouse 等数据库后即可查询与分析。</p>
						<button type="button" className="dbx-btn primary mt-4" onClick={onCreate}>
							<span className="icon-[lucide--plus] size-3.5" />
							新建数据源
						</button>
					</div>
				) : visible.length === 0 ? (
					<div className="px-4 py-10 text-center text-[12px] text-muted">没有匹配的数据源</div>
				) : (
					<div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3" data-testid="connection-card-grid">
						{visible.map((conn) => {
							const typeLabel = findDbType(conn.db_type)?.label ?? conn.db_type;
							const connectionState = conn.last_test_at == null
								? { dot: "bg-border-strong", text: "未测试", cls: "text-muted" }
								: conn.last_test_ok
									? { dot: "bg-success", text: "已连接", cls: "text-success" }
									: { dot: "bg-danger", text: "连接失败", cls: "text-danger" };
							return (
								<article
									key={conn.id}
									data-testid="connection-card"
									className="group flex min-w-0 cursor-pointer flex-col rounded-xl border border-border/60 bg-card/45 p-3 shadow-xs transition hover:border-border-strong hover:bg-card"
									onDoubleClick={() => onEdit(conn)}
								>
									<div className="flex min-w-0 items-center gap-2">
										<DatabaseTypeIcon dbType={conn.db_type} size="small" />
										<span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-surface-foreground">{conn.name}</span>
										<span
											className={`shrink-0 rounded-chip border px-1.5 py-px text-[11px] whitespace-nowrap ${
												conn.read_only
													? "border-border text-muted"
													: "border-warning/40 bg-warning-soft text-warning"
											}`}
										>
											{conn.read_only ? "只读" : "可写"}
										</span>
									</div>

									<div className="mt-1.5 flex min-w-0 items-center gap-1.5">
										<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">{typeLabel}</span>
										{conn.is_production ? (
											<span className="shrink-0 rounded-chip bg-warning-soft px-1.5 py-px text-[10px] whitespace-nowrap text-warning">生产</span>
										) : null}
									</div>
									<div className="truncate font-mono text-[11px] text-faint">{endpointOf(conn)}</div>

									<div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-border/40 pt-2">
										<span
											className="inline-flex min-w-0 items-center gap-1.5"
											title={conn.last_test_error ?? connectionState.text}
										>
											<span className={`size-1.5 shrink-0 rounded-full ${connectionState.dot}`} />
											<span className={`truncate text-[11px] ${connectionState.cls}`}>{connectionState.text}</span>
										</span>

										<div className="flex shrink-0 items-center gap-0.5">
											<button
												type="button"
												onClick={() => onTest(conn)}
												disabled={testing}
												title="测试数据源"
												className="flex size-6 items-center justify-center rounded-control text-muted transition hover:bg-surface hover:text-surface-foreground disabled:opacity-40"
											>
												<span className={`size-3.5 ${testing ? "icon-[lucide--loader-circle] animate-spin" : "icon-[lucide--plug]"}`} />
											</button>
											<button
												type="button"
												onClick={() => onEdit(conn)}
												title="编辑数据源"
												className="flex size-6 items-center justify-center rounded-control text-muted transition hover:bg-surface hover:text-surface-foreground"
											>
												<span className="icon-[lucide--pencil] size-3.5" />
											</button>
											<button
												type="button"
												onClick={() => onDuplicate(conn)}
												title="复制为新数据源"
												className="flex size-6 items-center justify-center rounded-control text-muted transition hover:bg-surface hover:text-surface-foreground"
											>
												<span className="icon-[lucide--copy-plus] size-3.5" />
											</button>
											<button
												type="button"
												onClick={() => {
													if (pendingDeleteId === conn.id) {
														setPendingDeleteId(null);
														void onDelete(conn);
													} else {
														setPendingDeleteId(conn.id);
													}
												}}
												title={pendingDeleteId === conn.id ? "再点一次确认删除" : "删除数据源"}
												className={`flex size-6 items-center justify-center rounded-control transition ${
													pendingDeleteId === conn.id
														? "bg-danger text-surface"
														: "text-muted hover:bg-danger-soft hover:text-danger"
												}`}
											>
												<span className={`size-3.5 ${pendingDeleteId === conn.id ? "icon-[lucide--check]" : "icon-[lucide--trash-2]"}`} />
											</button>
										</div>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</div>

			{testResult ? (
				<div className="shrink-0 border-t border-border px-5 py-2 font-mono text-[12px] break-all text-surface-foreground">
					{testResult}
				</div>
			) : null}
		</div>
	);
}
