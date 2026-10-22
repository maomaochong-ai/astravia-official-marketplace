/**
 * Binds the plugin's external-process channel to `ctx.command.run`.
 *
 * The host only runs an executable declared in `plugin.json#commands` and left
 * enabled by the user, and only with `agent.command.run` granted. Every failure
 * of that contract surfaces here as `null` or as a rejected promise, so callers
 * can tell "not permitted" from "not installed" instead of blaming the user's
 * PATH for a permission problem.
 */
import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CommandResult, CommandRunner } from "../../../domain/toolchain/catalog";
import { probeToolchain, type ToolchainReport } from "../../../domain/toolchain/probe";
import { R2_TIMEOUT } from "../../../domain/toolchain/radare";

/** Re-probing on every tool call would spawn eight processes per turn. */
const PROBE_TTL_MS = 60_000;

let probeCache: { at: number; report: ToolchainReport } | null = null;

export function createCommandRunner(ctx: PluginContext): CommandRunner | null {
	if (!ctx.permissions.has("agent.command.run")) return null;
	const api = ctx.command as Partial<PluginContext["command"]> | undefined;
	if (!api || typeof api.run !== "function") return null;
	const run = api.run.bind(api);
	return async (file, args, options) => {
		const result = await run(file, [...args], { timeoutMs: options?.timeoutMs ?? R2_TIMEOUT });
		const normalised: CommandResult = {
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			exitCode: result.exitCode ?? null,
		};
		return normalised;
	};
}

export async function probeOnce(run: CommandRunner, options: { refresh?: boolean } = {}): Promise<ToolchainReport> {
	const now = Date.now();
	if (!options.refresh && probeCache && now - probeCache.at < PROBE_TTL_MS) return probeCache.report;
	const report = await probeToolchain(run);
	probeCache = { at: now, report };
	return report;
}

/** Exposed for tests and for the self-check page, which must not read a stale cache. */
export function resetProbeCache(): void {
	probeCache = null;
}

/** Turns a rejected `ctx.command.run` into the same shape the probe reports. */
export function describeCommandFailure(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (/permission|not (?:declared|allowed|enabled)|denied|disabled|unauthori[sz]ed/i.test(message)) {
		return (
			`The host refused this command (${message}). Declare the executable in plugin.json#commands and enable ` +
			"it in the plugin settings; installing more software will not help."
		);
	}
	if (/(?:ENOENT|not found|no such file)/i.test(message)) {
		return `The executable was not found (${message}). Run probe_environment to see what is installed.`;
	}
	return `The command could not be started: ${message}`;
}
