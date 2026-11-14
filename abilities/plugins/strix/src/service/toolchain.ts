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
import { existsSync } from "node:fs";
import { join } from "node:path";
import { managedToolchainDir } from "./paths";

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

export interface ToolProbe {
	readonly name: string;
	readonly found: boolean;
	/** First line of the tool's own version output; empty when it printed nothing. */
	readonly version: string;
	/** `bundled` = the copy shipped with the plugin; `system` = whatever PATH had. */
	readonly source: "bundled" | "system" | "missing";
}

const PROBE_TIMEOUT_MS = 4_000;

/** `nahttpx` is the typo-proof spelling of httpx's binary; see the map below. */
const BINARY: Record<string, string> = { nahttpx: "httpx" };

async function probeOne(name: string): Promise<ToolProbe> {
	const binary = BINARY[name] ?? name;
	// The shipped copy wins over PATH (ADR strix-0005): it is the version this build was
	// tested against, and it is the reason a machine with no package manager still works.
	const managed = managedToolchainDir();
	const managedBinary = managed ? join(managed, process.platform === "win32" ? `${binary}.exe` : binary) : null;
	if (managedBinary && existsSync(managedBinary)) {
		const probed = await runProbe(managedBinary);
		return { name, found: true, version: probed ?? "", source: "bundled" };
	}

	const probed = await runProbe(binary);
	if (probed !== null) return { name, found: true, version: probed, source: "system" };
	return { name, found: false, version: "", source: "missing" };
}

/** Version line, or `null` when the binary is not on PATH at all. */
async function runProbe(binary: string): Promise<string | null> {
	for (const args of [["--version"], ["-version"], ["-V"], ["--help"]]) {
		try {
			const { stdout, stderr } = await run(binary, args, {
				timeout: PROBE_TIMEOUT_MS,
				windowsHide: true,
				maxBuffer: 256 * 1024,
			});
			return firstLine(stdout || stderr);
		} catch (error) {
			const failure = error as { code?: string | number; stdout?: string; stderr?: string };
			// A tool that ran but rejected the flag is still installed: ENOENT is the
			// only answer that means "not on PATH".
			if (failure.code !== "ENOENT" && failure.code !== 127) return firstLine(failure.stdout ?? "");
		}
	}
	return null;
}

function firstLine(text: string): string {
	return (text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "").trim().slice(0, 120);
}
/** All tools in parallel; bounded by the per-tool timeout, not by their sum. */
export async function probeToolchain(): Promise<ToolProbe[]> {
	return Promise.all(TOOLCHAIN.map((name) => probeOne(name)));
}

export function missingTools(probes: readonly ToolProbe[]): string[] {
	return probes.filter((probe) => !probe.found).map((probe) => probe.name);
}

/**
 * How to install a missing tool on this platform, as a copyable command.
 *
 * The plugin does not install these itself: every package manager here needs
 * privileges, network policy or licence terms that belong to the user (ADR strix-0002).
 * What it can do is stop the user from guessing — a copyable line per tool is the
 * difference between "nmap is missing" and "here is what to run".
 */
export function installHint(name: string, platform: NodeJS.Platform = process.platform): string {
	const binary = BINARY[name] ?? name;
	if (platform === "win32") {
		const scoop: Record<string, string> = {
			nmap: "scoop install nmap",
			nuclei: "scoop install nuclei",
			ffuf: "scoop install ffuf",
			subfinder: "scoop install subfinder",
			naabu: "scoop install naabu",
			katana: "scoop install katana",
			httpx: "scoop install httpx",
			trivy: "scoop install trivy",
			gitleaks: "scoop install gitleaks",
			trufflehog: "scoop install trufflehog",
			sqlmap: "pipx install sqlmap",
			hurl: "scoop install hurl",
			opengrep: "scoop install opengrep",
		};
		return scoop[binary] ?? `winget search ${binary}`;
	}
	if (platform === "darwin") {
		const brew: Record<string, string> = {
			trivy: "brew install trivy",
			hurl: "brew install hurl",
			gitleaks: "brew install gitleaks",
			trufflehog: "brew install trufflehog",
			sqlmap: "pipx install sqlmap",
		};
		return brew[binary] ?? `brew install ${binary}`;
	}
	if (binary === "sqlmap") return "pipx install sqlmap";
	if (["trivy", "hurl", "gitleaks", "trufflehog"].includes(binary)) return `sudo apt install ${binary}`;
	return `go install github.com/projectdiscovery/${binary}/cmd/${binary}@latest`;
}
