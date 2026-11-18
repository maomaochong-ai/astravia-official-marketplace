import { describe, expect, it } from "vitest";
import { CONFIG_CANDIDATES, parseTodeskConfig } from "./todesk-config";

const REAL = `[ConfigInfo]
passUpdate=3
downloadtimes=202611181
clientId=123456789
PrivateData=9969aa
Version=4.8.8.4
Resolution=3840x2160
Token=1ab33e67778aaae3a29d47589b5916fe
authPassEx=9d3ef02f
tempAuthPassEx=c397986c
`;

describe("parseTodeskConfig", () => {
	it("reads the device code and version out of the real file shape", () => {
		expect(parseTodeskConfig(REAL)).toEqual({ clientId: "123456789", version: "4.8.8.4" });
	});

	it("returns nothing but the two public fields", () => {
		const parsed = parseTodeskConfig(REAL);
		expect(Object.keys(parsed ?? {}).sort()).toEqual(["clientId", "version"]);
	});

	it("handles CRLF and lower-case keys", () => {
		const text = "[ConfigInfo]\r\nclientid=123456789\r\nversion=4.8.8.4\r\n";
		expect(parseTodeskConfig(text)).toEqual({ clientId: "123456789", version: "4.8.8.4" });
	});

	it("rejects a non-numeric device code", () => {
		expect(parseTodeskConfig("clientId=abc123\nversion=4.8.8.4")).toBeNull();
	});

	it("returns null when no device code is present", () => {
		expect(parseTodeskConfig("[ConfigInfo]\nVersion=4.8.8.4\n")).toBeNull();
	});

	it("keeps the device code when the version is missing", () => {
		expect(parseTodeskConfig("clientId=987654321")).toEqual({ clientId: "987654321", version: null });
	});

	it("tries the standard Windows install locations first", () => {
		expect(CONFIG_CANDIDATES[0]).toBe("C:\\Program Files\\ToDesk\\config.ini");
	});
});
