/**
 * Agent-facing tools.
 *
 * Two rules, both learned the hard way:
 *  1. **No MCP dependency.** ToDesk's MCP endpoint belongs to its AI subsystem, cannot
 *     be switched on from the client, and never connected; the plugin drives the
 *     documented command line instead (ADR 0003, ADR 0005).
 *  2. **The user's consent is the host's command grant.** The manifest declares
 *     `ToDesk.exe`; the host keeps `grantedCommandNames`. The panel switch can only
 *     turn things further off, never grant what the host refused.
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import {
	AUTOSTART_OFF_ARGS,
	AUTOSTART_ON_ARGS,
	DISCONNECT_ARGS,
	buildControlArgs,
	normalizeDeviceId,
	parseGetId,
	parseStatus,
	parseVersion,
} from "../domain/todesk-cli";
import { outputOf, runTodesk } from "../domain/todesk-launch";
import type { RunResult } from "../runtime-contract";

const SCOPE = ["conversation", "project"] as const;
const ALLOW_COMMANDS_KEY = "allowCommands";
const TOOLS_KEY = "tools";

export const TOOL_STATUS = "todesk_status";
export const TOOL_CONNECT = "todesk_connect";
export const TOOL_AUTOSTART = "todesk_autostart";
export const TOOL_OPEN = "todesk_open_client";
export const TOOL_DISCONNECT = "todesk_disconnect";

export interface ToolBridge {
	run(file: string, args: string[], env?: Record<string, string>): Promise<RunResult>;
	readSettings(): Promise<Record<string, unknown> | null>;
}

async function readStatus(bridge: ToolBridge): Promise<Record<string, unknown>> {
	const run = await runTodesk(bridge.run, ["-status"], undefined);
	if (run.ok && run.result) {
		const parsed = parseStatus(outputOf(run.result));
		if (parsed.deviceId) {
			return {
				ok: true,
				device_id: parsed.deviceId,
				version: parsed.version,
				platform: parsed.platform,
				client_running: parsed.running,
				autostart: parsed.autostart,
				server: parsed.server,
				uptime: parsed.uptime,
			};
		}
	}

	const version = await runTodesk(bridge.run, ["-version"], undefined);
	const id = await runTodesk(bridge.run, ["-getid"], undefined);
	const deviceId = id.ok && id.result ? parseGetId(outputOf(id.result)) : null;
	if (deviceId) {
		return {
			ok: true,
			device_id: deviceId,
			version: version.ok && version.result ? (parseVersion(outputOf(version.result))?.version ?? null) : null,
			client_running: true,
			note: "-status did not parse; used -getid",
		};
	}

	return {
		ok: false,
		reason: "ToDesk's command line did not answer",
		host_error: run.error ?? id.error ?? null,
	};
}

type ToolKey = "status" | "connect" | "autostart" | "open" | "disconnect";

/**
 * Consent is per capability: the panel writes { tools: { connect: false, … } }, and an
 * explicit false wins over everything. With no stored choice, a working ToDesk.exe *is*
 * the consent — the host already granted the command, the user already installed it.
 */
async function capabilityAllowed(bridge: ToolBridge, key: ToolKey): Promise<boolean> {
	const settings = await bridge.readSettings().catch(() => null);

	const tools = settings?.[TOOLS_KEY];
	if (tools && typeof tools === "object") {
		const record = tools as Record<string, unknown>;
		if (record[key] === false) return false;
		if (record[key] === true) return true;
	}

	if (typeof settings?.[ALLOW_COMMANDS_KEY] === "boolean" && settings[ALLOW_COMMANDS_KEY] === false) return false;

	if (key === "status") return true;
	return (await runTodesk(bridge.run, ["-status"], undefined)).ok;
}

const DISABLED = JSON.stringify({
	ok: false,
	reason: "ToDesk control is switched off in the plugin panel",
	hint: "open the ToDesk panel and press 开启 / Allow in the banner, then ask again",
});

export function registerTodeskTools(ctx: PluginContext, bridge: ToolBridge): Disposable {
	const status = ctx.agent.registerTool({
		id: TOOL_STATUS,
		label: "ToDesk status",
		description:
			"Read this computer's ToDesk identity and readiness: the 9-digit device code someone else types in, the client version, whether the client process is running, and whether it starts with Windows (unattended access needs that). Use it before telling the user how to reach this machine, or when a ToDesk action failed and the reason matters. Do NOT use it to start a session.",
		scope_use: SCOPE,
		parameters: { type: "object", properties: {}, additionalProperties: false },
		handler: async () =>
			JSON.stringify({ ...(await readStatus(bridge)), commands_allowed: await capabilityAllowed(bridge, "status") }),
	});

	const connect = ctx.agent.registerTool({
		id: TOOL_CONNECT,
		label: "ToDesk connect",
		description:
			"Open a ToDesk remote-control session from this computer to another device. Needs the far side's 9-digit device code AND its temporary password (ToDesk shows that password on the target machine and requires it). The session opens in ToDesk's own window; this tool cannot see or act inside it. Use it when the user asks to connect to another machine of theirs and has given both values. Do NOT use it to control this computer — that is the host's own shell and file tools — and do not promise remote screen control.",
		scope_use: SCOPE,
		parameters: {
			type: "object",
			properties: {
				device_id: { type: "string", description: "The far side's 9-digit ToDesk device code (spaces allowed)." },
				password: {
					type: "string",
					description:
						"The far side's temporary password, as ToDesk shows it on that machine. Required: ToDesk will not open the session without it.",
				},
			},
			required: ["device_id", "password"],
			additionalProperties: false,
		},
		handler: async ({ trigger }) => {
			if (!(await capabilityAllowed(bridge, "connect"))) return DISABLED;

			const input = (trigger.input ?? {}) as { device_id?: unknown; password?: unknown };
			const deviceId = normalizeDeviceId(String(input.device_id ?? ""));
			if (!deviceId) return JSON.stringify({ ok: false, reason: "device codes are 9 digits" });

			const password = typeof input.password === "string" ? input.password : "";
			if (password.trim().length === 0) {
				return JSON.stringify({
					ok: false,
					reason: "a temporary password is required",
					hint: "ask the user for the password ToDesk shows on the target machine",
				});
			}
			const args = buildControlArgs(deviceId, password);
			if (!args) return JSON.stringify({ ok: false, reason: "device codes are 9 digits" });

			const run = await runTodesk(bridge.run, args, undefined);
			if (!run.ok) {
				return JSON.stringify({
					ok: false,
					command: `ToDesk.exe ${args.join(" ")}`,
					reason: "ToDesk's command line could not be started",
					host_error: run.error,
				});
			}
			return JSON.stringify({
				ok: true,
				command: `ToDesk.exe ${args.join(" ")}`,
				device_id: deviceId,
				password_used: password.length > 0,
				note:
					password.length > 0
						? "confirm the prompt in the ToDesk client window"
						: "the ToDesk client should be opening the session; it asks for the password itself when the far side requires one",
			});
		},
	});

	const autostart = ctx.agent.registerTool({
		id: TOOL_AUTOSTART,
		label: "ToDesk autostart",
		description:
			"Turn ToDesk's start-with-Windows setting on or off through its documented `-autostart` flag. Unattended access to this machine depends on it: with it off, nobody can connect after a reboot until someone launches ToDesk. Use it when the user wants this computer to stay reachable. Do NOT use it for other startup entries.",
		scope_use: SCOPE,
		parameters: {
			type: "object",
			properties: { enabled: { type: "boolean", description: "true to start with Windows, false to stop." } },
			required: ["enabled"],
			additionalProperties: false,
		},
		handler: async ({ trigger }) => {
			if (!(await capabilityAllowed(bridge, "autostart"))) return DISABLED;
			const input = (trigger.input ?? {}) as { enabled?: unknown };
			if (typeof input.enabled !== "boolean") return JSON.stringify({ ok: false, reason: "enabled must be a boolean" });
			const run = await runTodesk(bridge.run, [...(input.enabled ? AUTOSTART_ON_ARGS : AUTOSTART_OFF_ARGS)], undefined);
			if (!run.ok) {
				return JSON.stringify({
					ok: false,
					reason: "ToDesk's command line could not be started",
					host_error: run.error,
				});
			}
			const after = await readStatus(bridge);
			return JSON.stringify({ ok: true, requested: input.enabled, observed_autostart: after.autostart ?? null });
		},
	});

	const open = ctx.agent.registerTool({
		id: TOOL_OPEN,
		label: "Open ToDesk",
		description:
			"Bring up the ToDesk client window on this computer, for example so the user can read the temporary password or accept a connection prompt. Use it when the user needs ToDesk's own window; it does not start a session by itself.",
		scope_use: SCOPE,
		parameters: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => {
			if (!(await capabilityAllowed(bridge, "open"))) return DISABLED;
			const run = await runTodesk(bridge.run, [], undefined);
			return JSON.stringify(run.ok ? { ok: true } : { ok: false, host_error: run.error });
		},
	});


	const disconnect = ctx.agent.registerTool({
		id: TOOL_DISCONNECT,
		label: "ToDesk disconnect",
		description:
			"End the ToDesk connection this machine holds. ToDesk's command line has no per-session close, so this quits the client (documented '-exit'), which drops every session it carries; the user can reopen it with todesk_open_client. Use it when the user says to disconnect, hang up, or stop the remote session.",
		scope_use: SCOPE,
		parameters: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => {
			if (!(await capabilityAllowed(bridge, "disconnect"))) return DISABLED;
			const run = await runTodesk(bridge.run, [...DISCONNECT_ARGS], undefined);
			if (!run.ok) return JSON.stringify({ ok: false, host_error: run.error });
			const after = await readStatus(bridge);
			return JSON.stringify({ ok: true, client_running: after.client_running ?? false });
		},
	});

	return {
		dispose: () => {
			status.dispose();
			connect.dispose();
			autostart.dispose();
			open.dispose();
			disconnect.dispose();
		},
	};
}
