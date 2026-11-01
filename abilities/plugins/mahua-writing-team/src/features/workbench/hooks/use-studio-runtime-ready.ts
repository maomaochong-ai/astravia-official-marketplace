import { useEffect, useState } from "react";
import { tryGetStudioRuntime } from "../../../plugin-context.js";

/** 冷启动 / 热重载 / 重新启用时，运行时通常只比首次渲染晚一步：先密后疏地复查。 */
const FAST_RETRY_MS = 200;
const SLOW_RETRY_MS = 2_000;

/** 超过这个时长还没等到，就不该再装作「马上就好」——换成有字的等待页，继续以慢速复查。 */
const PATIENCE_MS = 60_000;

export type RuntimeStatus = "ready" | "waiting" | "stalled";

/**
 * 运行时到没到。
 *
 * `plugin-context` 是个普通模块变量，没有订阅；一次渲染读到 null 之后不会再变。
 * 这里在缺失时先按 200ms 复查，久等不到就降到 2s 并回报 `stalled`（界面换成有字的等待页），
 * 但永不放弃——只要运行时最终出现就切到 `ready`。
 *
 * 卡住时绝不沉默：宿主给同一插件开多个能力会话，后一次先装好运行时、前一次随后才卸载；
 * 卸载若抹掉了别人那份（见 `clearStudioRuntime`），界面就读不到 ctx。以前这里 60 秒后停表
 * 并留一张无字骨架，于是整块面板看起来就是空白。
 */
export function useStudioRuntimeReady(): RuntimeStatus {
	const [status, setStatus] = useState<RuntimeStatus>(() =>
		tryGetStudioRuntime() !== null ? "ready" : "waiting",
	);

	useEffect(() => {
		if (status === "ready") return;
		const startedAt = Date.now();
		let delay = status === "stalled" ? SLOW_RETRY_MS : FAST_RETRY_MS;
		let timer: ReturnType<typeof setTimeout> | null = null;

		const tick = (): void => {
			if (tryGetStudioRuntime() !== null) {
				setStatus("ready");
				return;
			}
			if (delay === FAST_RETRY_MS && Date.now() - startedAt >= PATIENCE_MS) {
				delay = SLOW_RETRY_MS;
				setStatus("stalled");
			}
			timer = setTimeout(tick, delay);
		};

		timer = setTimeout(tick, delay);
		return () => {
			if (timer) clearTimeout(timer);
		};
	}, [status]);

	return status;
}
