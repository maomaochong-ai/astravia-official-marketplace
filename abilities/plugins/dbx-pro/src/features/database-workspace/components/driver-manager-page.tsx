/**
 * DriverManagerPage — 驱动管理标签页（对齐 dbx DriverStoreDialog.vue 结构的简化版）。
 *
 * 在工作区 tab 中打开，不需要宿主 overlay。
 */

import { useCallback, useEffect, useState, type JSX } from "react";
import { engineDriverInstall, engineDriverSetPath, engineDriverStatus, type DriverStatus } from "../../../shared/services/engine-client";

interface DriverManagerPageProps {
	/** 关闭 tab */
	onClose?: () => void;
}

function formatSize(bytes?: number): string {
	if (!bytes) return "";
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DriverManagerPage({ onClose }: DriverManagerPageProps): JSX.Element {
	const [drivers, setDrivers] = useState<DriverStatus[]>([]);
	const [loading, setLoading] = useState(false);
	const [installingKey, setInstallingKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [customPathOpen, setCustomPathOpen] = useState<string | null>(null);
	const [customPath, setCustomPath] = useState("");

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await engineDriverStatus();
			setDrivers(result.drivers);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { void refresh(); }, [refresh]);

	async function handleInstall(driverKey: string) {
		setInstallingKey(driverKey);
		setError(null);
		try {
			await engineDriverInstall(driverKey);
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setInstallingKey(null);
		}
	}

	async function handleSetPath(driverKey: string) {
		if (!customPath.trim()) return;
		setError(null);
		try {
			await engineDriverSetPath(driverKey, customPath.trim());
			await refresh();
			setCustomPathOpen(null);
			setCustomPath("");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}

	return (
		<div className="flex h-full w-full min-h-0 flex-col bg-background">
			{/* 顶部工具栏 */}
			<div className="flex items-center justify-between border-b border-border px-4 py-2.5">
				<div className="flex items-center gap-2">
					<span className="icon-[lucide--hard-drive-download] h-4 w-4 text-muted" />
					<h2 className="text-[14px] font-semibold leading-none">驱动管理</h2>
					<span className="text-[12px] text-muted">— managed drivers</span>
				</div>
				<div className="flex items-center gap-1.5">
					<button type="button" onClick={() => void refresh()} className="dbx-btn ghost h-7 text-[12px]" title="刷新">
						<span className={"icon-[lucide--refresh-cw] h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
						刷新
					</button>
					{onClose && (
						<button type="button" onClick={onClose} className="dbx-btn ghost h-7 text-[12px]" title="关闭标签页">
							<span className="icon-[lucide--x] h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* 错误提示 */}
			{error && (
				<div className="mx-4 mt-3 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
					{error}
				</div>
			)}

			{/* 驱动列表 */}
			<div className="flex-1 overflow-auto p-4">
				{loading && drivers.length === 0 ? (
					<div className="flex items-center justify-center py-12 text-muted">
						<span className="icon-[lucide--loader-2] h-4 w-4 animate-spin mr-2" />
						检测驱动中…
					</div>
				) : drivers.length === 0 ? (
					<div className="py-12 text-center text-muted">没有需要管理的驱动</div>
				) : (
					<div className="space-y-2">
						{drivers.map((d) => (
							<div
								key={d.key}
								className="rounded border border-border bg-surface-raised px-4 py-3"
							>
								<div className="flex items-start justify-between gap-3">
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
											<>
												<p className="mt-1 truncate text-[11px] text-muted/70" title={d.path}>
													{d.path}
													{d.sizeBytes ? ` · ${formatSize(d.sizeBytes)}` : ""}
												</p>
												<p className="mt-0.5 text-[10px] text-muted/50">环境变量：{d.envVar}</p>
											</>
										) : (
											<>
												<p className="mt-1 text-[11px] text-muted/70">{d.reason}</p>
												{d.expectedPath && (
													<p className="mt-0.5 truncate text-[10px] text-muted/50" title={d.expectedPath}>
														期望路径：{d.expectedPath}
													</p>
												)}
												{d.envVar && (
													<p className="mt-0.5 text-[10px] text-muted/50">
														或设置环境变量 <code className="rounded bg-muted/20 px-1">{d.envVar}</code>
													</p>
												)}
											</>
										)}
									</div>
									<div className="shrink-0 flex items-center gap-2">
										{d.installed ? (
											<button type="button" onClick={() => void refresh()} className="dbx-btn ghost h-7 text-[12px]" title="刷新状态">
												<span className="icon-[lucide--refresh-cw] h-3.5 w-3.5" />
											</button>
										) : (
											<>
												<button
													type="button"
													disabled={installingKey !== null}
													onClick={() => setCustomPathOpen(customPathOpen === d.key ? null : d.key)}
													className="dbx-btn ghost h-7 text-[12px]"
													title="手动指定驱动路径"
												>
													<span className="icon-[lucide--folder-open] h-3.5 w-3.5" />
													指定路径
												</button>
												<button
													type="button"
													disabled={installingKey !== null}
													onClick={() => void handleInstall(d.key)}
													className="dbx-btn h-7 text-[12px]"
												>
													{installingKey === d.key ? (
														<>
															<span className="icon-[lucide--loader-2] h-3.5 w-3.5 animate-spin mr-1" />
															安装中…
														</>
													) : (
														<>
															<span className="icon-[lucide--download] h-3.5 w-3.5 mr-1" />
															安装
														</>
													)}
												</button>
											</>
										)}
									</div>
								</div>

								{/* 手动指定路径展开 */}
								{customPathOpen === d.key && !d.installed && (
									<div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
										<input
											type="text"
											value={customPath}
											onChange={(e) => setCustomPath(e.target.value)}
											placeholder={`输入驱动可执行文件的完整路径，如 /usr/local/bin/duckdb_worker`}
											className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-[12px] focus:border-primary focus:outline-none"
											onKeyDown={(e) => { if (e.key === "Enter") void handleSetPath(d.key); }}
										/>
										<button type="button" onClick={() => void handleSetPath(d.key)} disabled={!customPath.trim()} className="dbx-btn h-7 text-[12px]">
											应用
										</button>
										<button type="button" onClick={() => { setCustomPathOpen(null); setCustomPath(""); }} className="dbx-btn ghost h-7 text-[12px]">
											取消
										</button>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			{/* 底部说明 */}
			<div className="border-t border-border px-4 py-2 text-[11px] text-muted/70">
				驱动存放位置：~/.astravia-dbx-data/drivers/{" "}
				<span className="opacity-60">（也可手动设置 {drivers[0]?.envVar ?? "DBX_DUCKDB_DRIVER_PATH"} 环境变量）</span>
			</div>
		</div>
	);
}
