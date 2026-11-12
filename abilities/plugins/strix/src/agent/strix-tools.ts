/**
 * The tools the console's own loop can call.
 *
 * These are the bridge's tools, described for a model rather than for MCP. The
 * one difference that matters is phrasing: upstream's MCP descriptions assume an
 * external agent that has other tools, while here every action goes through this
 * list, so `strix_exec` is the only way anything reaches the sandbox.
 */

import type { PluginAiChatTool } from "@astravia-org/plugin-sdk";

export const STRIX_TOOLS: PluginAiChatTool[] = [
	{
		name: "strix_environment",
		description:
			"Check whether this machine can run Strix tooling: the Docker sandbox and the skill library. Call it when a sandbox call failed and you want to know why.",
		parameters: { type: "object", properties: {}, additionalProperties: false },
	},
	{
		name: "strix_sandbox_start",
		description:
			"Start the Strix sandbox container for this assessment. It carries the pentest toolchain: nmap, nuclei, ffuf, sqlmap, subfinder, naabu, Caido, agent-browser, trivy, gitleaks, trufflehog, jwt_tool. Local directories are mounted at /workspace/<name>. Start one session and keep using it.",
		parameters: {
			type: "object",
			properties: {
				targets: {
					type: "array",
					items: { type: "string" },
					description: "URLs, domains, IPs or repository URLs you are authorised to test.",
				},
				localSources: {
					type: "array",
					description: "Host directories to expose inside the sandbox workspace.",
					items: {
						type: "object",
						properties: {
							path: { type: "string" },
							subdir: { type: "string" },
							readOnly: { type: "boolean" },
						},
						required: ["path"],
						additionalProperties: false,
					},
				},
			},
			additionalProperties: false,
		},
	},
	{
		name: "strix_exec",
		description:
			"Run a shell command inside the sandbox and return stdout, stderr and the exit code. Commands are capped at 10 minutes: launch anything longer in the background and poll it with another call.",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string", description: "Shell command, run with `sh -c`." },
				workdir: { type: "string", description: "Working directory inside the sandbox, e.g. /workspace/repo." },
				timeoutSec: { type: "number" },
			},
			required: ["command"],
			additionalProperties: false,
		},
	},
	{
		name: "strix_sandbox_status",
		description: "Current sandbox session: running, its targets, image and uptime.",
		parameters: { type: "object", properties: {}, additionalProperties: false },
	},
	{
		name: "strix_list_skills",
		description:
			"List Strix's security knowledge packs. Each entry has a name, a category and a one-line description.",
		parameters: { type: "object", properties: {}, additionalProperties: false },
	},
	{
		name: "strix_load_skills",
		description:
			"Load the full Markdown of one or more skills, by name or category/name. Load the packs that match the target before testing: they carry the technique, the payloads and the false-positive rules for that class of issue.",
		parameters: {
			type: "object",
			properties: { names: { type: "array", items: { type: "string" }, minItems: 1 } },
			required: ["names"],
			additionalProperties: false,
		},
	},
	{
		name: "strix_file_finding",
		description:
			"Record a confirmed vulnerability. File one only with evidence you actually produced - a request/response, a payload and its effect, or a code path. Include cvss and cwe when you know them, and put the reproduction in `poc`.",
		parameters: {
			type: "object",
			properties: {
				title: { type: "string" },
				severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
				target: { type: "string" },
				description: { type: "string" },
				impact: { type: "string" },
				technicalAnalysis: { type: "string" },
				poc: { type: "string" },
				evidence: { type: "string" },
				remediation: { type: "string" },
				cvss: { type: "number" },
				cwe: { type: "string" },
				cve: { type: "string" },
				confidence: { type: "string", enum: ["high", "medium", "low"] },
			},
			required: ["title", "severity"],
			additionalProperties: false,
		},
	},
	{
		name: "strix_list_findings",
		description: "Findings filed so far, ordered by severity, with a per-severity tally.",
		parameters: {
			type: "object",
			properties: { severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] } },
			additionalProperties: false,
		},
	},
	{
		name: "strix_report",
		description: "Render the Markdown penetration-test report from the findings filed so far.",
		parameters: {
			type: "object",
			properties: { targets: { type: "array", items: { type: "string" } } },
			additionalProperties: false,
		},
	},
];

/** The line the trace shows next to a tool name, e.g. the command that will run. */
export function describeToolCall(name: string, args: Record<string, unknown>): string | undefined {
	switch (name) {
		case "strix_exec":
			return typeof args.command === "string" ? args.command : undefined;
		case "strix_sandbox_start": {
			const targets = Array.isArray(args.targets) ? args.targets.map(String) : [];
			return targets.length ? targets.join(" ") : undefined;
		}
		case "strix_load_skills":
			return Array.isArray(args.names) ? args.names.map(String).join(", ") : undefined;
		case "strix_file_finding":
			return typeof args.title === "string" ? args.title : undefined;
		default:
			return undefined;
	}
}

/** A one-line outcome for the trace: exit code and duration, or the failure. */
export function describeToolResult(result: unknown): string {
	const value = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
	const parts: string[] = [];
	if (typeof value.exitCode === "number") parts.push(`exit ${value.exitCode}`);
	if (typeof value.durationMs === "number") parts.push(`${(value.durationMs / 1000).toFixed(1)}s`);
	if (typeof value.count === "number") parts.push(`${value.count} findings`);
	if (typeof value.running === "boolean" && value.running && typeof value.sessionId === "string") {
		parts.push(value.sessionId);
	}
	return parts.join(" · ");
}
