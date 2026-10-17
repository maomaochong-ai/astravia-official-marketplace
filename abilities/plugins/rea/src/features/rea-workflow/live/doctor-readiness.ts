/**
 * `rea doctor --json` → 逐工具就绪状态。
 *
 * 上游 DoctorDiagnostics.ts 把核心检查与各提供方检查拍平进同一个 `checks` 数组，
 * 提供方检查名形如 `<provider>` 或 `<provider>-<check>`，所以这里用前缀匹配，
 * 不做模糊猜测。doctor 结果里没有的工具一律标 unknown —— 不推定「已安装」。
 *
 * doctor 之外的运行时依赖（frida / adb / apktool…）只能靠会话里真实调用过没有：
 * 成功过算可用，全部失败算调用失败，没调用过就是未知。
 */

import type { ReaLiveCall } from "./session-store";
import { runtimeEvidence, type SessionToolEvidence, type ToolRequirement } from "./tool-requirements";

export interface DoctorCheck {
	readonly name: string;
	readonly ok: boolean;
	readonly classification?: string;
	readonly detail?: string;
	readonly remediation?: string;
}

export type ReadinessState = "ready" | "missing" | "unknown";

export interface ToolReadiness {
	readonly requirement: ToolRequirement;
	readonly state: ReadinessState;
	readonly detail: string | null;
	readonly remediation: string | null;
	readonly evidence: SessionToolEvidence | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asCheck(value: unknown): DoctorCheck | null {
	const record = asRecord(value);
	if (!record) return null;
	const name = typeof record.name === "string" ? record.name : null;
	if (name === null) return null;
	return {
		name,
		ok: record.ok === true,
		...(typeof record.classification === "string" ? { classification: record.classification } : {}),
		...(typeof record.detail === "string" ? { detail: record.detail } : {}),
		...(typeof record.remediation === "string" ? { remediation: record.remediation } : {}),
	};
}

/** 从 doctor 的 stdout 里取出 checks。容忍前后混有日志行。 */
export function parseDoctorChecks(stdout: string): readonly DoctorCheck[] | null {
	const start = stdout.indexOf("{");
	const end = stdout.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(stdout.slice(start, end + 1));
	} catch {
		return null;
	}
	const root = asRecord(parsed);
	if (!root) return null;
	for (const candidate of [root, asRecord(root.report), asRecord(root.data)]) {
		const checks = candidate?.checks;
		if (!Array.isArray(checks)) continue;
		return checks.map(asCheck).filter((check): check is DoctorCheck => check !== null);
	}
	return null;
}

function matchesProvider(requirement: ToolRequirement, name: string): boolean {
	const id = requirement.doctorId;
	if (id === null) return false;
	return name === id || name.startsWith(`${id}-`);
}

/**
 * 解析单个需求。
 *
 * runtime 依赖优先看会话证据（可证实），doctor 类只看 doctor 输出。
 */
export function resolveReadiness(
	requirement: ToolRequirement,
	checks: readonly DoctorCheck[] | null,
	calls: readonly ReaLiveCall[],
): ToolReadiness {
	const evidence = runtimeEvidence(requirement.id, calls);

	if (requirement.source === "runtime") {
		if (evidence && evidence.calls > evidence.errors) {
			return { requirement, state: "ready", detail: null, remediation: null, evidence };
		}
		if (evidence) {
			return {
				requirement,
				state: "missing",
				detail: null,
				remediation: null,
				evidence,
			};
		}
		return { requirement, state: "unknown", detail: null, remediation: null, evidence };
	}

	if (checks === null) {
		return { requirement, state: "unknown", detail: null, remediation: null, evidence };
	}
	const matched = checks.filter((check) => matchesProvider(requirement, check.name));
	if (matched.length === 0) {
		return { requirement, state: "unknown", detail: null, remediation: null, evidence };
	}
	const failed = matched.find((check) => !check.ok);
	if (!failed) {
		const first = matched[0];
		return { requirement, state: "ready", detail: first?.detail ?? null, remediation: null, evidence };
	}
	return {
		requirement,
		state: "missing",
		detail: failed.detail ?? failed.classification ?? null,
		remediation: failed.remediation ?? null,
		evidence,
	};
}

export interface ReadinessSummary {
	readonly ready: number;
	readonly missing: number;
	readonly unknown: number;
	readonly total: number;
}

export function summarizeReadiness(items: readonly ToolReadiness[]): ReadinessSummary {
	let ready = 0;
	let missing = 0;
	let unknown = 0;
	for (const item of items) {
		if (item.state === "ready") ready += 1;
		else if (item.state === "missing") missing += 1;
		else unknown += 1;
	}
	return { ready, missing, unknown, total: items.length };
}

/** 可以无人值守安装的缺失项（目前只有 REA 官方支持的 Hopper）。 */
export function installableRequirement(items: readonly ToolReadiness[]): ToolReadiness | null {
	return items.find((item) => item.state === "missing" && item.requirement.autoInstallArgs !== undefined) ?? null;
}
