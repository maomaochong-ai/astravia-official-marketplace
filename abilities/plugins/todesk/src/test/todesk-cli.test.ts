import { describe, expect, it } from "vitest";
import {
	buildConnectUrl,
	buildControlArgs,
	cleanCliOutput,
	normalizeDeviceId,
	parseGetId,
	parseStatus,
	parseVersion,
} from "../domain/todesk-cli";

// Verbatim output of `ToDesk.exe -version|-getid|-status` on 4.8.8.4, including the
// libusb noise and the success-with-exit-1 behaviour the parsers have to survive.
const VERSION = `[libusb] Info: Windows OS Build Number: 26300 (Version 10.0)
[libusb] Info: Successfully loaded UsbRSrcCore.dll and got function addresses
[libusb] Info: Windows OS Build Number: 26300 (Version 10.0)
[libusb] Info: Successfully loaded UsbRDstCore.dll and got UsbDestinationGetVhciDosPath address
ToDesk 4.8.8.4 for windows[libusb] Info: Unloaded UsbRDstCore.dll
[libusb] Info: Unloaded UsbRSrcCore.dll`;

const GETID = `[libusb] Info: Windows OS Build Number: 26300 (Version 10.0)
[libusb] Info: Successfully loaded UsbRSrcCore.dll and got function addresses
123456789[libusb] Info: Unloaded UsbRDstCore.dll`;

const STATUS = `[libusb] Info: Windows OS Build Number: 26300 (Version 10.0)
ToDesk ID:123456789
ToDesk 4.8.8.4 for windows
Start ToDesk with Windows: ON
PID:7332   C:\\Program Files\\ToDesk\\ToDesk.exe
PID:5140   C:\\Program Files\\ToDesk\\ToDesk.exe
Server:authds.todesk.com  Port:443
Uptime:2026-11-18 00:59:59
[libusb] Info: Unloaded UsbRSrcCore.dll`;

describe("cleanCliOutput", () => {
	it("drops libusb noise and blank lines", () => {
		const lines = cleanCliOutput(VERSION);
		expect(lines.every((line) => !line.startsWith("[libusb]"))).toBe(true);
		expect(lines[0]).toContain("ToDesk 4.8.8.4");
	});
});

describe("parseVersion / parseGetId", () => {
	it("reads the version banner", () => {
		expect(parseVersion(VERSION)).toEqual({ version: "4.8.8.4", platform: "windows" });
	});

	it("reads the device code glued to a noise suffix", () => {
		expect(parseGetId(GETID)).toBe("123456789");
	});

	it("returns null when the code is not nine digits", () => {
		expect(parseGetId("12345")).toBeNull();
		expect(parseGetId("ToDesk ID: 12")).toBeNull();
	});
});

describe("normalizeDeviceId", () => {
	it("accepts the spaced form people read off the screen", () => {
		expect(normalizeDeviceId("123 456 789")).toBe("123456789");
	});

	it("rejects anything else", () => {
		expect(normalizeDeviceId("1234567896")).toBeNull();
		expect(normalizeDeviceId("20585032a")).toBeNull();
	});
});

describe("parseStatus", () => {
	it("reads identity, autostart and the running flag from -status", () => {
		expect(parseStatus(STATUS)).toEqual({
			deviceId: "123456789",
			version: "4.8.8.4",
			platform: "windows",
			autostart: true,
			running: true,
			server: "authds.todesk.com:443",
			uptime: "2026-11-18 00:59:59",
		});
	});

	it("reports OFF as false rather than unknown", () => {
		expect(parseStatus("Start ToDesk with Windows: OFF").autostart).toBe(false);
	});

	it("leaves autostart unknown when the line is absent", () => {
		const status = parseStatus("ToDesk ID:123456789\nToDesk 4.8.8.4 for windows");
		expect(status.autostart).toBeNull();
		expect(status.running).toBe(false);
	});
});

describe("command construction", () => {
	it("builds the documented control command", () => {
		expect(buildControlArgs("123 456 789", "a12345")).toEqual([
			"-control",
			"-id",
			"123456789",
			"-passwd",
			"a12345",
		]);
	});

	it("omits the password flag when none was typed", () => {
		expect(buildControlArgs("123456789", "")).toEqual(["-control", "-id", "123456789"]);
	});

	it("refuses a malformed device code instead of spawning a bad process", () => {
		expect(buildControlArgs("abc", "x")).toBeNull();
	});

	it("builds the browser-style connect URL the help center documents", () => {
		expect(buildConnectUrl("123456789", "a12345")).toBe("ToDesk://connect&123456789&a12345");
	});
});
