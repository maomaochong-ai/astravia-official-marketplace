/**
 * use-driver-manager.ts — 驱动管理页的数据层：状态查询、异步安装与轮询、手动指定路径。
 *
 * 为什么要轮询：服务端的安装是异步的（下载 + 校验 + 解包，秒级到分钟级）。
 * 旧实现点了「安装」只等到一个「下载已开始」的应答就 refresh 一次，
 * 于是界面在用户眼里就是「闪一下回到未安装」——失败原因（HTTP 404）只写在了
 * 服务端状态文件里，永远不会出现在界面上。这里改成：
 *   安装 → 轮询状态直到 done/error → 把进度百分比与失败原因交给界面渲染。
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
	engineDriverInstall,
	engineDriverSetPath,
	engineDriverStatus,
	type DriverInstallPhase,
	type DriverInstallProgress,
	type DriverStatus,
} from "../../../shared/services/engine-client";

/** 安装阶段 → 界面文案（空字符串表示该阶段没有额外文案）。 */
export const DRIVER_INSTALL_STEP_TEXT: Record<DriverInstallPhase, string> = {
	idle: "",
	resolving: "获取驱动清单…",
	downloading: "下载中",
	extracting: "解压安装中…",
	done: "已安装",
	error: "安装失败",
};

const DEFAULT_POLL_INTERVAL_MS = 700;
/** 单次安装的等待上限。服务端还有 15 分钟的失联兜底，这里只是不让界面无限转圈。 */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export function isInstallSettled(progress?: DriverInstallProgress | null): boolean {
	return progress?.status === "done" || progress?.status === "error";
}

/** 进度描述：百分比优先，拿不到总长度时退化为已下载字节数。 */
export function describeInstallProgress(progress?: DriverInstallProgress | null): string {
	if (!progress) return "";
	const parts: string[] = [DRIVER_INSTALL_STEP_TEXT[progress.status] ?? progress.status];
	if (progress.status === "downloading" && progress.percent != null) parts.push(`${progress.percent}%`);
	return parts.filter(Boolean).join(" ");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface UseDriverManagerOptions {
	intervalMs?: number;
	timeoutMs?: number;
	/** 测试用：关掉挂载时的自动查询。 */
	autoLoad?: boolean;
}

export interface UseDriverManagerResult {
	drivers: DriverStatus[];
	loading: boolean;
	/** 请求层错误（引擎不可用、参数非法、轮询超时）；安装失败原因在所在驱动的 installStatus.error 里。 */
	error: string | null;
	installingKey: string | null;
	progress: DriverInstallProgress | null;
	refresh: () => Promise<void>;
	install: (driverKey: string) => Promise<void>;
	setPath: (driverKey: string, path: string) => Promise<void>;
	clearError: () => void;
}

export function useDriverManager({
	intervalMs = DEFAULT_POLL_INTERVAL_MS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	autoLoad = true,
}: UseDriverManagerOptions = {}): UseDriverManagerResult {
	const [drivers, setDrivers] = useState<DriverStatus[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [installingKey, setInstallingKey] = useState<string | null>(null);
	/** 轮询令牌：卸载或开始新安装时递增，让上一次的轮询循环自然退出。 */
	const pollToken = useRef(0);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const result = await engineDriverStatus();
			setDrivers(result.drivers);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!autoLoad) return;
		void refresh();
	}, [autoLoad, refresh]);

	useEffect(() => () => {
		pollToken.current += 1;
	}, []);

	const install = useCallback(
		async (driverKey: string) => {
			const token = pollToken.current + 1;
			pollToken.current = token;
			setError(null);
			setInstallingKey(driverKey);
			setDrivers((prev) => prev.map((d) => (d.key === driverKey ? { ...d, installStatus: { status: "resolving", downloaded: 0, total: 0 } } : d)));
			try {
				const started = await engineDriverInstall(driverKey);
				if (started?.installedPath) {
					await refresh();
					return;
				}
				const deadline = Date.now() + timeoutMs;
				while (Date.now() < deadline) {
					await sleep(intervalMs);
					if (pollToken.current !== token) return;
					const result = await engineDriverStatus();
					setDrivers(result.drivers);
					const driver = result.drivers.find((d) => d.key === driverKey);
					if (driver?.installed) return;
					if (driver?.installStatus?.status === "error") return; // 失败原因由卡片上的 installStatus.error 呈现
				}
				setError(`驱动安装超时：${Math.round(timeoutMs / 1000)} 秒内未完成，请检查网络后重试`);
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
				await refresh().catch(() => undefined);
			} finally {
				if (pollToken.current === token) setInstallingKey(null);
			}
		},
		[intervalMs, refresh, timeoutMs],
	);

	const setPath = useCallback(
		async (driverKey: string, path: string) => {
			setError(null);
			try {
				await engineDriverSetPath(driverKey, path);
				await refresh();
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			}
		},
		[refresh],
	);

	const clearError = useCallback(() => setError(null), []);

	const progress = installingKey
		? (drivers.find((d) => d.key === installingKey)?.installStatus ?? null)
		: null;

	return { drivers, loading, error, installingKey, progress, refresh, install, setPath, clearError };
}
