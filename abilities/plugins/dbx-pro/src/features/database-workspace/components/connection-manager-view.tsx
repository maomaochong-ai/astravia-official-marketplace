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

type ViewStep = "dashboard" | "editor";

export function ConnectionManagerView(): JSX.Element {
	// 该视图挂在宿主侧边栏，运行在 WorkbenchProvider 之外，
	// 只能使用连接编辑 hook（自带存储读写），不能调用 useWorkbench。
	const editor = useConnectionEditor({});
	const [step, setStep] = useState<ViewStep>("dashboard");
	const disposedRef = useRef(false);

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

	if (step === "editor") {
		return (
			<div data-astravia-plugin-root="dbx-pro" className="dbx-root relative flex h-full w-full min-h-0 flex-col bg-background text-foreground">
				{/* 头部由 ConnectionEditorFlow 统一渲染（含返回总览），避免重复标题 */}
				<ConnectionEditorFlow onExit={() => setStep("dashboard")} />
			</div>
		);
	}

	return (
		<main
			data-astravia-plugin-root="dbx-pro"
			className="dbx-root h-full min-h-0 overflow-y-auto bg-background text-foreground"
			aria-live="polite"
		>
			<div className="mx-auto max-w-3xl px-5 py-6">
				{/* Header */}
				<header className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-center">
					<div>
						<div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-500">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
								<ellipse cx="12" cy="5" rx="8" ry="3" />
								<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
								<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v6" />
							</svg>
							<span>dbx-pro</span>
						</div>
						<h1 className="m-0 text-2xl font-bold tracking-tight text-foreground">
							<span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
								数据库工作台
							</span>
						</h1>
						<p className="m-0 mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
						管理数据库连接配置
					</p>
					</div>
					<div className="flex shrink-0 items-center gap-2.5">
						<button
							className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-600 active:scale-[0.98]"
							type="button"
							onClick={() => setStep("editor")}
						>
							<span className="icon-[lucide--plus] h-3.5 w-3.5" />
							新建连接
						</button>
						<button
							className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-card hover:text-foreground"
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
					<div className="flex flex-col rounded-lg border border-border/60 bg-card/45 p-3 shadow-xs">
						<div className="whitespace-nowrap text-[11px] text-muted-foreground">连接总数</div>
						<div className="mt-2 flex items-baseline gap-1">
							<span className="text-xl font-bold leading-none tracking-tight text-foreground">{connections.length}</span>
							<span className="text-[11px] text-muted-foreground">个</span>
						</div>
						<div className="mt-2 truncate border-t border-border/40 pt-1.5 text-[10.5px] text-muted-foreground">
							{productionCount > 0 ? (
								<span className="inline-flex items-center gap-1 whitespace-nowrap text-amber-500">
									<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
									{productionCount} 个生产环境
								</span>
							) : (
								"无生产环境标记"
							)}
						</div>
					</div>

					<div className="flex flex-col rounded-lg border border-border/60 bg-card/45 p-3 shadow-xs">
						<div className="whitespace-nowrap text-[11px] text-muted-foreground">使用方式</div>
						<div className="mt-2 flex items-center gap-1.5">
							<span className="icon-[lucide--panel-left-open] h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
							<span className="whitespace-nowrap text-[12px] font-medium text-foreground/80">工作台标签页</span>
						</div>
						<div className="mt-2 truncate border-t border-border/40 pt-1.5 text-[10.5px] text-muted-foreground">
							在活动栏打开
						</div>
					</div>

					<div className="flex flex-col rounded-lg border border-border/60 bg-card/45 p-3 shadow-xs">
						<div className="whitespace-nowrap text-[11px] text-muted-foreground">数据库类型</div>
						<div className="mt-2 flex items-baseline gap-1">
							<span className="text-xl font-bold leading-none tracking-tight text-foreground">{uniqueDbTypes.size}</span>
							<span className="text-[11px] text-muted-foreground">种</span>
						</div>
						<div className="mt-2 truncate border-t border-border/40 pt-1.5">
							<div className="flex flex-nowrap gap-1">
								{[...uniqueDbTypes].slice(0, 4).map((t) => {
									const v = getDatabaseTypeVisual(t);
									return (
										<span
											key={t}
											className="inline-flex h-3.5 shrink-0 items-center rounded px-1 text-[9px] font-medium text-white"
											style={{ backgroundColor: v.color }}
										>
											{v.badge}
										</span>
									);
								})}
								{uniqueDbTypes.size > 4 && (
									<span className="text-[9px] leading-3.5 text-muted-foreground">+{uniqueDbTypes.size - 4}</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex flex-col rounded-lg border border-border/60 bg-card/45 p-3 shadow-xs">
						<div className="whitespace-nowrap text-[11px] text-muted-foreground">引擎状态</div>
						<div className="mt-2 flex items-center gap-1.5">
							<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
							<span className="whitespace-nowrap text-[12px] font-semibold text-foreground">运行中</span>
						</div>
						<div className="mt-2 truncate border-t border-border/40 pt-1.5 text-[10.5px] text-muted-foreground">
							v{PLUGIN_VERSION} · {DB_TYPE_MANIFEST.length} 种数据库
						</div>
					</div>
				</div>

				{/* Connection List Section */}
				<section className="mt-8">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
						<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
							<h2 className="m-0 text-sm font-semibold text-foreground">已保存连接</h2>
							<span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
								{connections.length}
							</span>
						</div>
						<button
							type="button"
							className="text-xs text-cyan-500 hover:text-cyan-400 hover:underline"
							onClick={() => setStep("editor")}
						>
							管理全部 →
						</button>
					</div>

					{connections.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border/80 bg-card/25 px-6 py-12 text-center">
							<div
								className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/20"
								aria-hidden="true"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
									<ellipse cx="12" cy="5" rx="8" ry="3" />
									<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
									<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v6" />
								</svg>
							</div>
							<h3 className="m-0 mt-4 text-sm font-semibold text-foreground">暂无连接</h3>
							<p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">
								创建第一个数据库连接，开始使用数据库工作台
							</p>
							<div className="mt-5">
								<button
									type="button"
									className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-600"
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
		<div className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-card/45 p-3.5 transition hover:border-border hover:shadow-md">
			<DatabaseTypeIcon dbType={conn.db_type} size={36} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					{conn.is_production && (
						<span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold text-amber-500">PROD</span>
					)}
					{conn.read_only && (
						<span className="rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-semibold text-blue-500">RO</span>
					)}
					<span className="truncate text-[12px] font-semibold text-foreground">{conn.name}</span>
				</div>
				<p className="m-0 mt-0.5 truncate text-[10px] text-muted-foreground">
					{conn.host}{conn.port ? `:${conn.port}` : ""}
					{conn.database ? ` / ${conn.database}` : ""}
				</p>
				<div className="mt-1.5 flex items-center gap-1.5">
					<span
						className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium text-white"
						style={{ backgroundColor: visual.color }}
					>
						{visual.badge}
					</span>
					<span className="text-[10px] text-muted-foreground/70">{conn.db_type}</span>
				</div>
			</div>
			<button
				type="button"
				className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
				onClick={onEdit}
				title="编辑连接"
			>
				<span className="icon-[lucide--settings] h-3.5 w-3.5" />
			</button>
		</div>
	);
}
