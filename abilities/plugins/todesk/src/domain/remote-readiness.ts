/**
 * "Can I leave, and can they reach me?" — one verdict instead of four lookups.
 *
 * The panel and the agent both need this answer, so it is a pure function over facts
 * somebody else already read: client identity, the posture flags, and the saved devices.
 * No I/O here, which is what makes the verdict testable — the rules below are the whole
 * contract (ADR 0011 §3.1).
 */

import type { ClientPosture } from "./client-posture";
import type { SavedDevice } from "./device-store";

export type ReadinessVerdict = "ready" | "degraded" | "blocked";
export type ReadinessState = "ok" | "warn" | "bad";

export interface ReadinessItem {
	code: string;
	state: ReadinessState;
	/** Plain English, agent-facing; the panel renders `code` through its own locales. */
	detail: string;
	/** A concrete remedy: a command when one exists, an exact UI path otherwise. */
	fix?: string;
}

export interface ReadinessInput {
	deviceId: string | null;
	clientRunning: boolean;
	/** From `-status`; the posture file is only a fallback for it. */
	autostart: boolean | null;
	posture: ClientPosture | null;
	/** null = the store could not be read, which is not the same as "none saved". */
	devices: SavedDevice[] | null;
}

export interface ReadinessReport {
	verdict: ReadinessVerdict;
	items: ReadinessItem[];
}

export function assessReadiness(input: ReadinessInput): ReadinessReport {
	const items: ReadinessItem[] = [];
	const posture = input.posture;

	if (!input.clientRunning) {
		items.push({
			code: "client-stopped",
			state: "bad",
			detail: "ToDesk is not running, so nobody can connect to this computer and nothing can be launched from it.",
			fix: "ToDesk.exe",
		});
	}

	if (!input.deviceId) {
		items.push({
			code: "no-device-code",
			state: "bad",
			detail: "This computer has no readable device code, so there is nothing to give the far side.",
			fix: "open the ToDesk client once and retry",
		});
	}

	// Inbound: the two things that actually stop a connection. Both off = nobody gets in.
	const unattended = posture?.unattendedPasswordSet ?? null;
	const tempPassword = posture?.tempPasswordEnabled ?? null;
	if (unattended === false || tempPassword === false) {
		const detail =
			unattended === false && tempPassword === false
				? "There is no unattended password and the one-time password is off, so this computer cannot be reached at all while unattended."
				: unattended === false
					? "No unattended password is set: this computer is only reachable while the ToDesk window is open and handing out a one-time password."
					: "The one-time password is off: a device without a saved password cannot get in.";
		items.push({
			code: unattended === false && tempPassword === false ? "inbound-closed" : unattended === false ? "unattended-password" : "temp-password",
			// Strictly speaking only "both off" is fatal; one of them is still a way in.
			state: unattended === false && tempPassword === false ? "bad" : "warn",
			detail,
			fix:
				unattended === false
					? "ToDesk.exe -setpasswd <new password>, or 设置 → 安全 → 安全密码"
					: "设置 → 安全 → 临时密码 → 打开",
		});
	}

	if (posture === null) {
		items.push({
			code: "posture-unknown",
			state: "warn",
			detail: "The client's settings could not be read, so the access flags are unknown and this verdict only covers the process and the device list.",
			fix: "open the ToDesk client once, then recheck",
		});
	}

	if (posture?.twoFactorForConnect === false) {
		items.push({
			code: "no-2fa",
			state: "warn",
			detail: "Incoming connections are protected by a password only; two-factor authentication is off.",
			fix: "设置 → 安全 → 二次验证",
		});
	}

	if (posture?.strangerConnectionLock === false) {
		items.push({
			code: "stranger-devices-allowed",
			state: "warn",
			detail: "Any device that knows the code and the password is accepted; only saved devices are not enforced.",
			fix: "设置 → 安全 → 仅允许受信任设备",
		});
	}

	const autostart = input.autostart ?? posture?.autostart ?? null;
	if (autostart === false) {
		items.push({
			code: "autostart",
			state: "warn",
			detail: "ToDesk does not start with Windows, so this computer is unreachable after a reboot until someone opens it.",
			fix: "ToDesk.exe -autostart on",
		});
	}

	if (input.devices && input.devices.length === 0) {
		items.push({
			code: "no-saved-devices",
			state: "warn",
			detail: "The client has no saved devices, so reaching another machine needs its 9-digit code and its temporary password.",
			fix: "connect once with a code; ToDesk then saves the device",
		});
	}

	const verdict: ReadinessVerdict = items.some((item) => item.state === "bad")
		? "blocked"
		: items.some((item) => item.state === "warn")
			? "degraded"
			: "ready";

	return { verdict, items };
}

/** Kept for the panel: one line per verdict, never a paragraph. */
export function verdictSummary(report: ReadinessReport): string {
	switch (report.verdict) {
		case "ready":
			return "Reachable from outside and ready to connect out.";
		case "degraded":
			return `Usable, with ${report.items.filter((item) => item.state !== "ok").length} thing(s) worth fixing before you rely on it.`;
		default:
			return "Not usable as it stands — the items marked below stop a session.";
	}
}
