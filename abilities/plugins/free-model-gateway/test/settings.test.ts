import type { PluginStorageApi } from "@astravia-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import {
	DEFAULT_GATEWAY_SETTINGS,
	GATEWAY_SETTINGS_PATH,
	isGatewaySettings,
	loadGatewaySettings,
	normalizeGatewaySettings,
	saveGatewaySettings,
} from "../src/settings";

function storageWith(files: Map<string, string>): PluginStorageApi {
	return {
		readFile: vi.fn(async (path: string) => files.get(path) ?? null),
		writeFile: vi.fn(async (path: string, data: string) => {
			files.set(path, data);
			return { revision: "r1", changedPaths: [path] };
		}),
	} as unknown as PluginStorageApi;
}

describe("gateway settings", () => {
	it("defaults to autoStart on — install means ready to use", () => {
		expect(DEFAULT_GATEWAY_SETTINGS).toEqual({ autoStart: true });
		expect(GATEWAY_SETTINGS_PATH).toBe("settings.json");
	});

	it("normalizes fail-closed: only an explicit true enables autoStart", () => {
		expect(normalizeGatewaySettings(undefined)).toEqual({ autoStart: true });
		expect(normalizeGatewaySettings(null)).toEqual({ autoStart: true });
		expect(normalizeGatewaySettings("nope")).toEqual({ autoStart: true });
		expect(normalizeGatewaySettings({})).toEqual({ autoStart: false });
		expect(normalizeGatewaySettings({ autoStart: "yes" })).toEqual({ autoStart: false });
		expect(normalizeGatewaySettings({ autoStart: true })).toEqual({ autoStart: true });
		expect(normalizeGatewaySettings({ autoStart: false })).toEqual({ autoStart: false });
	});

	it("recognizes a well-formed settings object", () => {
		expect(isGatewaySettings({ autoStart: true })).toBe(true);
		expect(isGatewaySettings({ autoStart: "true" })).toBe(false);
		expect(isGatewaySettings(null)).toBe(false);
	});

	it("loads persisted settings and falls back to defaults on a missing file", async () => {
		const files = new Map<string, string>();
		files.set(GATEWAY_SETTINGS_PATH, JSON.stringify({ autoStart: false }));
		expect(await loadGatewaySettings(storageWith(files))).toEqual({ autoStart: false });
		expect(await loadGatewaySettings(storageWith(new Map()))).toEqual(DEFAULT_GATEWAY_SETTINGS);
	});

	it("survives malformed JSON without blocking the view", async () => {
		const files = new Map<string, string>();
		files.set(GATEWAY_SETTINGS_PATH, "{not json");
		expect(await loadGatewaySettings(storageWith(files))).toEqual(DEFAULT_GATEWAY_SETTINGS);
	});

	it("writes the settings as JSON under the plugin storage namespace", async () => {
		const files = new Map<string, string>();
		await saveGatewaySettings(storageWith(files), { autoStart: false });
		expect(JSON.parse(files.get(GATEWAY_SETTINGS_PATH) ?? "{}")).toEqual({ autoStart: false });
	});
});
