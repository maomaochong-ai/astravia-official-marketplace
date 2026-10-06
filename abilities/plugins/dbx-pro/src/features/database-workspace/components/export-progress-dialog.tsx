/**
 * ExportProgressDialog — 导出表数据进度弹窗。
 *
 * 对标 dbx 桌面壳 ExportProgressDialog：
 * 标题 + 文件名 + 进度条（已知总数走百分比，未知走滑动动画）+
 * 状态图标与文案（导出中 / 导出完成 / 失败 / 已取消）+
 * 已导出行数与耗时；底部「取消导出 / 重新下载 / 关闭」。
 *
 * 宿主 webview 没有「打开所在文件夹」能力（无系统 shell 桥），
 * 完成态提供「重新下载」作为等价兜底，不伪造不可用的入口。
 */

import { useEffect, useState, type JSX } from "react";

export type ExportProgressStatus = "running" | "done" | "error" | "cancelled";

export interface ExportProgressState {
	status: ExportProgressStatus;
	fileName: string;
	/** 已导出（已取回）行数。 */
	rowsExported: number;
	/** 总行数；null 表示未知，进度条走不确定动画。 */
	totalRows: number | null;
	startedAt: number;
	finishedAt?: number;
	errorMessage?: string | null;
	/** 完成态的下载地址，「重新下载」点击后重新触发浏览器下载。 */
	downloadUrl?: string | null;
}

/** 107000ms → "1分47秒"；47000ms → "47秒"。 */
export function formatElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	if (mins <= 0) return `${secs}秒`;
	return `${mins}分${secs}秒`;
}

interface Props {
	state: ExportProgressState;
	onClose: () => void;
	onCancel: () => void;
}

export function ExportProgressDialog({ state, onClose, onCancel }: Props): JSX.Element {
	const active = state.status === "running";
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!active) return;
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [active]);

	// 导出中禁止 Esc / 点遮罩关闭，避免状态还在跑弹窗先没了。
	useEffect(() => {
		if (!active) return;
		function block(e: KeyboardEvent): void {
			if (e.key === "Escape") e.stopPropagation();
		}
		document.addEventListener("keydown", block, true);
		return () => document.removeEventListener("keydown", block, true);
	}, [active]);

	const percent =
		state.totalRows && state.totalRows > 0
			? Math.min(100, Math.round((state.rowsExported / state.totalRows) * 100))
			: 0;
	const elapsedMs = (state.finishedAt ?? now) - state.startedAt;
	const rowsText =
		state.totalRows && state.totalRows > 0
			? `已导出 ${state.rowsExported.toLocaleString()} / ${state.totalRows.toLocaleString()} 行`
			: `已导出 ${state.rowsExported.toLocaleString()} 行`;

	function redownload(): void {
		if (!state.downloadUrl) return;
		const a = document.createElement("a");
		a.href = state.downloadUrl;
		a.download = state.fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	return (
		<div
			className="dbx-modal-backdrop"
			onClick={active ? undefined : onClose}
			role="presentation"
		>
			<div
				className="flex w-[440px] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/50"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="导出表数据"
			>
				{/* 头部 */}
				<div className="flex shrink-0 items-center px-5 pt-4">
					<h3 className="flex-1 text-[15px] font-semibold text-foreground">导出表数据</h3>
					{!active && (
						<button
							type="button"
							onClick={onClose}
							title="关闭"
							className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
						>
							<span className="icon-[lucide--x] h-4 w-4" />
						</button>
					)}
				</div>

				{/* 主体 */}
				<div className="space-y-4 px-5 py-4">
					<div className="truncate text-[12.5px] text-muted-foreground" title={state.fileName}>
						{state.fileName}
					</div>

					{/* 进度条 */}
					<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
						{active ? (
							state.totalRows && state.totalRows > 0 ? (
								<div
									className="h-full rounded-full bg-green-500 transition-[width] duration-300"
									style={{ width: `${percent}%` }}
								/>
							) : (
								<div className="h-full w-full overflow-hidden rounded-full">
									<div className="dbx-export-indeterminate h-full rounded-full bg-green-500" />
								</div>
							)
						) : state.status === "done" ? (
							<div className="h-full w-full rounded-full bg-green-500" />
						) : null}
					</div>

					{/* 状态行 */}
					<div className="flex items-center gap-2 text-[13px]">
						{state.status === "running" && (
							<>
								<span className="icon-[lucide--loader-2] h-4 w-4 animate-spin text-green-500" />
								<span className="text-foreground">正在导出数据…</span>
							</>
						)}
						{state.status === "done" && (
							<>
								<span className="icon-[lucide--circle-check] h-4 w-4 text-green-500" />
								<span className="font-medium text-green-600 dark:text-green-400">导出完成！</span>
							</>
						)}
						{state.status === "error" && (
							<>
								<span className="icon-[lucide--circle-x] h-4 w-4 text-destructive" />
								<span className="min-w-0 truncate text-destructive" title={state.errorMessage ?? undefined}>
									{state.errorMessage || "导出失败"}
								</span>
							</>
						)}
						{state.status === "cancelled" && (
							<>
								<span className="icon-[lucide--circle-alert] h-4 w-4 text-yellow-500" />
								<span className="text-yellow-600 dark:text-yellow-400">已取消导出</span>
							</>
						)}
					</div>

					{/* 行数 / 耗时 */}
					<div className="text-[12px] tabular-nums text-muted-foreground">
						{rowsText}
						{elapsedMs >= 0 && <span className="ml-3">耗时：{formatElapsed(elapsedMs)}</span>}
					</div>
				</div>

				{/* 底部操作 */}
				<div className="flex shrink-0 justify-end gap-2.5 border-t border-border px-5 py-3.5">
					{active ? (
						<button
							type="button"
							onClick={onCancel}
							className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3.5 text-[12px] text-foreground hover:bg-[var(--dbx-hover)]"
						>
							<span className="icon-[lucide--x] h-3.5 w-3.5" />
							取消导出
						</button>
					) : (
						<>
							{state.status === "done" && state.downloadUrl && (
								<button
									type="button"
									onClick={redownload}
									className="inline-flex h-8 items-center gap-1.5 rounded-md bg-muted px-3.5 text-[12px] font-medium text-foreground hover:opacity-90"
								>
									<span className="icon-[lucide--download] h-3.5 w-3.5" />
									重新下载
								</button>
							)}
							<button
								type="button"
								onClick={onClose}
								className="inline-flex h-8 items-center rounded-md border border-border px-4 text-[12px] text-foreground hover:bg-[var(--dbx-hover)]"
							>
								关闭
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
