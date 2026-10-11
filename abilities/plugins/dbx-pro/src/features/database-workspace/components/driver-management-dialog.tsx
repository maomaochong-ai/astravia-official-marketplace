/**
 * driver-management-dialog.tsx — 驱动管理面板。
 *
 * 用法：<DriverManagementDialog open={open} onClose={() => setOpen(false)} />
 *
 * 后端 API：
 *   POST /driver/status     → { drivers: [{ key, label, installed, reason?, path?, sizeBytes? }] }
 *   POST /driver/install    → { ok: true, installedPath: string }
 *   POST /driver/set-path   → { ok: true, path: string }
 */

import { useCallback, useEffect, useState, type JSX } from "react";

interface DriverStatus {
	key: string;
	label: string;
	installed: boolean;
	reason?: string;
	path?: string;
	sizeBytes?: number;
	envVar?: string;
	description?: string;
	expectedPath?: string;
}

interface DriverInstallResponse {
	ok: boolean;
	driverKey: string;
	installedPath?: string;
}

async function fetchDriverStatus(): Promise<DriverStatus[]> {
	const res = await fetch("/driver/status", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({}),
	});
	const data = await res.json();
	return data?.data?.drivers ?? data?.drivers ?? [];
}

async function installDriver(driverKey: string, customUrl?: string): Promise<DriverInstallResponse> {
	const res = await fetch("/driver/install", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ driverKey, ...(customUrl ? { url: customUrl } : {}) }),
	});
	const data = await res.json();
	if (!res.ok || !data?.ok) {
		throw new Error(data?.error?.message ?? `安装失败 (HTTP ${res.status})`);
	}
	return data;
}

interface DriverManagementDialogProps {
	open: boolean;
	onClose: () => void;
}

export function DriverManagementDialog({ open, onClose }: DriverManagementDialogProps): JSX.Element {
	const [drivers, setDrivers] = useState<DriverStatus[]>([]);
	const [loading, setLoading] = useState(false);
	const [installingKey, setInstallingKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await fetchDriverStatus();
			setDrivers(list);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (open) void refresh();
	}, [open, refresh]);

	async function handleInstall(driverKey: string) {
		setInstallingKey(driverKey);
		setError(null);
		try {
			await installDriver(driverKey);
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setInstallingKey(null);
		}
	}

	if (!open) return <></>;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
			<div
				className="mx-auto w-[620px] max-w-[90vw] overflow-hidden rounded-lg border border-border bg-surface-raised shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				{/* 标题栏 */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<div className="flex items-center gap-2">
						<span className="icon-[lucide--hard-drive-download] h-4 w-4 text-muted" />
						<h3 className="text-[14px] font-semibold leading-none">驱动管理</h3>
						<span className="text-[12px] text-muted">— managed drivers（DuckDB / Redis 等）</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded p-1 text-muted hover:bg-hovered hover:text-text"
						title="关闭"
					>
						<span className="icon-[lucide--x] h-4 w-4" />
					</button>
				</div>

				{/* 错误提示 */}
				{error && (
					<div className="m-3 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
						{error}
					</div>
				)}

				{/* 驱动列表 */}
				<div className="max-h-[380px] overflow-auto p-3">
					{loading ? (
						<div className="flex items-center justify-center py-8 text-muted">
							<span className="icon-[lucide--loader-2] h-4 w-4 animate-spin mr-2" />
							检测驱动中…
						</div>
					) : drivers.length === 0 ? (
						<div className="py-8 text-center text-muted">没有需要管理的驱动</div>
					) : (
						<div className="space-y-2">
							{drivers.map((d) => (
								<div
									key={d.key}
									className="flex items-start justify-between gap-3 rounded border border-border px-3 py-2"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span
												className={
													"inline-block h-2 w-2 rounded-full " +
													(d.installed ? "bg-success" : "bg-warning")
												}
											/>
											<span className="text-[14px] font-medium">{d.label}</span>
											{d.installed ? (
												<span className="rounded bg-success/15 px-1.5 py-0.5 text-[11px] text-success">已安装</span>
											) : (
												<span className="rounded bg-warning/15 px-1.5 py-0.5 text-[11px] text-warning">未安装</span>
											)}
										</div>
										<p className="mt-0.5 text-[12px] text-muted">{d.description}</p>
										{d.installed ? (
											<p className="mt-1 truncate text-[11px] text-muted/70" title={d.path}>
												{d.path}
												{d.sizeBytes ? ` · ${(d.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ""}
											</p>
										) : (
											<>
												<p className="mt-1 text-[11px] text-muted/70">{d.reason}</p>
												{d.expectedPath && (
													<p className="mt-0.5 truncate text-[10px] text-muted/50" title={d.expectedPath}>
														期望路径：{d.expectedPath}
													</p>
												)}
											</>
										)}
									</div>
									<div className="shrink-0 flex items-center gap-2">
										{d.installed ? (
											<button
												type="button"
												onClick={refresh}
												className="dbx-btn ghost h-7 text-[12px]"
												title="刷新状态"
											>
												<span className="icon-[lucide--refresh-cw] h-3 w-3" />
											</button>
										) : (
											<button
												type="button"
												disabled={installingKey !== null}
												onClick={() => handleInstall(d.key)}
												className="dbx-btn h-7 text-[12px]"
											>
												{installingKey === d.key ? (
													<>
														<span className="icon-[lucide--loader-2] h-3 w-3 animate-spin mr-1" />
														安装中…
													</>
												) : (
													<>
														<span className="icon-[lucide--download] h-3 w-3 mr-1" />
														安装
													</>
												)}
											</button>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* 底部：手动设置路径入口 + 关闭 */}
				<div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted">
					<span>
						驱动存放位置：~/.astravia-dbx-data/drivers/{" "}
						<span className="opacity-70">(也可手动设置 {drivers[0]?.envVar} 环境变量)</span>
					</span>
					<div className="flex gap-2">
						<button type="button" onClick={refresh} className="dbx-btn ghost h-6 text-[11px]">
							<span className="icon-[lucide--refresh-cw] h-3 w-3 mr-1" />
							刷新
						</button>
						<button type="button" onClick={onClose} className="dbx-btn ghost h-6 text-[11px]">
							关闭
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
