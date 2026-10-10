/**
 * 已保存连接的清单 — 侧栏的列表页。
 *
 * 对齐设计稿 frames/connections.tsx：搜索行（h-9）+ 58px 连接行 + 动作图标按钮。
 * 每行给出状态点 / 连接名 / 端点 / 读写权限 / 三个动作：测试、编辑、删除。
 * 测试进行中禁用该行按钮，避免并发跑多次连通性检查。
 */

import { useMemo, useState, type JSX } from "react";
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

type AccessFilter = "all" | "ro" | "rw";

/** 行的端点摘要：host:port · database */
function endpointOf(conn: DbConnection): string {
	const host = conn.host ?? "";
	const port = conn.port ? `:${conn.port}` : "";
	const database = conn.database ? ` · ${conn.database}` : "";
	return `${host}${port}${database}`;
}

export function ConnectionList({
	connections,
	testing,
	testResult,
	onEdit,
	onTest,
	onDelete,
	onCreate,
}: ConnectionListProps): JSX.Element {
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<AccessFilter>("all");

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

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* 搜索 + 过滤：设计稿 h-9 行 */}
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-4">
				<div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5">
					<span className="icon-[lucide--search] size-3.5 shrink-0 text-muted" />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="搜索连接名称、主机…"
						className="h-full min-w-0 flex-1 appearance-none border-none bg-transparent text-[12px] text-surface-foreground outline-none placeholder:text-muted"
					/>
				</div>
				<button
					type="button"
					onClick={() => setFilter("all")}
					className={`shrink-0 rounded-chip px-2 py-1 text-[12px] whitespace-nowrap transition ${
						filter === "all"
							? "border border-border bg-neutral-muted text-surface-foreground"
							: "px-1.5 text-muted hover:text-surface-foreground"
					}`}
				>
					全部 {connections.length}
				</button>
				<button
					type="button"
					onClick={() => setFilter("ro")}
					className={`shrink-0 rounded-chip px-2 py-1 text-[12px] whitespace-nowrap transition ${
						filter === "ro"
							? "border border-border bg-neutral-muted text-surface-foreground"
							: "px-1.5 text-muted hover:text-surface-foreground"
					}`}
				>
					只读 {readOnlyCount}
				</button>
				<button
					type="button"
					onClick={() => setFilter("rw")}
					className={`shrink-0 rounded-chip px-2 py-1 text-[12px] whitespace-nowrap transition ${
						filter === "rw"
							? "border border-border bg-neutral-muted text-surface-foreground"
							: "px-1.5 text-muted hover:text-surface-foreground"
					}`}
				>
					可写 {writableCount}
				</button>
			</div>

			{/* 行列表：设计稿 58px 行，行内 padding 16px */}
			<div className="min-h-0 flex-1 overflow-y-auto pt-1">
				{connections.length === 0 ? (
					<div className="px-4 py-10 text-center">
						<p className="m-0 text-[12px] text-muted">还没有保存的连接</p>
						<button type="button" className="dbx-btn primary mt-3" onClick={onCreate}>
							<span className="icon-[lucide--plus] size-3.5" />
							新建连接
						</button>
					</div>
				) : visible.length === 0 ? (
					<div className="px-4 py-10 text-center text-[12px] text-muted">没有匹配的连接</div>
				) : (
					visible.map((conn) => (
						<div
							key={conn.id}
							className="group flex h-[58px] items-center gap-3 border-t border-border px-4 hover:bg-neutral-muted"
						>
							<span className={`size-1.5 shrink-0 rounded-full ${conn.read_only ? "bg-accent" : "bg-warning"}`} />

							<div className="flex w-[150px] shrink-0 items-center gap-2">
								<DatabaseTypeIcon dbType={conn.db_type} size="small" />
								<div className="min-w-0">
									<div className="truncate text-[14px] font-semibold text-surface-foreground">{conn.name}</div>
									<div className="truncate font-mono text-[12px] text-muted">{conn.db_type}</div>
								</div>
							</div>

							<div className="flex min-w-0 flex-1 items-center gap-2">
								<span className="truncate font-mono text-[12px] text-muted">{endpointOf(conn)}</span>
								{conn.is_production ? (
									<span className="shrink-0 rounded-chip border border-warning/40 bg-warning-soft px-1.5 py-px text-[12px] whitespace-nowrap text-warning">
										生产
									</span>
								) : null}
							</div>

							<span className="w-[40px] shrink-0 text-center text-[12px] whitespace-nowrap text-muted">
								{conn.read_only ? "只读" : "可写"}
							</span>

							<span className="flex w-[86px] shrink-0 justify-end">
								<span className="inline-flex items-center gap-1.5 whitespace-nowrap">
									<span className="size-1.5 shrink-0 rounded-full bg-border-strong" />
									<span className="text-[12px] text-muted">已配置</span>
								</span>
							</span>

							<div className="flex w-[172px] shrink-0 items-center justify-end gap-1">
								<button
									type="button"
									onClick={() => onTest(conn)}
									disabled={testing}
									title="测试连接"
									className="flex size-6 items-center justify-center rounded-control text-muted transition hover:bg-surface hover:text-surface-foreground disabled:opacity-40"
								>
									<span className={`size-3.5 ${testing ? "icon-[lucide--loader-circle] animate-spin" : "icon-[lucide--plug]"}`} />
								</button>
								<button
									type="button"
									onClick={() => onEdit(conn)}
									title="编辑连接"
									className="flex size-6 items-center justify-center rounded-control text-muted transition hover:bg-surface hover:text-surface-foreground"
								>
									<span className="icon-[lucide--pencil] size-3.5" />
								</button>
								<button
									type="button"
									onClick={() => onDelete(conn)}
									title="删除连接"
									className="flex size-6 items-center justify-center rounded-control text-muted transition hover:bg-danger-soft hover:text-danger"
								>
									<span className="icon-[lucide--trash-2] size-3.5" />
								</button>
							</div>
						</div>
					))
				)}
			</div>

			{testResult ? (
				<div className="shrink-0 border-t border-border px-4 py-2 font-mono text-[12px] break-all text-surface-foreground">
					{testResult}
				</div>
			) : null}
		</div>
	);
}
