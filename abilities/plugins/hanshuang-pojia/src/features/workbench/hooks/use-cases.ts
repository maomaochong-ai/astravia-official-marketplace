import { useCallback, useEffect, useMemo, useState } from "react";
import { scanCases, type CaseReadPort, type CaseRecord } from "../../../domain/case/library";
import { joinPath } from "../../../domain/toolchain/paths";
import type { WorkbenchBridge } from "../bridge";

export interface CasesModel {
	/** 扫描目标：项目根或它的 cases/ work/ 两侧；没有 cwd 时为空。 */
	cases: CaseRecord[];
	/** 已读案例目录上限被截断时非零，页面要说明结论不完整。 */
	truncated: number;
	scanning: boolean;
	error: string | null;
	selected: CaseRecord | null;
	readyCount: number;
	/** 按**路径**选中：cases/ 与 work/ 可能各有一个同名目录，名字不是身份。 */
	select(path: string | null): void;
	select(name: string | null): void;
	refresh(): void;
}

/**
 * 战例索引：只读操作者的 cases/ 与 work/，不写盘。
 *
 * 扫描顺序与 domain/case/library 一致（目录一层、scope.md 存在即为案例），面板不另写解析器 ——
 * 两套解析必然漂移，agent 工具与页面必须看到同一份记录。
 */
export function useCases(bridge: WorkbenchBridge, cwd: string | null, enabled: boolean): CasesModel {
	const [cases, setCases] = useState<CaseRecord[]>([]);
	const [truncated, setTruncated] = useState(0);
	const [scanning, setScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [tick, setTick] = useState(0);

	const refresh = useCallback(() => setTick(value => value + 1), []);

	useEffect(() => {
		if (!enabled) return;
		if (!cwd) {
			setCases([]);
			setError(null);
			return;
		}
		let cancelled = false;
		setScanning(true);
		setError(null);
		const port: CaseReadPort = {
			readDir: path => bridge.listFiles(path),
			readText: path => bridge.readTextFile(path),
		};
		// 两个命名空间各自成根：scanCases 只认 <root>/cases 与 <root>/work，所以这里把 cwd 传进去一次就够。
		scanCases(port, cwd)
			.then(result => {
				if (cancelled) return;
				setCases(result.cases);
				setTruncated(result.truncated);
			})
			.catch((failure: unknown) => {
				if (cancelled) return;
				setCases([]);
				setError(failure instanceof Error ? failure.message : String(failure));
			})
			.finally(() => {
				if (!cancelled) setScanning(false);
			});
		return () => {
			cancelled = true;
		};
	}, [bridge, cwd, enabled, tick]);

	const selected = useMemo(() => cases.find(record => record.path === selectedPath) ?? null, [cases, selectedPath]);
	const readyCount = useMemo(() => cases.filter(record => record.ready).length, [cases]);

	const select = useCallback((path: string | null) => setSelectedPath(path), []);

	return { cases, truncated, scanning, error, selected, readyCount, select, refresh };
}

/** 面板上不可点击的「案例在哪」提示：路径由调用方拼好，避免组件里再算一次。 */
export function caseScopePath(record: CaseRecord): string {
	return joinPath(record.path, "scope.md");
}

