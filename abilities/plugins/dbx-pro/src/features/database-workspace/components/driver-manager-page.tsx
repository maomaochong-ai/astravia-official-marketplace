/**
 * DriverManagerPage — 驱动管理标签页（对齐 dbx DriverStoreDialog.vue 结构的简化版）。
 *
 * 在工作区 tab 中打开，不需要宿主 overlay。
 * 数据与安装流程在 hooks/use-driver-manager.ts：安装是异步的，这里只负责把
 * 进度、失败原因和最终路径如实呈现出来。
 */

import { useState, type JSX } from "react";

import { formatBytes } from "../services/format-bytes";
import { describeInstallProgress, useDriverManager } from "../hooks/use-driver-manager";

interface DriverManagerPageProps {
	/** 关闭 tab */
	onClose?: () => void;
}

export function DriverManagerPage({ onClose }: DriverManagerPageProps): JSX.Element {
	const { drivers, loading, error, installingKey, progress, refresh, install, setPath, clearError } = useDriverManager();
	const [customPathOpen, setCustomPathOpen] = useState<string | null>(null);
	const [customPath, setCustomPath] = useState("");

	function closeCustomPath() {
		setCustomPathOpen(null);
		setCustomPath("");
	}

	async function handleSetPath(driverKey: string) {
		if (!customPath.trim()) return;
		await setPath(driverKey, customPath.trim());
		closeCustomPath();
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

			{/* 请求层错误（引擎不可用、参数非法、轮询超时） */}
			{error && (
				<div className="mx-4 mt-3 flex items-start gap-2 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
					<span className="flex-1">{error}</span>
					<button type="button" onClick={clearError} className="shrink-0 opacity-70 hover:opacity-100" title="关闭提示">
						<span className="icon-[lucide--x] h-3.5 w-3.5" />
					</button>
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
						{drivers.map((d) => {
							const installing = installingKey === d.key;
							const current = installing ? progress : d.installStatus;
							const failed = !d.installed && d.installStatus?.status === "error";
							const percent = d.installed ? null : (current?.percent ?? null);
							const installedPath = d.installedPath ?? d.expectedPath;
							return (
								<div key={d.key} className="rounded border border-border bg-surface-raised px-4 py-3">
									<div className="flex items-start justify-between gap-3">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className={"inline-block h-2 w-2 rounded-full " + (d.installed ? "bg-success" : "bg-warning")} />
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
													<p className="mt-1 truncate text-[11px] text-muted/70" title={installedPath}>
														{installedPath}
														{d.sizeBytes ? ` · ${formatBytes(d.sizeBytes)}` : ""}
													</p>
													<p className="mt-0.5 text-[10px] text-muted/50">环境变量：{d.envVar}</p>
													{d.installStatus?.status === "done" && d.installStatus.bridgeRestarted === false && (
														<p className="mt-1 text-[11px] text-warning">驱动已就位，但 dbx-mcp 未能自动重启 — 重启宿主后生效</p>
													)}
												</>
											) : (
												<>
													<p className="mt-1 text-[11px] text-muted/70">{d.reason}</p>
													{installedPath && (
														<p className="mt-0.5 truncate text-[10px] text-muted/50" title={installedPath}>
															期望路径：{installedPath}
														</p>
													)}
													{failed && d.installStatus?.error && (
														<p className="mt-1 text-[11px] text-danger">上次安装失败：{d.installStatus.error}</p>
													)}
													{d.envVar && (
														<p className="mt-0.5 text-[10px] text-muted/50">
															或设置环境变量 <code className="rounded bg-muted/20 px-1">{d.envVar}</code>
														</p>
													)}
												</>
											)}
											{!d.installed && current && current.status !== "idle" && current.status !== "error" && (
												<div className="mt-2" data-testid="driver-install-progress">
													{percent != null && (
														<div className="h-1 w-full overflow-hidden rounded bg-border">
															<div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${percent}%` }} />
														</div>
													)}
													<p className="mt-1 text-[10px] text-muted/70">
														{describeInstallProgress(current)}
														{current.downloaded > 0 ? ` · ${formatBytes(current.downloaded)}` : ""}
														{current.total > 0 && current.status === "downloading" ? ` / ${formatBytes(current.total)}` : ""}
													</p>
												</div>
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
														onClick={() => void install(d.key)}
														className="dbx-btn h-7 text-[12px]"
													>
														{installing ? (
															<>
																<span className="icon-[lucide--loader-2] h-3.5 w-3.5 animate-spin mr-1" />
																{describeInstallProgress(progress) || "安装中…"}
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
											<button type="button" onClick={closeCustomPath} className="dbx-btn ghost h-7 text-[12px]">
												取消
											</button>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* 底部说明 */}
			<div className="border-t border-border px-4 py-2 text-[11px] text-muted/70">
				驱动按平台存放在引擎数据目录的 drivers/ 下（见上方期望路径）；{" "}
				<span className="opacity-60">也可手动设置 {drivers[0]?.envVar ?? "DBX_DUCKDB_DRIVER_PATH"} 环境变量</span>
			</div>
		</div>
	);
}
