/**
 * 自动跑 `npx -y rea-agents@latest doctor --json`，把结果留给就绪面板解析。
 *
 * 为什么要自动跑：用户不该为了「能看到缺什么」先手工执行一条命令。
 * 什么时候跑：
 *   - 引擎进入 ready 且已确定目标类型时自动跑一次（每个目标类型一次）；
 *   - 用户点「重新检测」；
 *   - 一键安装完成后自动复检。
 *
 * 只读诊断，不写宿主状态；doctor 本身不改任何配置。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginCliProviderPhase, PluginCommandRunResult } from "@astravia-org/plugin-sdk";
import { parseDoctorChecks, type DoctorCheck } from "../live/doctor-readiness";
import type { TargetKind } from "../data/targets";

const DOCTOR_TIMEOUT_MS = 90_000;

export type DoctorStatus = "idle" | "checking" | "ready" | "failed";

export interface DoctorReportDeps {
	readonly run: (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
	readonly cwd: string | null;
	readonly target: TargetKind | null;
	readonly providerPhase: PluginCliProviderPhase | null;
}

export interface DoctorReport {
	readonly checks: readonly DoctorCheck[] | null;
	readonly status: DoctorStatus;
	/** 失败原因（引擎未就绪 / 命令没跑起来 / 输出不可解析）。 */
	readonly message: string | null;
	readonly lastRunAt: number | null;
	recheck(): void;
}

export function useDoctorReport(deps: DoctorReportDeps): DoctorReport {
	const depsRef = useRef(deps);
	depsRef.current = deps;
	const [checks, setChecks] = useState<readonly DoctorCheck[] | null>(null);
	const [status, setStatus] = useState<DoctorStatus>("idle");
	const [message, setMessage] = useState<string | null>(null);
	const [lastRunAt, setLastRunAt] = useState<number | null>(null);
	const [nonce, setNonce] = useState<number>(0);
	const ranFor = useRef<string | null>(null);
	const requestId = useRef(0);

	const recheck = useCallback(() => {
		ranFor.current = null;
		setNonce((value) => value + 1);
	}, []);

	useEffect(() => {
		const current = depsRef.current;
		if (current.providerPhase !== "ready") {
			// 引擎没好就先别跑：这时跑出来的失败原因跟工具无关。
			setStatus((prev) => (prev === "ready" ? prev : "idle"));
			return;
		}
		if (current.target === null) return;
		const key = `${current.target}:${nonce}`;
		if (ranFor.current === key) return;
		ranFor.current = key;

		const id = requestId.current + 1;
		requestId.current = id;
		setStatus("checking");
		setMessage(null);

		void (async () => {
			try {
				const result = await current.run(["doctor", "--json"], {
					...(current.cwd ? { cwd: current.cwd } : {}),
					timeoutMs: DOCTOR_TIMEOUT_MS,
				});
				if (requestId.current !== id) return;
				// doctor 存在缺失项时会以非 0 退出（healthy:false）。以前按退出码判定，
				// 整份报告被当成「检测失败」，所有工具于是回落 unknown——这就是
				// 「node 明明可用却显示检测失败」的根因。只要 stdout 里有合法 JSON 就采信。
				const parsed = parseDoctorChecks(result.stdout);
				if (parsed === null) {
					setChecks(null);
					setStatus("failed");
					setMessage((result.stderr || result.stdout || "").trim().slice(0, 240) || null);
					setLastRunAt(Date.now());
					return;
				}
				setChecks(parsed);
				setStatus("ready");
				setLastRunAt(Date.now());
			} catch (error) {
				if (requestId.current !== id) return;
				setStatus("failed");
				setMessage(error instanceof Error ? error.message : String(error));
			}
		})();
	}, [deps.providerPhase, deps.target, nonce]);

	return { checks, status, message, lastRunAt, recheck };
}
