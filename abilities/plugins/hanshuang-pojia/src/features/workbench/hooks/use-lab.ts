import { useCallback, useEffect, useRef, useState } from "react";
import { LAB_DEFAULT, LAB_OFF, type LabState } from "../../../domain/lab-mode";
import type { WorkbenchBridge } from "../bridge";

/** 与 settings / library 同一套存储约定：读写失败就退化成会话内状态。 */
export const LAB_STATE_PATH = "workbench/lab-mode.json";

export interface LabModel {
	state: LabState;
	/** 面板里的开关；对话里的 `lab：` / `退出实验` 会走另一条路写同一份状态。 */
	set(enabled: boolean): void;
	/** 重新读一次存储，对话侧改动后靠它对齐。 */
	refresh(): void;
}

/**
 * 实验环境开关。
 *
 * 状态存在插件私有存储里而不是内存：换会话、换模型、面板重挂载都还在，
 * 这也是上游那张 lab-mode 标志文件的等价物。
 */
export function useLab(bridge: WorkbenchBridge): LabModel {
	// 默认开启：与 kernel 侧的 readLab 同一口径，否则面板显示开关打开、注入却说 OFF。
	const [state, setState] = useState<LabState>(LAB_DEFAULT);
	const alive = useRef(true);

	const load = useCallback(() => {
		bridge
			.labMode()
			.then(next => {
				// null = 首次运行、没有存储记录 → 保持默认开启。
				if (alive.current) setState(next ?? LAB_DEFAULT);
			})
			.catch(() => {
				/* 无 storage 权限时保持关闭 */
			});
	}, [bridge]);

	useEffect(() => {
		alive.current = true;
		load();
		return () => {
			alive.current = false;
		};
	}, [load]);

	const set = useCallback(
		(enabled: boolean) => {
			const next = enabled ? { enabled: true, since: state.since ?? new Date().toISOString() } : LAB_OFF;
			setState(next);
			bridge.saveLabMode(next).catch(() => {
				/* 写不进去也先让 UI 反映意图 */
			});
		},
		[bridge, state.since],
	);

	return { state, set, refresh: load };
}
