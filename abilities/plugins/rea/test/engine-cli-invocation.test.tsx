// @vitest-environment jsdom

/**
 * REA CLI 调用的参数形态。
 *
 * 真实故障：`plugin.json` 里 provider 的命令是 `npx`，宿主只做「命令 + 参数」的拼接，
 * 不补包名。面板直接传 `["doctor", "--json"]` 时执行的是 `npx doctor --json` ——
 * npm exec 找不到叫 doctor 的包就回落到 shell，得到 `sh: doctor: command not found`，
 * 面板显示「检查没有返回任何项目」，而引擎本身是好的。
 *
 * 这里钉住三件事：
 *   1. 包名前缀只在桥接层补一次，重复调用不会叠前缀；
 *   2. 桥接层把 provider id 与补齐后的参数原样交给宿主；
 *   3. 从 `useDoctorReport` 出发、经桥接层到宿主 `run` 的整条链，实参必须是
 *      `-y rea-agents@latest doctor --json` —— 少了这三段就是那个 bug 回来了。
 */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PluginCommandRunResult, PluginCliProviderStatus } from "@astravia-org/plugin-sdk";
import {
	REA_PACKAGE_ARGS,
	createReaProviderBridge,
	doctorArgs,
	reaPackageArgs,
} from "../src/features/rea-workflow/live/engine-bridge";
import { useDoctorReport } from "../src/features/rea-workflow/hooks/use-doctor-report";
import { parseDoctorReport } from "../src/features/rea-workflow/live/doctor-summary";

const PROVIDER_ID = "rea-agents";

/** 一份真实 doctor 输出的最小切片：字段名与真实报告一致。 */
const DOCTOR_JSON = JSON.stringify({
	healthy: false,
	environment_healthy: true,
	scope: { mode: "audit-wide", target: null },
	checks: [
		{ name: "node", ok: true, classification: "healthy", detail: "24.22.1" },
		{
			name: "ghidra",
			ok: false,
			classification: "missing_analysis_engine",
			detail: "GHIDRA_INSTALL_DIR is not set",
			remediation: "Set GHIDRA_INSTALL_DIR to an extracted Ghidra 12.1.x release directory.",
		},
	],
	identity: {
		cli_package_version: "6.8.0",
		catalog: { counts: { cli_commands: 175, mcp_tools: 229, mcp_prompts: 6 } },
		installations: { paths: ["/opt/rea/bin/rea"], state: "single" },
		skill: { installed_version: null, state: "missing" },
		registrations: [{ client: "claude_code", state: "ok" }],
	},
});

function okResult(stdout: string): PluginCommandRunResult {
	return { exitCode: 1, stdout, stderr: "" } as unknown as PluginCommandRunResult;
}

interface Recorded {
	readonly providerId: string;
	readonly args: readonly string[];
}

function fakeSource(respond: (args: readonly string[]) => PluginCommandRunResult = () => okResult(DOCTOR_JSON)): {
	source: Parameters<typeof createReaProviderBridge>[0];
	runs: Recorded[];
	spawns: Recorded[];
} {
	const runs: Recorded[] = [];
	const spawns: Recorded[] = [];
	const source = {
		getStatus: async () => ({ providerId: PROVIDER_ID, phase: "ready" }) as unknown as PluginCliProviderStatus,
		onStatusChanged: () => ({ dispose: () => {} }),
		retry: async () => {},
		run: async (providerId: string, args?: string[]) => {
			runs.push({ providerId, args: args ?? [] });
			return respond(args ?? []);
		},
		spawn: async (providerId: string, args?: string[]) => {
			spawns.push({ providerId, args: args ?? [] });
			return { kill: () => {} } as never;
		},
	};
	return { source, runs, spawns };
}

describe("包名前缀", () => {
	it("子命令前补齐 -y rea-agents@latest", () => {
		expect(reaPackageArgs(["doctor", "--json"])).toEqual([...REA_PACKAGE_ARGS, "doctor", "--json"]);
		expect(reaPackageArgs(["setup", "--yes", "--installHopper"])).toEqual([
			...REA_PACKAGE_ARGS,
			"setup",
			"--yes",
			"--installHopper",
		]);
	});

	it("已带前缀时不重复叠加", () => {
		expect(reaPackageArgs([...REA_PACKAGE_ARGS, "doctor", "--json"])).toEqual([...REA_PACKAGE_ARGS, "doctor", "--json"]);
		expect(reaPackageArgs(["rea-agents@latest", "doctor", "--json"])).toEqual([...REA_PACKAGE_ARGS, "doctor", "--json"]);
	});

	it("doctorArgs 只描述子命令与选项", () => {
		expect(doctorArgs()).toEqual(["doctor", "--json"]);
		expect(doctorArgs(true)).toEqual(["doctor", "--json", "--refresh"]);
	});
});

describe("桥接层", () => {
	it("把补齐后的参数和 provider id 交给宿主", async () => {
		const { source, runs, spawns } = fakeSource();
		const bridge = createReaProviderBridge(source, PROVIDER_ID);

		await bridge.run(["doctor", "--json"], { timeoutMs: 1000 });
		expect(runs).toEqual([{ providerId: PROVIDER_ID, args: [...REA_PACKAGE_ARGS, "doctor", "--json"] }]);

		await bridge.spawn?.(["setup", "--yes"], {});
		expect(spawns).toEqual([{ providerId: PROVIDER_ID, args: [...REA_PACKAGE_ARGS, "setup", "--yes"] }]);
	});

	it("宿主没有 spawn 通道时整条通道为 null", () => {
		const { source } = fakeSource();
		const withoutSpawn = { ...source, spawn: undefined };
		expect(createReaProviderBridge(withoutSpawn, PROVIDER_ID).spawn).toBeNull();
	});
});

describe("doctor 报告", () => {
	it("解析出 checks 与摘要字段", () => {
		const parsed = parseDoctorReport(DOCTOR_JSON);
		expect(parsed?.checks.length).toBe(2);
		expect(parsed?.checks[1]?.remediation).toContain("GHIDRA_INSTALL_DIR");
		expect(parsed?.summary.cliVersion).toBe("6.8.0");
		expect(parsed?.summary.environmentHealthy).toBe(true);
		expect(parsed?.summary.healthy).toBe(false);
		expect(parsed?.summary.catalog.mcpTools).toBe(229);
		expect(parsed?.summary.installPaths).toEqual(["/opt/rea/bin/rea"]);
		expect(parsed?.summary.registrations).toEqual([{ client: "claude_code", state: "ok" }]);
	});

	it("不是 JSON 时返回 null，而不是编一份空报告", () => {
		expect(parseDoctorReport("sh: doctor: command not found")).toBeNull();
	});
});

describe("useDoctorReport 走完整条链", () => {
	it("交给宿主的实参含包名前缀，结果可解析", async () => {
		const { source, runs } = fakeSource();
		const bridge = createReaProviderBridge(source, PROVIDER_ID);

		const { result } = renderHook(() =>
			useDoctorReport({ run: (args, options) => bridge.run(args, options), cwd: null, providerPhase: "ready" }),
		);

		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(runs[0]?.args).toEqual([...REA_PACKAGE_ARGS, "doctor", "--json"]);
		expect(result.current.checks?.length).toBe(2);
		expect(result.current.summary?.cliVersion).toBe("6.8.0");
	});

	it("命令没跑起来时明确失败，不冒充「检查没有项目」", async () => {
		const { source } = fakeSource(() => okResult("sh: doctor: command not found"));
		const bridge = createReaProviderBridge(source, PROVIDER_ID);

		const { result } = renderHook(() =>
			useDoctorReport({ run: (args, options) => bridge.run(args, options), cwd: null, providerPhase: "ready" }),
		);

		await waitFor(() => expect(result.current.status).toBe("failed"));
		expect(result.current.checks).toBeNull();
		expect(result.current.summary).toBeNull();
		expect(result.current.message).toContain("doctor: command not found");
	});
});
