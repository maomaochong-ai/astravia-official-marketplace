/**
 * 逐工具就绪状态：多来源合并，缺一不可地说明「凭什么这么说」。
 *
 * 三个来源，可信度从高到低：
 *
 *   doctor   `rea doctor --json` 的逐项检查（REA 自己的分析引擎视角）。
 *            上游 DoctorDiagnostics.ts 把提供方检查拍平进同一个 checks 数组，
 *            名字形如 `<provider>` 或 `<provider>-<check>`，所以用前缀匹配。
 *   probe    宿主命令通道跑一次 `--version`（live/tool-probe.ts）。doctor 不管
 *            frida / adb / apktool / binwalk / gdb 这些，探测能给出确定结论。
 *   session  本次会话里真实调用过没有：成功过算可用，全失败算不可用。
 *
 * 三者都没有证据时仍然是 unknown，但 UI 必须同时给出「怎么才能让它变确定」，
 * 不允许只写一个「未知」。
 */

import type { ReaLiveCall } from "./session-store";
import type { ProbeOutcome } from "./tool-probe";
import { runtimeEvidence, type SessionToolEvidence, type ToolRequirement } from "./tool-requirements";

export interface DoctorCheck {
	readonly name: string;
	readonly ok: boolean;
	readonly classification?: string;
	readonly detail?: string;
	readonly remediation?: string;
}

export type ReadinessState = "ready" | "missing" | "unknown";

/** 状态是从哪来的：doctor 检查 / 命令探测 / 会话调用。 */
export type ReadinessSource = "doctor" | "probe" | "session";

export interface ToolReadiness {
	readonly requirement: ToolRequirement;
	readonly state: ReadinessState;
	readonly detail: string | null;
	readonly remediation: string | null;
	readonly evidence: SessionToolEvidence | null;
	readonly source: ReadinessSource | null;
	/** 探测被权限挡住（插件没拿到命令执行授权），不是「没装」。 */
	readonly probeBlocked: boolean;
}

export interface ReadinessInputs {
	readonly checks: readonly DoctorCheck[] | null;
	readonly probes: Readonly<Record<string, ProbeOutcome>>;
	readonly calls: readonly ReaLiveCall[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function asDoctorCheck(value: unknown): DoctorCheck | null {
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

/** 从 doctor 的 stdout 里取出顶层文档。容忍前后混有日志行。 */
export function parseDoctorDocument(stdout: string): Record<string, unknown> | null {
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
	// 上游把同一份报告包在 report / data 里也能出：顺着包装找到真正带 checks 的那层。
	for (const candidate of [root, asRecord(root.report), asRecord(root.data)]) {
		if (candidate !== null && Array.isArray(candidate.checks)) return candidate;
	}
	return null;
}

/** 从 doctor 的 stdout 里取出 checks。 */
export function parseDoctorChecks(stdout: string): readonly DoctorCheck[] | null {
	const document = parseDoctorDocument(stdout);
	const checks = document?.checks;
	if (!Array.isArray(checks)) return null;
	return checks.map(asDoctorCheck).filter((check): check is DoctorCheck => check !== null);
}

function matchesProvider(requirement: ToolRequirement, name: string): boolean {
	const id = requirement.doctorId;
	if (id === null) return false;
	return name === id || name.startsWith(`${id}-`);
}

function fromDoctor(
	requirement: ToolRequirement,
	checks: readonly DoctorCheck[] | null,
	evidence: SessionToolEvidence | null,
): ToolReadiness | null {
	if (checks === null) return null;
	const matched = checks.filter((check) => matchesProvider(requirement, check.name));
	if (matched.length === 0) return null;
	const failed = matched.find((check) => !check.ok);
	if (!failed) {
		const first = matched[0];
		return {
			requirement,
			state: "ready",
			detail: first?.detail ?? null,
			remediation: null,
			evidence,
			source: "doctor",
			probeBlocked: false,
		};
	}
	return {
		requirement,
		state: "missing",
		detail: failed.detail ?? failed.classification ?? null,
		remediation: failed.remediation ?? null,
		evidence,
		source: "doctor",
		probeBlocked: false,
	};
}

/** 解析单个需求。 */
export function resolveReadiness(requirement: ToolRequirement, inputs: ReadinessInputs): ToolReadiness {
	const evidence = runtimeEvidence(requirement.id, inputs.calls);
	const probe = inputs.probes[requirement.id] ?? null;

	if (requirement.source === "doctor") {
		const fromChecks = fromDoctor(requirement, inputs.checks, evidence);
		if (fromChecks !== null) return fromChecks;
	}

	if (probe !== null && probe.state === "ready") {
		return {
			requirement,
			state: "ready",
			detail: probe.detail,
			remediation: null,
			evidence,
			source: "probe",
			probeBlocked: false,
		};
	}

	if (requirement.source === "runtime") {
		if (evidence && evidence.calls > evidence.errors) {
			return {
				requirement,
				state: "ready",
				detail: null,
				remediation: null,
				evidence,
				source: "session",
				probeBlocked: false,
			};
		}
		if (evidence) {
			return {
				requirement,
				state: "missing",
				detail: null,
				remediation: null,
				evidence,
				source: "session",
				probeBlocked: false,
			};
		}
	}

	if (probe !== null && probe.state === "missing") {
		return {
			requirement,
			state: "missing",
			detail: null,
			remediation: null,
			evidence,
			source: "probe",
			probeBlocked: false,
		};
	}

	return {
		requirement,
		state: "unknown",
		detail: null,
		remediation: null,
		evidence,
		source: probe?.state === "blocked" ? "probe" : null,
		probeBlocked: probe?.state === "blocked",
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
