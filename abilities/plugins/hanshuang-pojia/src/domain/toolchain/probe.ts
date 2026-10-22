/**
 * Toolchain probe: ask each declared executable for its version and turn the
 * answers into one honest report.
 *
 * The probe never assumes a tool exists. Two failure shapes are kept apart on
 * purpose: "the host refused the call" (declaration missing, permission denied,
 * user disabled it) versus "the executable is not installed". Only the second
 * one is fixed by installing something, so telling them apart is the whole
 * point of the report.
 */
import {
	CAPABILITY_LABEL,
	specsForCapability,
	TOOLCHAIN,
	type Capability,
	type CommandResult,
	type CommandRunner,
	type ToolId,
	type ToolSpec,
} from "./catalog";

export interface ToolStatus {
	id: ToolId;
	binary: string;
	available: boolean;
	/** Short version banner when available, otherwise the reason it is not. */
	detail: string;
	/** True when the host refused the call rather than the binary being absent. */
	blocked: boolean;
	/** Present only when the tool is missing. */
	install?: string;
}

export interface ToolchainReport {
	tools: readonly ToolStatus[];
	capabilities: Readonly<Record<Capability, boolean>>;
	missing: readonly Capability[];
}

export const DEFAULT_PROBE_TIMEOUT = 4_000;

const ALL_CAPABILITIES = Object.keys(CAPABILITY_LABEL) as Capability[];
const MAX_VERSION_CHARS = 120;

/** Host-side refusals read like `Command "r2" is not declared …` or `permission denied`. */
const BLOCKED_PATTERN = /permission|not (?:declared|allowed|enabled)|denied|disabled|unauthori[sz]ed/i;

const NOT_FOUND_PATTERN = /(?:ENOENT|not found|no such file|cannot find)/i;

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function firstLine(text: string): string {
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed) return trimmed.length > MAX_VERSION_CHARS ? `${trimmed.slice(0, MAX_VERSION_CHARS)}…` : trimmed;
	}
	return "";
}

function classify(spec: ToolSpec, result: CommandResult): ToolStatus {
	const banner = firstLine(result.stdout) || firstLine(result.stderr);
	if (result.exitCode === 0) {
		// A tool that answered cleanly without a distinguishable version banner is still runnable.
		return { id: spec.id, binary: spec.binary, available: true, detail: banner || "present", blocked: false };
	}
	// Non-zero exit is a failure even when it printed something: `jadx --version` without a JDK
	// writes an error and exits 1, and calling that "available" would send the user down the
	// wrong path (install jadx again instead of installing Java).
	if (result.exitCode !== null && banner) {
		return {
			id: spec.id,
			binary: spec.binary,
			available: false,
			detail: `exited with ${result.exitCode}: ${banner}`,
			blocked: false,
			install: spec.install,
		};
	}
	return {
		id: spec.id,
		binary: spec.binary,
		available: false,
		detail: banner || "no version output",
		blocked: false,
		install: spec.install,
	};
}

async function probeOne(
	run: CommandRunner,
	spec: ToolSpec,
	timeoutMs: number,
): Promise<ToolStatus> {
	try {
		const result = await run(spec.binary, spec.versionArgs, { timeoutMs });
		return classify(spec, result);
	} catch (error) {
		const message = messageOf(error);
		const blocked = BLOCKED_PATTERN.test(message) && !NOT_FOUND_PATTERN.test(message);
		return {
			id: spec.id,
			binary: spec.binary,
			available: false,
			detail: blocked ? `host refused: ${message}` : message,
			blocked,
			install: blocked ? undefined : spec.install,
		};
	}
}

export async function probeToolchain(
	run: CommandRunner,
	options: { timeoutMs?: number } = {},
): Promise<ToolchainReport> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT;
	const tools = await Promise.all(TOOLCHAIN.map(spec => probeOne(run, spec, timeoutMs)));

	const available = new Set(tools.filter(tool => tool.available).map(tool => tool.id));
	const capabilities = Object.fromEntries(
		ALL_CAPABILITIES.map(capability => {
			const required = specsForCapability(capability);
			return [capability, required.length > 0 && required.every(spec => available.has(spec.id))];
		}),
	) as Record<Capability, boolean>;

	return {
		tools,
		capabilities,
		missing: ALL_CAPABILITIES.filter(capability => !capabilities[capability]),
	};
}

/** Names the tools that must be installed before `capability` works, for error text. */
export function remedyFor(capability: Capability): string {
	const specs = specsForCapability(capability);
	if (specs.length === 0) return `the ${capability} capability is not part of this plugin`;
	return specs.map(spec => `${spec.binary} (${spec.install})`).join(", ");
}

export function renderToolchain(report: ToolchainReport): string {
	const width = Math.max(...report.tools.map(tool => tool.binary.length));
	const rows = report.tools.map(tool => {
		const mark = tool.blocked ? "!" : tool.available ? "✓" : "✗";
		return `${tool.binary.padEnd(width)}  ${mark}  ${tool.detail}`;
	});
	const ready = ALL_CAPABILITIES.filter(capability => report.capabilities[capability]);
	const missing = ALL_CAPABILITIES.filter(capability => !report.capabilities[capability]);

	const lines = [
		"External toolchain (declared in plugin.json#commands, run by the host):",
		...rows,
		"",
		ready.length > 0
			? `Available: ${ready.map(capability => CAPABILITY_LABEL[capability]).join("; ")}`
			: "Available: none — the in-plugin byte analysis still works, see the plugin tools.",
	];

	if (missing.length > 0) {
		lines.push(`Missing: ${missing.map(capability => `${capability} → ${remedyFor(capability)}`).join("; ")}`);
	}
	const blocked = report.tools.filter(tool => tool.blocked);
	if (blocked.length > 0) {
		lines.push(
			"",
			"The host refused these commands. Declare them in plugin.json#commands and enable them in the plugin settings;",
			"installing more software will not change a refused call.",
		);
	}
	return lines.join("\n");
}
