import type { PluginModelProviderConfig, PluginServiceStatus } from "@astravia-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import {
	API_KIND,
	ARTIFACT_DESTINATION,
	baseUrlForProvider,
	buildProviderConfig,
	computeProviderSnapshot,
	parseForwardKey,
	parseModelRows,
	phaseFromServiceStatus,
	PROVIDER_DISPLAY_NAME,
	PROVIDER_ID,
	reconcileProviders,
	SERVER_ZIP_PATH,
	SERVICE_ID,
	toModelDefinitions,
} from "../src/service-adapter";

function provider(overrides: Partial<PluginModelProviderConfig> = {}): PluginModelProviderConfig {
	return {
		baseUrl: "http://127.0.0.1:18900/v1",
		apiKey: "key-1",
		api: API_KIND,
		displayName: PROVIDER_DISPLAY_NAME,
		models: [{ id: "m1", api: API_KIND }],
		...overrides,
	};
}

describe("service-adapter constants", () => {
	it("pins the manifest-bound identifiers", () => {
		expect(SERVICE_ID).toBe("ofm-gateway");
		expect(ARTIFACT_DESTINATION).toBe("server");
		expect(SERVER_ZIP_PATH).toBe("dist/ofm-server.zip");
		expect(PROVIDER_ID).toBe("free-model");
		expect(API_KIND).toBe("openai-completions");
	});
});

describe("parseModelRows", () => {
	it("parses the OpenAI model list shape and sorts by id", () => {
		const rows = parseModelRows({
			object: "list",
			data: [
				{ id: "z-model", object: "model", owned_by: "our-free-model" },
				{ id: "a-model", object: "model", context_window: 128000 },
			],
		});
		expect(rows.map((row) => row.id)).toEqual(["a-model", "z-model"]);
		expect(rows[0]?.contextWindow).toBe(128000);
		expect(rows[1]?.contextWindow).toBeUndefined();
	});

	it("drops rows without a usable id", () => {
		const rows = parseModelRows({ data: [{ id: "" }, { id: 42 }, null, "x", { id: "keep" }] });
		expect(rows.map((row) => row.id)).toEqual(["keep"]);
	});

	it("ignores a non-numeric context_window", () => {
		const rows = parseModelRows({ data: [{ id: "m", context_window: "128000" }] });
		expect(rows[0]?.contextWindow).toBeUndefined();
	});

	it("fails closed on unexpected bodies", () => {
		expect(parseModelRows(null)).toEqual([]);
		expect(parseModelRows({})).toEqual([]);
		expect(parseModelRows({ data: "nope" })).toEqual([]);
	});
});

describe("toModelDefinitions", () => {
	it("maps rows to definitions and omits an unknown context window", () => {
		expect(toModelDefinitions([{ id: "m1", contextWindow: 32000 }, { id: "m2" }])).toEqual([
			{ id: "m1", api: API_KIND, contextWindow: 32000 },
			{ id: "m2", api: API_KIND },
		]);
	});
});

describe("baseUrlForProvider", () => {
	it("appends /v1 and tolerates a trailing slash", () => {
		expect(baseUrlForProvider("http://127.0.0.1:18900")).toBe("http://127.0.0.1:18900/v1");
		expect(baseUrlForProvider("http://127.0.0.1:18900/")).toBe("http://127.0.0.1:18900/v1");
	});
});

describe("buildProviderConfig", () => {
	it("carries the connection baseUrl, the real key and the model list", () => {
		const config = buildProviderConfig({
			baseUrl: "http://127.0.0.1:18900/v1",
			apiKey: "secret",
			models: [{ id: "m1", api: API_KIND }],
		});
		expect(config).toEqual({
			baseUrl: "http://127.0.0.1:18900/v1",
			apiKey: "secret",
			api: API_KIND,
			displayName: PROVIDER_DISPLAY_NAME,
			models: [{ id: "m1", api: API_KIND }],
		});
	});
});

describe("computeProviderSnapshot", () => {
	it("refuses to publish an empty model list", () => {
		expect(computeProviderSnapshot(undefined, provider({ models: [] }))).toBeNull();
	});

	it("keeps a user-renamed displayName but always takes the new credential", () => {
		const snapshot = computeProviderSnapshot(
			{ ...provider(), displayName: "My local models" },
			provider({ apiKey: "fresh-key" }),
		);
		expect(snapshot?.displayName).toBe("My local models");
		expect(snapshot?.apiKey).toBe("fresh-key");
	});

	it("falls back to the default displayName for a blank existing one", () => {
		const snapshot = computeProviderSnapshot(
			{ ...provider(), displayName: "   " },
			provider({ apiKey: "fresh-key" }),
		);
		expect(snapshot?.displayName).toBe(PROVIDER_DISPLAY_NAME);
	});
});

describe("reconcileProviders", () => {
	it("reads owned providers first, then writes the merged snapshot", async () => {
		const models = {
			listOwnedProviders: vi.fn(async () => ({ [PROVIDER_ID]: { ...provider(), apiKey: "***masked***" } })),
			replaceOwnedProviders: vi.fn(async () => undefined),
		};
		const synced = await reconcileProviders(models as never, provider({ apiKey: "real-key" }));
		expect(synced).toBe(true);
		expect(models.listOwnedProviders).toHaveBeenCalledTimes(1);
		expect(models.replaceOwnedProviders).toHaveBeenCalledWith({
			[PROVIDER_ID]: expect.objectContaining({ apiKey: "real-key", api: API_KIND }),
		});
	});

	it("returns false instead of wiping the registry when the upstream list is empty", async () => {
		const models = {
			listOwnedProviders: vi.fn(async () => ({})),
			replaceOwnedProviders: vi.fn(async () => undefined),
		};
		const synced = await reconcileProviders(models as never, provider({ models: [] }));

		expect(synced).toBe(false);
		expect(models.listOwnedProviders).not.toHaveBeenCalled();
		expect(models.replaceOwnedProviders).not.toHaveBeenCalled();
	});
});

describe("parseForwardKey", () => {
	it("reads the key the server writes on every boot", () => {
		expect(parseForwardKey(JSON.stringify({ forwardKey: "fk-1", standalonePort: 18900 }))).toBe("fk-1");
	});

	it("fails closed on missing files, bad JSON or an empty key", () => {
		expect(parseForwardKey(undefined)).toBeUndefined();
		expect(parseForwardKey(null)).toBeUndefined();
		expect(parseForwardKey("")).toBeUndefined();
		expect(parseForwardKey("{not json")).toBeUndefined();
		expect(parseForwardKey(JSON.stringify({}))).toBeUndefined();
		expect(parseForwardKey(JSON.stringify({ forwardKey: "" }))).toBeUndefined();
	});
});

describe("phaseFromServiceStatus", () => {
	it("maps every host phase onto a view phase", () => {
		const phase = (value: string) => phaseFromServiceStatus({ serviceId: SERVICE_ID, phase: value } as PluginServiceStatus);
		expect(phase("ready")).toBe("running");
		expect(phase("installing")).toBe("installing");
		expect(phase("starting")).toBe("starting");
		expect(phase("stopping")).toBe("stopping");
		expect(phase("failed")).toBe("error");
		expect(phase("stopped")).toBe("idle");
		expect(phase("disabled")).toBe("idle");
	});
});
