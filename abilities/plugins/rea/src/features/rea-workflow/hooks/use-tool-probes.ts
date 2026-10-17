/**
 * 批量跑工具探测，结果缓存到组件生命周期内。
 *
 * 只在拿到宿主命令通道、且列表里确实有可探测的工具时才跑；目标类型/重新检测
 * 变化时重跑一次。12 个 `--version` 并行执行，失败互不影响。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProbeOutcome, ProbeRunner } from "../live/tool-probe";
import { probeTool, PROBE_TIMEOUT_MS } from "../live/tool-probe";

export interface ToolProbeDeps {
	/** 宿主命令通道；null 表示插件没有 `agent.command.run`。 */
	readonly run: ProbeRunner | null;
	readonly ids: readonly string[];
	readonly enabled: boolean;
}

export interface ToolProbeResult {
	readonly probes: Readonly<Record<string, ProbeOutcome>>;
	readonly probing: boolean;
	/** 有工具因为权限拿不到结论。 */
	readonly blocked: boolean;
	reprobe(): void;
}

export function useToolProbes(deps: ToolProbeDeps): ToolProbeResult {
	const depsRef = useRef(deps);
	depsRef.current = deps;
	const [probes, setProbes] = useState<Readonly<Record<string, ProbeOutcome>>>({});
	const [probing, setProbing] = useState(false);
	const [nonce, setNonce] = useState(0);
	const requestId = useRef(0);
	const key = deps.ids.join("|");

	const reprobe = useCallback(() => {
		setNonce((value) => value + 1);
	}, []);

	useEffect(() => {
		const current = depsRef.current;
		if (!current.enabled || current.run === null || key.length === 0) return;
		const run = current.run;
		const ids = key.split("|");
		const id = requestId.current + 1;
		requestId.current = id;
		setProbing(true);

		void (async () => {
			const settled = await Promise.all(
				ids.map(async (toolId) => [toolId, await probeTool(toolId, run)] as const),
			);
			if (requestId.current !== id) return;
			const next: Record<string, ProbeOutcome> = {};
			for (const [toolId, outcome] of settled) {
				if (outcome !== null) next[toolId] = outcome;
			}
			setProbes((prev) => ({ ...prev, ...next }));
			setProbing(false);
		})();
	}, [key, nonce, deps.enabled, deps.run]);

	const blocked = Object.values(probes).some((probe) => probe.state === "blocked");
	return { probes, probing, blocked, reprobe };
}

/** 探测超时（供 hook 调用方统一设置）。 */
export { PROBE_TIMEOUT_MS };
