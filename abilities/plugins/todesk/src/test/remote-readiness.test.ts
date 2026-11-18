import { describe, expect, it } from "vitest";
import type { ClientPosture } from "../domain/client-posture";
import type { SavedDevice } from "../domain/device-store";
import { assessReadiness, verdictSummary } from "../domain/remote-readiness";

const healthy: ClientPosture = {
	unattendedPasswordSet: true,
	tempPasswordEnabled: true,
	twoFactorForConnect: true,
	strangerConnectionLock: true,
	autostart: true,
	accountType: "phone",
	accountHint: "138****8000",
};

const device: SavedDevice = {
	deviceId: "111222333",
	name: "Office PC",
	lastConnectedAt: 1_700_000_000_000,
	isConnected: false,
	hasSavedCredential: true,
	hasLoginPassword: false,
	isPinned: true,
};

const base = { deviceId: "999888777", clientRunning: true, autostart: true };

describe("assessReadiness", () => {
	it("says ready when nothing is missing", () => {
		const report = assessReadiness({ ...base, posture: healthy, devices: [device] });
		expect(report.verdict).toBe("ready");
		expect(report.items).toEqual([]);
	});

	it("blocks when the client is not running or the code is unreadable", () => {
		const report = assessReadiness({ ...base, deviceId: null, clientRunning: false, posture: healthy, devices: [] });
		expect(report.verdict).toBe("blocked");
		expect(report.items.map((item) => item.code)).toEqual(["client-stopped", "no-device-code", "no-saved-devices"]);
		expect(report.items[0].fix).toBe("ToDesk.exe");
	});

	it("treats 'no unattended password and no one-time password' as blocked", () => {
		const report = assessReadiness({
			...base,
			posture: { ...healthy, unattendedPasswordSet: false, tempPasswordEnabled: false },
			devices: [device],
		});
		expect(report.verdict).toBe("blocked");
		const item = report.items.find((entry) => entry.code === "inbound-closed");
		expect(item?.state).toBe("bad");
		expect(item?.fix).toContain("-setpasswd");
	});

	it("keeps a single closed door at warn, because the other one still works", () => {
		const report = assessReadiness({ ...base, posture: { ...healthy, unattendedPasswordSet: false }, devices: [device] });
		expect(report.verdict).toBe("degraded");
		expect(report.items.map((item) => item.code)).toEqual(["unattended-password"]);
		expect(report.items[0].state).toBe("warn");
	});

	it("falls back to the posture file when -status did not report autostart", () => {
		const report = assessReadiness({ ...base, autostart: null, posture: { ...healthy, autostart: false }, devices: [device] });
		expect(report.items.map((item) => item.code)).toEqual(["autostart"]);
		expect(report.items[0].fix).toBe("ToDesk.exe -autostart on");
	});

	it("warns about the two settings that widen access", () => {
		const report = assessReadiness({
			...base,
			posture: { ...healthy, twoFactorForConnect: false, strangerConnectionLock: false },
			devices: [device],
		});
		expect(report.verdict).toBe("degraded");
		expect(report.items.map((item) => item.code)).toEqual(["no-2fa", "stranger-devices-allowed"]);
		// Every gap carries the remedy, not only the complaint (ADR 0011 §3.2).
		expect(report.items.every((item) => item.fix && item.fix.length > 0)).toBe(true);
	});

	it("says the flags are unknown instead of claiming ready when the settings are unreadable", () => {
		const report = assessReadiness({ ...base, posture: null, devices: [device] });
		expect(report.verdict).toBe("degraded");
		expect(report.items.map((item) => item.code)).toEqual(["posture-unknown"]);
	});
});

describe("verdictSummary", () => {
	it("counts only what the user has to act on", () => {
		// -status wins over the file, so let it be silent here to exercise both fallbacks.
		const report = assessReadiness({
			...base,
			autostart: null,
			posture: { ...healthy, autostart: false, twoFactorForConnect: false },
			devices: [device],
		});
		expect(verdictSummary(report)).toContain("2 thing(s)");
		expect(verdictSummary(assessReadiness({ ...base, posture: healthy, devices: [device] }))).toContain("Reachable");
	});
});
