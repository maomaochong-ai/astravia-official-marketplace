import { describe, expect, it } from "vitest";
import { describeDevice, matchDevice, mergeDeviceLists, parseDeviceList } from "../domain/device-store";

const A = {
	UserId: "111222333",
	UserName: "Office PC",
	RecentConnectTime: "1700000000000",
	IsConnected: "1",
	PassEx: "aabbccddeeff00112233",
	HostLogonPass: "secret",
	IsPinned: "1",
	ScreenId: "1",
	ScreenMode: "0",
	Width: "2560",
	Height: "1440",
	Quality: "5",
	Fps: "60",
	HD: "1",
};
const B = { UserId: "444555666", UserName: "Laptop", RecentConnectTime: "1600000000000", IsConnected: "0", PassEx: "", HostLogonPass: "" };

const store = (devices: unknown[]): string => `\uFEFF${JSON.stringify({ DeviceInfo: devices })}`;

describe("parseDeviceList", () => {
	it("reads the client's device list and keeps the order-independent facts", () => {
		const [first] = parseDeviceList(store([A, B]));
		expect(first).toEqual({
			deviceId: "111222333",
			name: "Office PC",
			lastConnectedAt: 1700000000000,
			isConnected: true,
			hasSavedCredential: true,
			hasLoginPassword: true,
			isPinned: true,
			profile: { screen: "1", screenMode: "0", resolution: { width: 2560, height: 1440 }, quality: 5, fps: 60, hd: true },
		});
	});

	it("reports whether a credential exists but never carries its value", () => {
		const [first] = parseDeviceList(store([A]));
		expect(JSON.stringify(first)).not.toContain("aabbccddeeff00112233");
		expect(JSON.stringify(first)).not.toContain("secret");
		expect(parseDeviceList(store([B]))[0].hasSavedCredential).toBe(false);
	});

	it("skips entries without a device code and survives broken JSON", () => {
		expect(parseDeviceList(store([{ UserName: "no id" }, A]))).toHaveLength(1);
		expect(parseDeviceList("not json")).toEqual([]);
		expect(parseDeviceList(JSON.stringify({ DeviceInfo: "nope" }))).toEqual([]);
	});

	it("falls back to the code when the device has no name", () => {
		expect(parseDeviceList(store([{ ...A, UserName: "" }]))[0].name).toBe("111222333");
	});

	it("reports the last session profile the client saved, without inventing one", () => {
		const withProfile = parseDeviceList(store([A]))[0];
		const withoutProfile = parseDeviceList(store([B]))[0];
		expect(withProfile.profile).toEqual({
			screen: "1",
			screenMode: "0",
			resolution: { width: 2560, height: 1440 },
			quality: 5,
			fps: 60,
			hd: true,
		});
		expect(withoutProfile.profile).toBeNull();
	});

	it("does not turn the client's -1 resolution marker into a size", () => {
		const [device] = parseDeviceList(store([{ ...A, Width: "-1", Height: "-1" }]));
		expect(device.profile?.resolution).toBeNull();
		expect(device.profile?.quality).toBe(5);
	});

});

describe("mergeDeviceLists", () => {
	it("sorts the client's pins above recency, which is the order the user already chose", () => {
		const unpinnedNewer = parseDeviceList(store([{ ...A, IsPinned: "0", RecentConnectTime: "1900000000000" }]));
		const pinnedOlder = parseDeviceList(store([{ ...B, IsPinned: "1", RecentConnectTime: "1500000000000" }]));
		const merged = mergeDeviceLists([unpinnedNewer, pinnedOlder]);
		expect(merged.map((d) => d.deviceId)).toEqual(["444555666", "111222333"]);
	});

	it("keeps one row per device, newest connect wins, flags are unioned", () => {
		const older = parseDeviceList(store([{ ...A, PassEx: "" }]));
		const newer = parseDeviceList(store([{ ...A, RecentConnectTime: "1800000000000" }, B]));
		const merged = mergeDeviceLists([older, newer]);

		expect(merged.map((d) => d.deviceId)).toEqual(["111222333", "444555666"]);
		expect(merged[0].lastConnectedAt).toBe(1800000000000);
		expect(merged[0].hasSavedCredential).toBe(true);
	});
});

describe("matchDevice", () => {
	const devices = parseDeviceList(store([A, B, { ...B, UserId: "777888999", UserName: "Laptop (backup)" }]));

	it("resolves a typed code with spaces", () => {
		expect(matchDevice(devices, "111 222 333")).toMatchObject({ kind: "one", device: { deviceId: "111222333" } });
	});

	it("resolves an exact name case-insensitively", () => {
		expect(matchDevice(devices, "office pc")).toMatchObject({ kind: "one", device: { deviceId: "111222333" } });
	});

	it("returns every candidate for an ambiguous name instead of picking one", () => {
		const match = matchDevice(devices, "lapt");
		expect(match.kind).toBe("many");
		if (match.kind === "many") expect(match.devices.map((d) => d.deviceId).sort()).toEqual(["444555666", "777888999"]);
	});

	it("answers none for a name nobody saved", () => {
		expect(matchDevice(devices, "workstation").kind).toBe("none");
		expect(matchDevice(devices, "   ").kind).toBe("none");
	});
});

describe("describeDevice", () => {
	it("publishes the last session profile under last_session", () => {
		const described = describeDevice(parseDeviceList(store([A]))[0]);
		expect(described.last_session).toMatchObject({ screen: "1", resolution: { width: 2560, height: 1440 }, fps: 60 });
		expect(describeDevice(parseDeviceList(store([B]))[0]).last_session).toBeNull();
	});

	it("publishes ISO time and no credential keys", () => {
		const [device] = parseDeviceList(store([A]));
		const described = describeDevice(device);
		expect(described.last_connected_at).toBe(new Date(1700000000000).toISOString());
		expect(Object.keys(described)).not.toContain("PassEx");
		expect(JSON.stringify(described)).not.toContain("aabbccddeeff00112233");
	});
});
