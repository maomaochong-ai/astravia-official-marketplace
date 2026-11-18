import { describe, expect, it } from "vitest";
import { ACCESS_FIX } from "../features/tooling/copy/access-fixes";
import { maskAccount, parsePosture, postureFindings } from "./client-posture";

const SECRET = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";
const config = [
	"[Setting]",
	`authPassEx=${SECRET}`,
	"isOpenTempPass=1",
	"TfaForConn=0",
	"isStrangeConnectionLock=0",
	"autoStart=0",
	"LoginType=2",
	"LoginPhone=13800138000",
	"clientId=111222333",
	"Version=1.2.3",
].join("\r\n");

describe("parsePosture", () => {
	it("reads the access flags off the client's settings", () => {
		expect(parsePosture(config)).toEqual({
			unattendedPasswordSet: true,
			tempPasswordEnabled: true,
			twoFactorForConnect: false,
			strangerConnectionLock: false,
			autostart: false,
			accountType: "phone",
			accountHint: "138****8000",
		});
	});

	it("never returns a password or a token value, only whether one is set", () => {
		const posture = parsePosture(config);
		const text = JSON.stringify(posture);
		expect(text).not.toContain(SECRET);
		expect(text).not.toContain("13800138000");
	});

	it("distinguishes 'absent' from 'off'", () => {
		const posture = parsePosture("clientId=111222333");
		expect(posture?.unattendedPasswordSet).toBeNull();
		expect(parsePosture("clientId=111222333\r\nauthPassEx=")?.unattendedPasswordSet).toBe(false);
	});

	it("returns null when the file is not a ToDesk settings dump", () => {
		expect(parsePosture("[InternetShortcut]\r\nURL=https://example.com")).toBeNull();
	});
});

describe("maskAccount", () => {
	it("masks a phone number and an e-mail differently", () => {
		expect(maskAccount("13800138000", "phone")).toBe("138****8000");
		expect(maskAccount("alice@example.com", "email")).toBe("a***@example.com");
		expect(maskAccount("", "unknown")).toBeNull();
	});
});

describe("postureFindings", () => {
	it("names the gaps that actually stop a connection", () => {
		const findings = postureFindings({
			unattendedPasswordSet: false,
			tempPasswordEnabled: false,
			twoFactorForConnect: false,
			strangerConnectionLock: false,
			autostart: false,
			accountType: "phone",
			accountHint: null,
		}, ACCESS_FIX);
		expect(findings.map((f) => f.code)).toEqual([
			"no-unattended-password",
			"temp-password-off",
			"no-2fa",
			"stranger-connection-allowed",
			"no-autostart",
		]);
		expect(findings.filter((f) => f.severity === "warn")).toHaveLength(3);
	});

	it("says so when nothing is wrong", () => {
		const findings = postureFindings({
			unattendedPasswordSet: true,
			tempPasswordEnabled: true,
			twoFactorForConnect: true,
			strangerConnectionLock: true,
			autostart: true,
			accountType: "email",
			accountHint: "a***@example.com",
		}, ACCESS_FIX);
		expect(findings).toHaveLength(1);
		expect(findings[0].code).toBe("locked-down");
	});
});
