/**
 * What every tool module needs and none of them should re-implement: the host bridge
 * shape, the capability gate, the two standard failure answers, the status read, the
 * connection check, and the one way to reach the client's local store.
 *
 * Split out of `register-tools.ts` for two reasons that bit us:
 *  - the store wiring (`readTextFile` + `listDirectory`) was repeated at six call sites,
 *    so a change to the store reader meant six edits;
 *  - the gate is the plugin's security boundary, and it had no test that could reach it
 *    without standing up all eleven tools.
 */

import { parseGetId, parseStatus, parseVersion } from "../../../domain/todesk-cli";
import { outputOf, runTodesk } from "../../../domain/todesk-launch";
import { readLocalStore, type LocalStore } from "../../console/services/local-store";
import type { RunResult } from "../../../runtime-contract";

export const SCOPE = ["conversation", "project"] as const;


const ALLOW_COMMANDS_KEY = "allowCommands";
const TOOLS_KEY = "tools";

export interface ToolBridge {
	run(file: string, args: string[], env?: Record<string, string>): Promise<RunResult>;
	readSettings(): Promise<Record<string, unknown> | null>;
	readTextFile(path: string): Promise<string>;
	listDirectory(path: string): Promise<{ name: string; path: string }[]>;
}

export type ToolKey =
	| "status"
	| "readiness"
	| "devices"
	| "connect"
	| "usage"
	| "posture"
	| "account"
	| "autostart"
	| "open"
	| "tray"
	| "disconnect";

/** Tools that only read files: they work even when the host refused `ToDesk.exe`. */
const FILE_ONLY: ReadonlySet<ToolKey> = new Set(["status", "readiness", "devices", "usage", "posture"]);

/**
 * Consent is per capability: the panel writes { tools: { connect: false, … } }, and an
 * explicit false wins over everything. With no stored choice, a working ToDesk.exe *is*
 * the consent — the host already granted the command, the user already installed it.
 */
export async function capabilityAllowed(bridge: ToolBridge, key: ToolKey): Promise<boolean> {
	const settings = await bridge.readSettings().catch(() => null);

	const tools = settings?.[TOOLS_KEY];
	if (tools && typeof tools === "object") {
		const record = tools as Record<string, unknown>;
		if (record[key] === false) return false;
		if (record[key] === true) return true;
	}

	if (typeof settings?.[ALLOW_COMMANDS_KEY] === "boolean" && settings[ALLOW_COMMANDS_KEY] === false) return false;

	if (FILE_ONLY.has(key)) return true;
	return (await runTodesk(bridge.run, ["-status"], undefined)).ok;
}

export const DISABLED = JSON.stringify({
	ok: false,
	reason: "ToDesk control is switched off in the plugin panel",
	hint: "open the ToDesk panel and press 开启 / Allow in the banner, then ask again",
});

export function hostFailure(run: { error?: string | null }, args: string[]): string {
	return JSON.stringify({
		ok: false,
		command: `ToDesk.exe ${args.join(" ")}`,
		reason: "ToDesk's command line could not be started",
		host_error: run.error ?? null,
	});
}

/** One way to read the client's store, so a reader change is one edit. */
export function readStore(bridge: ToolBridge): Promise<LocalStore> {
	return readLocalStore({ readTextFile: bridge.readTextFile, listDirectory: bridge.listDirectory });
}

export async function readStatus(bridge: ToolBridge): Promise<Record<string, unknown>> {
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

/**
 * Did the session actually come up? ToDesk has no session API, so the only evidence is
 * the client's own device row moving: a newer RecentConnectTime, or IsConnected turning
 * true. Bounded (<=3 x 400 ms) and honest when it cannot tell (ADR 0011 §3.4).
 */
export async function verifyConnection(
	bridge: ToolBridge,
	deviceId: string,
	before: { lastConnectedAt: number | null; isConnected: boolean } | null,
): Promise<"true" | "false" | "unknown"> {
	if (!before) return "unknown";

	for (let attempt = 0; attempt < 3; attempt += 1) {
		await new Promise((resolve) => setTimeout(resolve, 400));
		const store = await readStore(bridge);
		if (store.error) return "unknown";
		const row = store.devices.find((device) => device.deviceId === deviceId);
		if (!row) return "unknown";
		const advanced = (row.lastConnectedAt ?? 0) > (before.lastConnectedAt ?? 0);
		if (advanced || (row.isConnected && !before.isConnected)) return "true";
	}
	return "false";
}
