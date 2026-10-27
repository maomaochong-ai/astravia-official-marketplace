import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { renderToolchain } from "../../domain/toolchain/probe";
import { createCommandRunner, probeOnce } from "../../features/workbench/services/toolchain";
import { publishToolResult } from "../../runtime/panel-channel";

interface ProbeEnvironmentInput {
	refresh?: boolean;
}

export function registerProbeEnvironmentTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<ProbeEnvironmentInput>({
		id: "probe_environment",
		name: "probe_environment",
		label: "%tool.toolchain.label%",
		description: [
			"Report which external reversing tools this plugin is allowed to run and which are actually installed:",
			"radare2 (r2, rabin2, radiff2, rasm2, rahash2, rax2), jadx, apktool, java, adb, apksigner, zipalign and",
			"frida, each with its version banner.",
			"",
			"The answer separates two failure modes that look alike from the outside: the host refusing a command",
			"(it is not declared in plugin.json#commands, the user disabled it, or agent.command.run is not granted)",
			"versus an executable that is simply not on PATH. Only the second is fixed by installing software.",
			"",
			"Call it before run_radare or decompile_android when you do not yet know whether an engine exists, and",
			"when the user asks why a tool is unavailable. It runs one short `--version` command per tool and caches the",
			"result for a minute; pass refresh to force a new probe after the user installs something. To find out what",
			"to install for a particular kind of sample, call install_toolchain instead — it turns this report into",
			"platform-specific commands.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				refresh: { type: "boolean", description: "Ignore the one-minute cache and probe again (default false)." },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 60_000,
		handler: async context => {
			const run = createCommandRunner(ctx);
			if (!run) {
				return [
					"External commands are not available to this plugin instance.",
					"Either plugin.json#commands is empty or the agent.command.run permission was not granted.",
					"The plugin's own byte analysis (triage_binary, disassemble_range, decompile_function, …) does not",
					"need any of it.",
				].join("\n");
			}
			try {
				const report = await probeOnce(run, { refresh: context.trigger.input.refresh === true });
				const available = report.tools.filter(tool => tool.available);
				const blocked = report.tools.filter(tool => tool.blocked);
				const missing = report.tools.filter(tool => !tool.available && !tool.blocked);
				publishToolResult({
					toolId: "probe_environment",
					kind: "probe",
					summary: `${available.length} tool(s) ready · ${blocked.length} blocked · ${missing.length} missing`,
					payload: {
						refresh: context.trigger.input.refresh === true,
						available: available.map(tool => tool.id),
						blocked: blocked.map(tool => ({ id: tool.id, detail: tool.detail })),
						missing: missing.map(tool => ({ id: tool.id, detail: tool.detail })),
						total: report.tools.length,
					},
				});
				return renderToolchain(report);
				return renderToolchain(report);
			} catch (error) {
				return `Probe failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
