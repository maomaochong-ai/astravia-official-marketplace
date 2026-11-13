/**
 * Narrowing for the bridge's payloads.
 *
 * The service assembles `/api/state` from several host and Docker calls; if one of
 * them fails, the object still carries `ready` and the sections under it are absent.
 * Components must therefore never assume the shape - they render what was normalised
 * here, which is the one place that decides what "missing" means.
 *
 * This is `domain/` work per docs/plugin-project-structure.md: external responses are
 * narrowed at the boundary, not inside components.
 */

import type {
	CoverageOutcome,
	EnvironmentProbe,
	NoteSummary,
	SandboxStatus,
	StrixFinding,
	TodoItem,
} from "../runtime-contract";

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function flag(value: unknown): boolean {
	return value === true;
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function list(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? value.map(record).filter((item) => Object.keys(item).length > 0) : [];
}

/** A complete probe, or `undefined` when the payload is not one (an error envelope). */
export function normalizeProbe(raw: unknown): EnvironmentProbe | undefined {
	const value = record(raw);
	if (!("ready" in value)) return undefined;
	const python = record(value.python);
	const engine = record(value.engine);
	const docker = record(value.docker);
	const imagePresent = docker.imagePresent;
	return {
		python: {
			version: text(python.version),
			executable: text(python.executable),
			found: flag(python.found),
		},
		engine: { installed: flag(engine.installed), version: text(engine.version) },
		docker: {
			ready: flag(docker.ready),
			detail: text(docker.detail),
			image: text(docker.image),
			...(imagePresent === true || imagePresent === false ? { imagePresent } : {}),
		// Without this the panel cannot name the environment and falls back to "未确定"
		// even when the service reported one (ADR strix-0001: the mode is part of the probe).
		...(value.mode === "docker" || value.mode === "host" ? { mode: value.mode } : {}),
		},
		ready: flag(value.ready),
	};
}

export function normalizeSandbox(raw: unknown): SandboxStatus {
	const value = record(raw);
	const targets = Array.isArray(value.targets) ? value.targets.map(String).filter(Boolean) : [];
	const uptime = Number(value.uptimeSec);
	return {
		running: flag(value.running),
		...(value.sessionId ? { sessionId: String(value.sessionId) } : {}),
		...(value.image ? { image: String(value.image) } : {}),
		...(Number.isFinite(uptime) && uptime > 0 ? { uptimeSec: uptime } : {}),
		targets,
	};
}

export function normalizeFindings(raw: unknown): StrixFinding[] {
	return Array.isArray(raw)
		? (raw.filter((item) => item && typeof item === "object") as StrixFinding[])
		: [];
}

export function normalizeTodos(raw: unknown): TodoItem[] {
	return list(raw)
		.map((item) => ({
			id: text(item.id),
			title: text(item.title),
			status: text(item.status) || "pending",
			priority: text(item.priority) || "normal",
		}))
		.filter((todo) => todo.id && todo.title);
}

export function normalizeNotes(raw: unknown): NoteSummary[] {
	return list(raw)
		.map((item) => ({
			id: text(item.id),
			title: text(item.title),
			category: text(item.category),
			updatedAt: text(item.updated_at),
		}))
		.filter((note) => note.id && note.title);
}

export function normalizeCoverage(raw: unknown): CoverageOutcome[] {
	return list(raw)
		.map((item) => ({
			surface: text(item.surface),
			outcome: (text(item.outcome) || "clean") as CoverageOutcome["outcome"],
			...(item.note ? { note: text(item.note) } : {}),
		}))
		.filter((entry) => entry.surface);
}
