/**
 * 订阅宿主的 ocr provider 状态（探测 / 安装 / 校验 / 就绪 / 失败）。
 * 面板只要一份快照：初值拉一次，之后跟着广播走。
 */

import { useEffect, useState } from "react";
import type { Disposable, PluginCliProviderStatus } from "@astravia-org/plugin-sdk";
import type { OcrProviderBridge } from "../../../review/provider.ts";

export function useOcrStatus(provider: OcrProviderBridge): PluginCliProviderStatus | null {
	const [status, setStatus] = useState<PluginCliProviderStatus | null>(null);
	useEffect(() => {
		let alive = true;
		void provider
			.getStatus()
			.then((next) => {
				if (alive) setStatus(next);
			})
			.catch(() => {
				/* 读不到快照就只留「正在检测」，不阻塞面板渲染 */
			});
		const subscription: Disposable = provider.onStatusChanged((next) => setStatus(next));
		return () => {
			alive = false;
			subscription.dispose();
		};
	}, [provider]);
	return status;
}
