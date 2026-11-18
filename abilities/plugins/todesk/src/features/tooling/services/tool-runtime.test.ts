import { describe, expect, it, vi } from "vitest";
import { DISABLED, capabilityAllowed, hostFailure, readStore, verifyConnection, type ToolBridge } from "./tool-runtime";

function bridge(overrides: Partial<ToolBridge> & { settings?: Record<string, unknown>; runFails?: boolean } = {}): ToolBridge {
	const settings = overrides.settings ?? {};
	return {
		readSettings: async () => settings,
		readTextFile: overrides.readTextFile ?? (async () => {
			throw new Error("ENOENT");
		}),
		listDirectory: overrides.listDirectory ?? (async () => []),
		run:
			overrides.run ??
			(vi.fn(async () => {
				if (overrides.runFails) throw new Error("Plugin todesk command disabled by user: ToDesk.exe");
				return { exitCode: 1, stdout: "ToDesk ID:123456789", stderr: "" };
			}) as unknown as ToolBridge["run"]),
	};
}

describe("capabilityAllowed", () => {
	it("lets a file-only tool through even when the host refused the command", async () => {
		const failing = bridge({ runFails: true });
		expect(await capabilityAllowed(failing, "status")).toBe(true);
		expect(await capabilityAllowed(failing, "devices")).toBe(true);
		expect(await capabilityAllowed(failing, "readiness")).toBe(true);
	});

	it("does not let a command tool through without the grant", async () => {
		expect(await capabilityAllowed(bridge({ runFails: true }), "connect")).toBe(false);
		expect(await capabilityAllowed(bridge(), "connect")).toBe(true);
	});

	it("honours an explicit per-capability false over everything else", async () => {
		const settings = { allowCommands: true, tools: { devices: false } };
		expect(await capabilityAllowed(bridge({ settings }), "devices")).toBe(false);
		// …and does not leak to its neighbours.
		expect(await capabilityAllowed(bridge({ settings }), "usage")).toBe(true);
	});

	it("honours an explicit true even when the probe would fail", async () => {
		const settings = { tools: { connect: true } };
		expect(await capabilityAllowed(bridge({ settings, runFails: true }), "connect")).toBe(true);
	});

	it("treats the panel's global switch as a veto", async () => {
		expect(await capabilityAllowed(bridge({ settings: { allowCommands: false } }), "status")).toBe(false);
	});

	it("survives settings that cannot be read", async () => {
		const broken = { ...bridge(), readSettings: async () => { throw new Error("no settings"); } } as ToolBridge;
		expect(await capabilityAllowed(broken, "devices")).toBe(true);
	});
});

describe("standard answers", () => {
	it("names the panel switch that turned the capability off", () => {
		expect(JSON.parse(DISABLED)).toMatchObject({ ok: false, reason: expect.stringContaining("switched off") });
	});

	it("passes the host's own text through, never a rewritten reason", () => {
		const payload = JSON.parse(hostFailure({ error: "Plugin todesk command disabled by user: ToDesk.exe" }, ["-control"]));
		expect(payload.host_error).toBe("Plugin todesk command disabled by user: ToDesk.exe");
		expect(payload.command).toBe("ToDesk.exe -control");
	});
});

describe("readStore", () => {
	it("returns an error instead of throwing when no profile has a store", async () => {
		const store = await readStore(bridge());
		expect(store.devices).toEqual([]);
		expect(store.error).toContain("no ToDesk data directory");
	});
});

describe("verifyConnection", () => {
	const row = (lastConnectedAt: number | null, isConnected = false) => ({
		UserID: "",
		deviceId: "111222333",
		name: "Office PC",
		lastConnectedAt,
		isConnected,
		hasSavedCredential: true,
		hasLoginPassword: false,
		isPinned: false,
	});

	it("says unknown when there is no row to compare against", async () => {
		expect(await verifyConnection(bridge(), "111222333", null)).toBe("unknown");
	});

	it("says unknown when the store cannot be read", async () => {
		expect(await verifyConnection(bridge(), "111222333", { lastConnectedAt: 1, isConnected: false })).toBe("unknown");
	});
});
