/**
 * Which of Strix's tools are actually runnable on this machine.
 *
 * The container carries a fixed toolchain; without one (ADR strix-0001) a scan runs
 * in the user's session, where the tools are only there if they are installed. The
 * panel and the model both need to know that difference per tool rather than per
 * environment: "nmap is here, sqlmap is not" is what decides whether a step is worth
 * attempting (ADR strix-0002).
 *
 * Probing is bounded and never installs anything: one `--version`-style call per tool,
 * short timeout, failures are answers.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Upstream's image carries these; the names match `agent/skills/strix/tooling/*.md`. */
export const TOOLCHAIN = [
	"nmap",
	"nuclei",
	"ffuf",
	"sqlmap",
	"subfinder",
	"nahttpx",
	"naabu",
	"opengrep",
	"katana",
	"hurl",
	"trivy",
	"gitleaks",
	"trufflehog",
	"jwt_tool",
] as const;

export type ToolName = (typeof TOOLCHAIN)[number];

export interface ToolProbe {
	readonly name: string;
	readonly found: boolean;
	/** First line of the tool's own version output; empty when it printed nothing. */
	readonly version: string;
}

const PROBE_TIMEOUT_MS = 4_000;

/** `nahttpx` is the typo-proof spelling of httpx's binary; see the map below. */
const BINARY: Record<string, string> = { nahttpx: "httpx" };

async function probeOne(name: string): Promise<ToolProbe> {
	const binary = BINARY[name] ?? name;
	for (const args of [["--version"], ["-version"], ["-V"], ["--help"]]) {
		try {
			const { stdout, stderr } = await run(binary, args, {
				timeout: PROBE_TIMEOUT_MS,
				windowsHide: true,
				maxBuffer: 256 * 1024,
			});
			const first = `${stdout || stderr}`.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
			return { name, found: true, version: first.trim().slice(0, 120) };
		} catch (error) {
			const failure = error as { code?: string | number; stdout?: string; stderr?: string };
			// A tool that ran but rejected the flag is still installed: ENOENT is the
			// only answer that means "not on PATH".
			if (failure.code !== "ENOENT" && failure.code !== 127) {
				const first = `${failure.stdout ?? ""}`.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
				return { name, found: true, version: first.trim().slice(0, 120) };
			}
		}
	}
	return { name, found: false, version: "" };
}

/** All tools in parallel; bounded by the per-tool timeout, not by their sum. */
export async function probeToolchain(): Promise<ToolProbe[]> {
	return Promise.all(TOOLCHAIN.map((name) => probeOne(name)));
}

export function missingTools(probes: readonly ToolProbe[]): string[] {
	return probes.filter((probe) => !probe.found).map((probe) => probe.name);
}
