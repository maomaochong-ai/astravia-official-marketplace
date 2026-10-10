/**
 * 连接管理工作区视图 — 从宿主侧边栏打开的整页面板。
 *
 * 参考小红书插件的 XhsAccountsView 设计：
 * - 顶部 Header 区域：品牌标识 + 标题 + 操作按钮
 * - KPI 概览卡片：连接总数、当前活跃、引擎状态、支持类型数
 * - 连接列表：带数据库品牌图标和类型色彩的卡片
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { useConnectionEditor } from "../hooks/use-connection-editor";
import { ConnectionEditorFlow } from "./connection-editor-flow";
import { DatabaseTypeIcon } from "../../../shared/components/database-type-icon";
import { getDatabaseTypeVisual } from "../../../domain/database-type-visual";
import { DB_TYPE_MANIFEST, type DbConnection } from "../../../domain/connection-config";
import { PLUGIN_VERSION } from "../../../domain/plugin-version";
import { engineHealth } from "../../../shared/services/engine-client";

type ViewStep = "dashboard" | "editor";
type EngineState = "checking" | "running" | "unavailable";

export function ConnectionManagerView(): JSX.Element {
	// 该视图挂在宿主侧边栏，运行在 WorkbenchProvider 之外，
	// 只能使用连接编辑 hook（自带存储读写），不能调用 useWorkbench。
	const editor = useConnectionEditor({});
	const [step, setStep] = useState<ViewStep>("dashboard");
	const disposedRef = useRef(false);
	const [engineState, setEngineState] = useState<EngineState>("checking");
	const [engineVersion, setEngineVersion] = useState<string | null>(null);

	const connections = editor.connections;

	const uniqueDbTypes = new Set(connections.map((c) => c.db_type));
	const productionCount = connections.filter((c) => c.is_production).length;

	const refresh = useCallback(async () => {
		if (disposedRef.current) return;
		await editor.refresh();
	}, [editor]);

	useEffect(() => {
		disposedRef.current = false;
		void refresh();
		return () => { disposedRef.current = true; };
	}, [refresh]);

	// 引擎健康状态实时探测，不硬编码「运行中」。
	useEffect(() => {
		let alive = true;
		setEngineState("checking");
		engineHealth()
			.then((health) => {
				if (!alive) return;
				setEngineState("running");
				setEngineVersion(health.version || null);
			})
			.catch(() => {
				if (alive) setEngineState("unavailable");
			});
		return () => { alive = false; };
	}, []);

	if (step === "editor") {
		return (
			<div data-astravia-plugin-root="dbx-pro" className="dbx-root relative flex h-full w-full min-h-0 flex-col bg-surface text-surface-foreground">
				{/* 头部由 ConnectionEditorFlow 统一渲染（含返回总览），避免重复标题 */}
				<ConnectionEditorFlow onExit={() => setStep("dashboard")} />
			</div>
		);
	}

	return (
		<main
			data-astravia-plugin-root="dbx-pro"
			className="dbx-root h-full min-h-0 overflow-y-auto bg-surface text-surface-foreground"
			aria-live="polite"
		>
			<div className="mx-auto max-w-3xl px-5 py-6">
				{/* Header */}
				<header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
					<div>
						<div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-link">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
								<ellipse cx="12" cy="5" rx="8" ry="3" />
								<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
								<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v6" />
							</svg>
							<span>dbx-pro</span>
						</div>
					<h1 className="m-0 text-2xl font-bold tracking-tight text-surface-foreground">
						<span className="text-surface-foreground">
								数据库工作台
							</span>
						</h1>
					<p className="m-0 mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">
						管理数据库连接配置
					</p>
					</div>
					<div className="flex shrink-0 items-center gap-2.5">
						<button
							className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg transition hover:bg-primary/90"
							type="button"
							onClick={() => setStep("editor")}
						>
							<span className="icon-[lucide--plus] h-3.5 w-3.5" />
							新建连接
						</button>
						<button
							className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface-raised px-3 py-1.5 text-[12px] font-medium text-muted transition hover:bg-neutral-muted hover:text-surface-foreground"
							type="button"
							onClick={() => void refresh()}
						>
							<span className="icon-[lucide--refresh-cw] h-3.5 w-3.5" />
							刷新
						</button>
					</div>
				</header>

				{/* KPI Cards：统一结构，标题单行不换行，去掉装饰性英文碎标签 */}
				<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div className="flex flex-col rounded-control border border-border bg-surface-raised p-3">
						<div className="whitespace-nowrap text-[11px] text-muted">连接总数</div>
						<div className="mt-2 flex items-baseline gap-1">
							<span className="text-xl font-bold leading-none tracking-tight text-surface-foreground">{connections.length}</span>
							<span className="text-[11px] text-muted">个</span>
						</div>
						<div className="mt-2 truncate border-t border-border pt-1.5 text-[11px] text-muted">
							{productionCount > 0 ? (
								<span className="inline-flex items-center gap-1 whitespace-nowrap text-warning">
									<span className="h-1.5 w-1.5 rounded-full bg-warning" />
									{productionCount} 个生产环境
								</span>
							) : (
								"无生产环境标记"
							)}
						</div>
					</div>

					<div className="flex flex-col rounded-control border border-border bg-surface-raised p-3">
						<div className="whitespace-nowrap text-[11px] text-muted">使用方式</div>
						<div className="mt-2 flex items-center gap-1.5">
							<span className="icon-[lucide--panel-left-open] h-3.5 w-3.5 shrink-0 text-faint" />
							<span className="whitespace-nowrap text-[12px] font-medium text-surface-foreground">工作台标签页</span>
						</div>
						<div className="mt-2 truncate border-t border-border pt-1.5 text-[11px] text-muted">
							在活动栏打开
						</div>
					</div>

					<div className="flex flex-col rounded-control border border-border bg-surface-raised p-3">
						<div className="whitespace-nowrap text-[11px] text-muted">数据库类型</div>
						<div className="mt-2 flex items-baseline gap-1">
							<span className="text-xl font-bold leading-none tracking-tight text-surface-foreground">{uniqueDbTypes.size}</span>
							<span className="text-[11px] text-muted">种</span>
						</div>
						<div className="mt-2 truncate border-t border-border pt-1.5 text-[11px] text-muted">
							<div className="flex flex-nowrap gap-1">
								{[...uniqueDbTypes].slice(0, 4).map((t) => {
									const v = getDatabaseTypeVisual(t);
									return (
										<span
											key={t}
							className="inline-flex h-3.5 shrink-0 items-center rounded-chip px-1 text-[10px] font-medium text-white"
											style={{ backgroundColor: v.color }}
										>
											{v.badge}
										</span>
									);
								})}
								{uniqueDbTypes.size > 4 && (
									<span className="text-[11px] text-muted">+{uniqueDbTypes.size - 4}</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex flex-col rounded-control border border-border bg-surface-raised p-3">
						<div className="whitespace-nowrap text-[11px] text-muted">引擎状态</div>
						<div className="mt-2 flex items-center gap-1.5">
							<span
								className={`h-2 w-2 shrink-0 rounded-full ${
									engineState === "running"
											? "bg-success"
										: engineState === "checking"
												? "animate-pulse bg-warning"
												: "bg-danger"
								}`}
							/>
							<span className="whitespace-nowrap text-[12px] font-semibold text-surface-foreground">
								{engineState === "running" ? "运行中" : engineState === "checking" ? "检测中" : "不可用"}
							</span>
						</div>
						<div className="mt-2 truncate border-t border-border pt-1.5 text-[11px] text-muted">
							v{PLUGIN_VERSION}
							{engineVersion ? ` · 引擎 ${engineVersion}` : ` · ${DB_TYPE_MANIFEST.length} 种数据库`}
						</div>
					</div>
				</div>

				{/* Connection List Section */}
				<section className="mt-8">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
						<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
							<h2 className="m-0 text-[13px] font-semibold text-surface-foreground">已保存连接</h2>
							<span className="rounded-chip bg-neutral-muted px-1.5 py-0.5 text-[11px] text-muted">
								{connections.length}
							</span>
						</div>
						<button
							type="button"
							className="text-xs text-link hover:underline"
							onClick={() => setStep("editor")}
						>
							管理全部 →
						</button>
					</div>

					{connections.length === 0 ? (
						<div className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-12 text-center">
							<div
								className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-link-soft text-link ring-1 ring-[var(--dbx-accent-soft)]"
								aria-hidden="true"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
									<ellipse cx="12" cy="5" rx="8" ry="3" />
									<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
									<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v6" />
								</svg>
							</div>
							<h3 className="m-0 mt-4 text-[13px] font-semibold text-surface-foreground">暂无连接</h3>
							<p className="mx-auto mt-1.5 max-w-md text-[12px] leading-5 text-muted">
								创建第一个数据库连接，开始使用数据库工作台
							</p>
							<div className="mt-5">
								<button
									type="button"
							className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg transition hover:bg-primary/90"
									onClick={() => setStep("editor")}
								>
									<span className="icon-[lucide--plus] h-3.5 w-3.5" />
									创建连接
								</button>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{connections.map((conn) => (
								<ConnectionCard
								key={conn.id}
								conn={conn}
								onEdit={() => setStep("editor")}
							/>
							))}
						</div>
					)}
				</section>
			</div>
		</main>
	);
}

function ConnectionCard({ conn, onEdit }: { conn: DbConnection; onEdit: () => void }): JSX.Element {
	const visual = getDatabaseTypeVisual(conn.db_type);
	return (
		<div className="group relative flex items-center gap-3 rounded-card border border-border bg-surface-raised p-3.5 transition hover:border-border-strong">
			<DatabaseTypeIcon dbType={conn.db_type} size={36} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					{conn.is_production && (
						<span className="rounded-chip bg-warning/10 px-1 py-0.5 text-[10px] font-semibold text-warning">PROD</span>
					)}
					{conn.read_only && (
						<span className="rounded-chip bg-link-soft px-1 py-0.5 text-[10px] font-semibold text-link">RO</span>
					)}
					<span className="truncate text-[12px] font-semibold text-surface-foreground">{conn.name}</span>
				</div>
				<p className="m-0 mt-0.5 truncate text-[11px] text-muted">
					{conn.host}{conn.port ? `:${conn.port}` : ""}
					{conn.database ? ` / ${conn.database}` : ""}
				</p>
				<div className="mt-1.5 flex items-center gap-1.5">
					<span
						className="inline-flex items-center rounded-chip px-1 py-0.5 text-[10px] font-medium text-white"
						style={{ backgroundColor: visual.color }}
					>
						{visual.badge}
					</span>
					<span className="text-[11px] text-faint">{conn.db_type}</span>
				</div>
			</div>
			<button
				type="button"
				className="shrink-0 rounded-control p-1.5 text-muted opacity-0 transition hover:bg-neutral-muted hover:text-surface-foreground group-hover:opacity-100"
				onClick={onEdit}
				title="编辑连接"
			>
				<span className="icon-[lucide--settings] h-3.5 w-3.5" />
			</button>
		</div>
	);
}
