/**
 * The eleven tools declared to the agent — registration only.
 *
 * Behaviour lives in the domain layer; the gate, the standard failure answers, the status
 * read and the store accessor live in `features/tooling/services/tool-runtime` so they can
 * be tested on their own.
 * Rules that shaped this file:
 *  1. No MCP dependency (ADR 0003/0005).
 *  2. The host's command grant is the consent; the panel switch can only narrow it (ADR 0004).
 *  3. The client's local state is context, never a secret (ADR 0010).
 *  4. The screen belongs to ToDesk's window (ADR 0009).
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { judgeAutostart } from "../domain/autostart";
import { assessReadiness } from "../domain/remote-readiness";
import { describeDevice, matchDevice } from "../domain/device-store";
import { postureFindings } from "../domain/client-posture";
import { ACCESS_FIX } from "../features/tooling/copy/access-fixes";
import {
	AUTOSTART_OFF_ARGS,
	AUTOSTART_ON_ARGS,
	DISCONNECT_ARGS,
	buildControlArgs,
	normalizeDeviceId,
} from "../domain/todesk-cli";
import { outputOf, runTodesk } from "../domain/todesk-launch";
import { summarizeUsage } from "../domain/usage-store";
import {
	DISABLED,
	SCOPE,
	capabilityAllowed,
	hostFailure,
	readStatus,
	readStore,
	verifyConnection,
	type ToolBridge,
} from "../features/tooling/services/tool-runtime";

// The ids are the tools' contract, so they live next to the registrations that use them.
export const TOOL_STATUS = "todesk_status";
export const TOOL_READINESS = "todesk_readiness";
export const TOOL_DEVICES = "todesk_devices";
export const TOOL_CONNECT = "todesk_connect";
export const TOOL_USAGE = "todesk_usage";
export const TOOL_POSTURE = "todesk_posture";
export const TOOL_ACCOUNT = "todesk_account";
export const TOOL_AUTOSTART = "todesk_autostart";
export const TOOL_OPEN = "todesk_open_client";
export const TOOL_TRAY = "todesk_tray";
export const TOOL_DISCONNECT = "todesk_disconnect";

/** Every id this plugin registers, so a drift test can compare it against the docs. */
export const TOOL_IDS = [
	TOOL_STATUS,
	TOOL_READINESS,
	TOOL_DEVICES,
	TOOL_CONNECT,
	TOOL_USAGE,
	TOOL_POSTURE,
	TOOL_ACCOUNT,
	TOOL_AUTOSTART,
	TOOL_OPEN,
	TOOL_TRAY,
	TOOL_DISCONNECT,
] as const;

export type { ToolBridge } from "../features/tooling/services/tool-runtime";

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

	const devices = ctx.agent.registerTool({
		id: TOOL_DEVICES,
		label: "ToDesk saved devices",
		description:
			"List the machines this computer has saved in ToDesk's own device list: name, 9-digit code, last connect time, whether a credential is already saved, and (when the client recorded one) the display profile of the last session (`last_session`: which screen, resolution, quality, fps, HD) — so 'how did it look last time' has an answer. Use it whenever the user names a machine ('my office PC', 'the laptop') instead of typing nine digits — and before todesk_connect, so the code does not have to be asked for. It never returns passwords. Do NOT use it to guess: if two devices match, report the candidates.",
		scope_use: SCOPE,
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Optional device name, or part of one, to resolve instead of listing everything." },
			},
			additionalProperties: false,
		},
		handler: async ({ trigger }) => {
			if (!(await capabilityAllowed(bridge, "devices"))) return DISABLED;

			const input = (trigger.input ?? {}) as { query?: unknown };
			const query = typeof input.query === "string" ? input.query.trim() : "";
			const store = await readStore(bridge);
			if (store.error) return JSON.stringify({ ok: false, reason: store.error, directory: store.directory });

			if (!query) {
				return JSON.stringify({
					ok: true,
					count: store.devices.length,
					devices: store.devices.map(describeDevice),
					note:
						store.devices.length === 0
							? "the client has no saved devices yet; a session needs the far side's 9-digit code and its temporary password"
							: "connect with the name or the code; saved_credential=true means todesk_connect needs no password for that device",
				});
			}

			const match = matchDevice(store.devices, query);
			if (match.kind === "one") return JSON.stringify({ ok: true, device: describeDevice(match.device) });
			if (match.kind === "many") {
				return JSON.stringify({
					ok: false,
					reason: "more than one saved device matches",
					candidates: match.devices.map(describeDevice),
				});
			}
			return JSON.stringify({
				ok: false,
				reason: `no saved device matches "${query}"`,
				hint: "ask for the 9-digit code, or list the saved devices without a query",
			});
		},
	});

	const connect = ctx.agent.registerTool({
		id: TOOL_CONNECT,
		label: "ToDesk connect",
		description:
			"Open a ToDesk remote-control session from this computer to another device. Target either a saved device by name (`device`: 'my office PC') or a 9-digit code (`device_id`). The temporary password is required only when the target has no saved credential — ToDesk shows that password on the target machine. The session opens in ToDesk's own window; this tool cannot see or act inside it. Use it when the user asks to connect to another machine of theirs. Do NOT use it to control this computer — that is the host's own shell and file tools — and do not promise remote screen control.",
		scope_use: SCOPE,
		parameters: {
			type: "object",
			properties: {
				device: { type: "string", description: "Name (or part of one) of a saved device, as todesk_devices reported it." },
				device_id: { type: "string", description: "The far side's 9-digit ToDesk device code (spaces allowed)." },
				password: {
					type: "string",
					description:
						"The far side's temporary password, as ToDesk shows it on that machine. Required when the target has no saved credential; omit it for a device whose saved_credential is true.",
				},
			},
			additionalProperties: false,
		},
		handler: async ({ trigger }) => {
			if (!(await capabilityAllowed(bridge, "connect"))) return DISABLED;

			const input = (trigger.input ?? {}) as { device?: unknown; device_id?: unknown; password?: unknown };
			const wanted = typeof input.device === "string" ? input.device.trim() : "";
			const rawId = typeof input.device_id === "string" ? input.device_id : "";
			if (!wanted && !rawId) {
				return JSON.stringify({
					ok: false,
					reason: "give either a saved device name or a 9-digit device code",
					hint: "call todesk_devices to see the saved names",
				});
			}

			let deviceId = normalizeDeviceId(rawId);
			let deviceName: string | null = null;
			let savedCredential = false;

			if (wanted) {
				const store = await readStore(bridge);
				const match = matchDevice(store.devices, wanted);
				if (match.kind === "many") {
					return JSON.stringify({
						ok: false,
						reason: "more than one saved device matches",
						candidates: match.devices.map(describeDevice),
					});
				}
				if (match.kind === "one") {
					deviceId = match.device.deviceId;
					deviceName = match.device.name;
					savedCredential = match.device.hasSavedCredential;
				} else if (!deviceId) {
					return JSON.stringify({
						ok: false,
						reason: `no saved device matches "${wanted}"`,
						hint: "ask for the 9-digit code, or call todesk_devices without a query",
					});
				}
			}

			if (!deviceId) return JSON.stringify({ ok: false, reason: "device codes are 9 digits" });

			const password = typeof input.password === "string" ? input.password : "";
			if (password.trim().length === 0 && !savedCredential) {
				return JSON.stringify({
					ok: false,
					reason: "a temporary password is required",
					hint: "ask the user for the password ToDesk shows on the target machine",
				});
			}

			const args = buildControlArgs(deviceId, password);
			if (!args) return JSON.stringify({ ok: false, reason: "device codes are 9 digits" });

			// Snapshot the device row first: "connected" later has to be a change, not a state.
			const baseline = await readStore(bridge).catch(() => null);
			const before = baseline?.devices.find((device) => device.deviceId === deviceId) ?? null;

			const run = await runTodesk(bridge.run, args, undefined);
			if (!run.ok) return hostFailure(run, args);

			const established = await verifyConnection(bridge, deviceId, before);

			return JSON.stringify({
				ok: true,
				command: `ToDesk.exe ${args.join(" ")}`,
				device_id: deviceId,
				device_name: deviceName,
				established,
				established_note:
					established === "true"
						? "the client's device row advanced, so the session came up"
						: established === "false"
							? "the command was accepted but the device row has not advanced yet — it may still be negotiating"
							: "no local device row to compare against, so the plugin cannot tell whether the session came up",
				password_used: password.length > 0,
				note:
					password.length > 0
						? "confirm the prompt in the ToDesk client window"
						: savedCredential
							? "the client is using the credential it already saved for this device"
							: "the ToDesk client should be opening the session; it asks for the password itself when the far side requires one",
			});
		},
	});
	const readiness = ctx.agent.registerTool({
		id: TOOL_READINESS,
		label: "ToDesk readiness",
		description:
			"One call that answers 'can I leave this computer, and can someone reach it?': it combines identity, the access posture, start-with-Windows and the saved device list into a verdict (ready | degraded | blocked) plus one item per gap with a concrete fix. It also flags a saved device the client still marks as connected (a session left open keeps occupying a channel) and unapplied autostart. Use it before travelling, before leaving a machine unattended, or when the far side says it cannot connect. It reports flags only, never a password. Do NOT use it to change a setting — it hands back the command the user can run.",
		scope_use: SCOPE,
		parameters: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => {
			if (!(await capabilityAllowed(bridge, "readiness"))) return DISABLED;

			const status = await readStatus(bridge);
			if (status.ok === false) return JSON.stringify(status);

			const store = await readStore(bridge);
			const report = assessReadiness({
				deviceId: typeof status.device_id === "string" ? status.device_id : null,
				clientRunning: status.client_running === true,
				autostart: typeof status.autostart === "boolean" ? status.autostart : null,
				posture: store.posture,
				devices: store.error ? null : store.devices,
				fixes: ACCESS_FIX,
			});

			return JSON.stringify({
				ok: true,
				verdict: report.verdict,
				device_id: status.device_id ?? null,
				client_running: status.client_running === true,
				items: report.items,
				note:
					report.verdict === "ready"
						? "reachable from outside and ready to connect out"
						: "fix the warn/bad items before relying on this machine unattended",
			});
		},
	});

	const usage = ctx.agent.registerTool({
		id: TOOL_USAGE,
		label: "ToDesk usage",
		description:
			"How often this computer started remote sessions, from ToDesk's own per-day counters: totals per device and the date range covered. Use it when the user asks which machine they connect to most, whether they connected today, or whether a session they remember actually happened (counts only — it is not a session log). Do NOT use it to prove who connected *to* this machine; that is not in this file.",
		scope_use: SCOPE,
		parameters: {
			type: "object",
			properties: {
				days: { type: "number", description: "How many days back to count, including today. Default 7." },
			},
			additionalProperties: false,
		},
		handler: async ({ trigger }) => {
			if (!(await capabilityAllowed(bridge, "usage"))) return DISABLED;

			const input = (trigger.input ?? {}) as { days?: unknown };
			const days = typeof input.days === "number" && input.days > 0 ? Math.min(90, Math.trunc(input.days)) : 7;
			const store = await readStore(bridge);
			if (store.error) return JSON.stringify({ ok: false, reason: store.error });

			const summary = summarizeUsage(store.usage, days, new Date());
			const names = new Map(store.devices.map((device) => [device.deviceId, device.name]));
			return JSON.stringify({
				ok: true,
				window_days: days,
				total_sessions: summary.total,
				from: summary.from,
				to: summary.to,
				by_device: summary.byDevice.map((entry) => ({
					device_id: entry.deviceId,
					name: names.get(entry.deviceId) ?? null,
					count: entry.count,
				})),
			});
		},
	});

	const posture = ctx.agent.registerTool({
		id: TOOL_POSTURE,
		label: "ToDesk access posture",
		description:
			"This machine's ToDesk access posture, read from the client's settings: whether an unattended password exists, whether the one-time password is offered, two-factor for incoming connections, the lock against strange devices, start-with-Windows, and the signed-in account (masked). Also returns findings. Use it when the user asks how safe remote access to this computer is, why nobody can connect, or whether to harden it. It never returns a password — only whether one is set. Do NOT use it to change settings.",
		scope_use: SCOPE,
		parameters: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => {
			if (!(await capabilityAllowed(bridge, "posture"))) return DISABLED;

			const store = await readStore(bridge);
			if (!store.posture) {
				return JSON.stringify({ ok: false, reason: "could not read ToDesk's config.ini", directory: store.directory });
			}
			return JSON.stringify({ ok: true, ...store.posture, findings: postureFindings(store.posture, ACCESS_FIX) });
		},
	});

	const account = ctx.agent.registerTool({
		id: TOOL_ACCOUNT,
		label: "ToDesk account",
		description:
			"Which ToDesk account this client is signed in as, through the documented `-user` flag. Use it when the user's device list looks wrong, when a connection is refused with an account error, or before relying on saved devices — the saved list belongs to the signed-in account. Do NOT use it to sign in or out.",
		scope_use: SCOPE,
		parameters: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => {
			if (!(await capabilityAllowed(bridge, "account"))) return DISABLED;

			const args = ["-user"];
			const run = await runTodesk(bridge.run, args, undefined);
			if (!run.ok || !run.result) return hostFailure(run, args);
			const text = outputOf(run.result)
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0 && !line.startsWith("[libusb]"));
			return JSON.stringify({ ok: true, raw: text });
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
			const args = [...(input.enabled ? AUTOSTART_ON_ARGS : AUTOSTART_OFF_ARGS)];
			const run = await runTodesk(bridge.run, args, undefined);
			if (!run.ok) return hostFailure(run, args);
			const after = await readStatus(bridge);
			const observed = typeof after.autostart === "boolean" ? after.autostart : null;
			const verdict = judgeAutostart(input.enabled, observed);
			return JSON.stringify({
				ok: true,
				requested: input.enabled,
				observed_autostart: observed,
				applied: verdict.applied,
				...(verdict.hint ? { hint: verdict.hint } : {}),
				...(verdict.remedy ? { remedy: verdict.remedy } : {}),
			});
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
			return JSON.stringify(run.ok ? { ok: true } : { ok: false, host_error: run.error ?? null });
		},
	});

	const tray = ctx.agent.registerTool({
		id: TOOL_TRAY,
		label: "Hide ToDesk to tray",
		description:
			"Hide the ToDesk client window into the system tray (`-tray`). Use it after a session is over when the user wants the desktop clean, or right before handing the screen over. It does not end a session — pair it with todesk_disconnect when that is the intent.",
		scope_use: SCOPE,
		parameters: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => {
			if (!(await capabilityAllowed(bridge, "tray"))) return DISABLED;
			const args = ["-tray"];
			const run = await runTodesk(bridge.run, args, undefined);
			return JSON.stringify(run.ok ? { ok: true } : hostFailure(run, args));
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
			if (!run.ok) return JSON.stringify({ ok: false, host_error: run.error ?? null });
			const after = await readStatus(bridge);
			return JSON.stringify({ ok: true, client_running: after.client_running ?? false });
		},
	});

	return {
		dispose: () => {
			status.dispose();
			readiness.dispose();
			devices.dispose();
			connect.dispose();
			usage.dispose();
			posture.dispose();
			account.dispose();
			autostart.dispose();
			open.dispose();
			tray.dispose();
			disconnect.dispose();
		},
	};
}
