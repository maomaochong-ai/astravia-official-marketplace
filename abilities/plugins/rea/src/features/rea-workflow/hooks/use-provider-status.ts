/**
 * REA CLI provider 的实时 phase。
 *
 * 以前这份订阅住在「引擎条」组件里，侧栏的状态芯片和顶栏拿不到它。
 * 提到 hook 之后整个面板只有一份订阅：容器调用一次，侧栏、顶栏、引擎页共用。
 *
 * 只做订阅与归类，不发命令；retry 由调用方决定什么时候点。
 */

import { useEffect, useState } from "react";
import type { PluginCliProviderPhase, PluginCliProviderStatus } from "@astravia-org/plugin-sdk";

export interface ProviderStatusSource {
	getStatus(): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): { dispose: () => void };
	retry(): Promise<void>;
}

export interface ProviderStatusState {
	readonly status: PluginCliProviderStatus | null;
	readonly phase: PluginCliProviderPhase;
	/** checking / installing / verifying 期间不许再点 retry。 */
	readonly busy: boolean;
	readonly retry: () => void;
}

export function useProviderStatus(source: ProviderStatusSource): ProviderStatusState {
	const [status, setStatus] = useState<PluginCliProviderStatus | null>(null);

	useEffect(() => {
		let cancelled = false;
		void source.getStatus().then((next) => {
			if (!cancelled) setStatus(next);
		});
		const subscription = source.onStatusChanged((next) => setStatus(next));
		return () => {
			cancelled = true;
			subscription.dispose();
		};
	}, [source]);

	const phase: PluginCliProviderPhase = status?.phase ?? "checking";
	const busy = phase === "checking" || phase === "installing" || phase === "verifying";

	return {
		status,
		phase,
		busy,
		retry: () => {
			void source.retry();
		},
	};
}

export type ProviderTone = "neutral" | "progress" | "success" | "warning" | "danger";

export function providerTone(phase: PluginCliProviderPhase): ProviderTone {
	switch (phase) {
		case "ready":
			return "success";
		case "failed":
			return "danger";
		case "disabled":
			return "warning";
		case "checking":
		case "installing":
		case "verifying":
			return "progress";
		default:
			return "neutral";
	}
}

export function providerLabelKey(phase: PluginCliProviderPhase): string {
	switch (phase) {
		case "ready":
			return "setup.status.ready";
		case "failed":
			return "setup.status.failed";
		case "installing":
			return "setup.status.installing";
		case "verifying":
			return "setup.status.probing";
		case "checking":
			return "setup.status.pending";
		case "disabled":
			return "setup.status.idle";
		default:
			return "setup.status.idle";
	}
}

/** 侧栏底部那块状态：四档就够，`idle` / `disabled` 都算「没就绪」。 */
export function providerEngineTone(phase: PluginCliProviderPhase): "success" | "warning" | "danger" | "idle" {
	switch (phase) {
		case "ready":
			return "success";
		case "failed":
			return "danger";
		case "disabled":
			return "warning";
		case "checking":
		case "installing":
		case "verifying":
			return "warning";
		default:
			return "idle";
	}
}
