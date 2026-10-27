import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { GOAL_LABEL, detectPlatform, type Goal } from "../../domain/toolchain/catalog";
import { inferGoal, planInstallation, renderPlan } from "../../domain/toolchain/install";
import { createCommandRunner, probeOnce } from "../../features/workbench/services/toolchain";

interface InstallToolchainInput {
	goal?: Goal;
	sample?: string;
	refresh?: boolean;
}

const GOALS = Object.keys(GOAL_LABEL) as Goal[];

export function registerInstallToolchainTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<InstallToolchainInput>({
		id: "install_toolchain",
		name: "install_toolchain",
		label: "%tool.installToolchain.label%",
		description: [
			"Work out which external reversing tools a goal needs, find out which of them are actually installed, and",
			"return the exact install command for this platform. This is the tool to install the reversing toolchain:",
			"run every command it returns with your own shell, one at a time, so the host can authorise each and the user",
			"sees progress per command.",
			"",
			"Call this as soon as a task needs an engine the plugin does not own — an APK that needs jadx, an ELF that",
			"needs radare2, a firmware image that needs binwalk — and again after the user says they installed",
			"something, with refresh=true.",
			"",
			"Goals: apk (unpack, decompile, signature), native (ELF / Mach-O / PE), firmware (carving), dynamic",
			"(device, Frida), full (everything). Omit goal and pass sample to infer it from the file extension.",
			"",
			"The plugin holds no package-manager permission, so it cannot install anything itself: the plan it returns",
			"lists the exact commands, and executing them is your job. When a command needs sudo or interactive",
			"confirmation, ask the user before running it. After each install, call probe_environment with refresh=true",
			"and only stop when the tool the goal needs answers a version probe. A tool marked 'blocked' is not",
			"missing — the host refused the call and only the user can fix that in the plugin settings.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				goal: { type: "string", enum: GOALS, description: "What the task is about. Inferred from sample when omitted." },
				sample: { type: "string", description: "Path or file name being analysed; the extension selects the goal." },
				refresh: { type: "boolean", description: "Ignore the one-minute probe cache (use after an install)." },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 90_000,
		handler: async context => {
			const input = context.trigger.input;
			const goal = input.goal ?? inferGoal(input.sample);
			const platform = detectPlatform(typeof navigator === "undefined" ? undefined : navigator.userAgent);

			const run = createCommandRunner(ctx);
			// No grant means no probe. The plan is still the right answer: it names the
			// commands, and its notes explain that the permission must be granted too.
			const report = run ? await probeOnce(run, { refresh: input.refresh === true }) : null;

			const plan = planInstallation(report, { platform, goal });
			const header = run ? "" : "External commands are not available to this plugin instance (agent.command.run not granted).\n";
			return `${header}${renderPlan(plan)}`;
		},
	});
}
