import { useEffect, useState } from "react";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { AutomationRun } from "../../../domain/boardmix-run";
import { RUN_POLL_MS, mergeRuns, readStoredRun, subscribeAutomationRuns } from "../services/run-store";

/**
 * 面板与工具调用卡片共用一份「最近一次自动化」。同 realm 走订阅即时更新；
 * 跨 realm 只有存储能看见，所以在 `running` 期间轮询，跑完就停。
 */
export function useAutomationRun(ctx: PluginContext | null): AutomationRun | null {
	const [run, setRun] = useState<AutomationRun | null>(null);

	useEffect(() => {
		if (!ctx) return;
		let alive = true;
		const off = subscribeAutomationRuns(next => {
			if (alive) setRun(current => mergeRuns(current, next));
		});
		void readStoredRun(ctx).then(stored => {
			if (alive) setRun(current => mergeRuns(current, stored));
		});
		return () => {
			alive = false;
			off();
		};
	}, [ctx]);

	const running = run?.status === "running";

	useEffect(() => {
		if (!ctx || !running) return;
		const timer = window.setInterval(() => {
			void readStoredRun(ctx).then(stored => setRun(current => mergeRuns(current, stored)));
		}, RUN_POLL_MS);
		return () => window.clearInterval(timer);
	}, [ctx, running]);

	return run;
}
