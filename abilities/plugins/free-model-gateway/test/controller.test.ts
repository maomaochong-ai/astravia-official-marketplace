import type { PluginContext, PluginServiceStatus } from "@astravia-org/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayController } from "../src/controller";
import { PROVIDER_ID, SERVICE_ID } from "../src/service-adapter";
import { GATEWAY_SETTINGS_PATH } from "../src/settings";

const CONNECTION_BASE_URL = "http://127.0.0.1:18900";
const FORWARD_KEY = "fk-real";

interface Fakes {
	files: Map<string, string>;
	status: PluginServiceStatus;
	statusListeners: Set<(status: PluginServiceStatus) => void>;
	installs: Array<{ serviceId: string; artifacts: Array<{ destination: string; data: string }> }>;
	installError?: Error;
	startCalls: number;
	startError?: Error;
	stopCalls: number;
	stopError?: Error;
	events: string[];
	requests: Array<{ path: string; headers?: Record<string, string> }>;
	modelsBody: unknown;
	modelsOk: boolean;
	dataFile: string | null;
	ownedProviders: Record<string, unknown>;
	replaced: Array<Record<string, unknown>>;
	notifies: Array<{ message: string; error?: Error }>;
	opened: string[];
}

function serviceStatus(overrides: Partial<PluginServiceStatus> = {}): PluginServiceStatus {
	return {
		serviceId: SERVICE_ID,
		phase: "stopped",
		installed: true,
		version: "2.1.0",
		recentOutput: "",
		...overrides,
	};
}

function makeFakes(overrides: Partial<Fakes> = {}): Fakes {
	return {
		files: new Map<string, string>(),
		status: serviceStatus(),
		statusListeners: new Set(),
		installs: [],
		startCalls: 0,
		stopCalls: 0,
		events: [],
		requests: [],
		modelsBody: { object: "list", data: [{ id: "m1" }, { id: "m2" }] },
		modelsOk: true,
		dataFile: JSON.stringify({ forwardKey: FORWARD_KEY, standalonePort: 18900 }),
		ownedProviders: {},
		replaced: [],
		notifies: [],
		opened: [],
		...overrides,
	};
}

function emit(fakes: Fakes): void {
	for (const listener of fakes.statusListeners) listener(fakes.status);
}

function makeCtx(fakes: Fakes): PluginContext {
	return {
		plugin: { id: "free-model-gateway", version: "0.2.0" },
		storage: {
			readFile: async (path: string) => fakes.files.get(path) ?? null,
			writeFile: async (path: string, data: string) => {
				fakes.files.set(path, data);
				return { revision: "r1", changedPaths: [path] };
			},
		},
		services: {
			getStatus: async () => fakes.status,
			install: async (serviceId: string, artifacts: Array<{ destination: string; data: string }>) => {
				if (fakes.installError) throw fakes.installError;
				fakes.events.push("install");
				fakes.installs.push({ serviceId, artifacts });
				fakes.status = { ...fakes.status, phase: "stopped", installed: true };
				return fakes.status;
			},
			start: async () => {
				if (fakes.startError) throw fakes.startError;
				fakes.startCalls += 1;
				fakes.events.push("start");
				fakes.status = { ...fakes.status, phase: "ready" };
				emit(fakes);
				return fakes.status;
			},
			stop: async () => {
				if (fakes.stopError) throw fakes.stopError;
				fakes.stopCalls += 1;
				fakes.events.push("stop");
				fakes.status = { ...fakes.status, phase: "stopped" };
				emit(fakes);
				return fakes.status;
			},
			connection: async () => ({ baseUrl: CONNECTION_BASE_URL }),
			request: async (_serviceId: string, request: { path: string; headers?: Record<string, string> }) => {
				fakes.requests.push({ path: request.path, headers: request.headers });
				return {
					ok: fakes.modelsOk,
					status: fakes.modelsOk ? 200 : 500,
					statusText: fakes.modelsOk ? "OK" : "Internal Server Error",
					headers: {},
					body: fakes.modelsBody,
				};
			},
			readDataFile: async () => fakes.dataFile,
			onStatusChange: (listener: (status: PluginServiceStatus) => void) => {
				fakes.statusListeners.add(listener);
				return { dispose: () => fakes.statusListeners.delete(listener) };
			},
		},
		models: {
			listOwnedProviders: async () => fakes.ownedProviders,
			replaceOwnedProviders: async (providers: Record<string, unknown>) => {
				fakes.replaced.push(providers);
			},
		},
		ui: {
			notify: async (options: { message: string; error?: Error }) => {
				fakes.notifies.push({ message: options.message, error: options.error });
			},
			openExternal: async (url: string) => {
				fakes.opened.push(url);
			},
		},
		i18n: { t: (key: string) => key },
	} as unknown as PluginContext;
}

describe("GatewayController", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it("loads persisted settings and subscribes to host service status on activate", async () => {
		const fakes = makeFakes();
		fakes.files.set(GATEWAY_SETTINGS_PATH, JSON.stringify({ autoStart: false }));
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureLoaded();

		expect(fakes.statusListeners.size).toBe(1);
		expect(controller.getSettings()).toEqual({ autoStart: false });
	});

	it("auto-starts on activate when the setting is on (the default)", async () => {
		const fakes = makeFakes();
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureLoaded();
		await vi.waitFor(() => expect(fakes.startCalls).toBe(1));
		await vi.waitFor(() => expect(controller.getState().phase).toBe("running"));
	});

	it("does not auto-start when the user turned the setting off", async () => {
		const fakes = makeFakes();
		fakes.files.set(GATEWAY_SETTINGS_PATH, JSON.stringify({ autoStart: false }));
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureLoaded();
		await Promise.resolve();

		expect(fakes.startCalls).toBe(0);
		expect(controller.getState().phase).toBe("idle");
	});

	it("reflects an already-ready host service without starting it again", async () => {
		const fakes = makeFakes({ status: serviceStatus({ phase: "ready" }) });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureLoaded();
		await Promise.resolve();

		expect(fakes.startCalls).toBe(0);
		expect(controller.getState().phase).toBe("running");
	});

	it("re-syncs models on activate when the service is already ready (host may have restarted on a new port)", async () => {
		const fakes = makeFakes({ status: serviceStatus({ phase: "ready" }) });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureLoaded();
		await vi.waitFor(() => expect(fakes.replaced.length).toBe(1));

		const provider = fakes.replaced[0]?.["free-model"] as {
			baseUrl?: string;
			apiKey?: string;
			models?: Array<{ id: string }>;
		};
		expect(provider.baseUrl).toBe(`${CONNECTION_BASE_URL}/v1`);
		expect(provider.apiKey).toBe(FORWARD_KEY);
		expect(provider.models?.map((m) => m.id)).toEqual(["m1", "m2"]);
		expect(controller.getState().modelCount).toBe(2);
	});

	it("surfaces a failed host service as an error phase", async () => {
		const fakes = makeFakes({
			status: serviceStatus({ phase: "failed", message: "boom" }),
		});
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureLoaded();

		expect(controller.getState().phase).toBe("error");
		expect(controller.getState().messageKey).toBe("error.serviceFailed");
	});

	it("installs the bundled server archive before the first start", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
		}));
		vi.stubGlobal("fetch", fetchMock);
		const fakes = makeFakes({
			status: serviceStatus({ installed: false }),
		});
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();
		await vi.waitFor(() => expect(controller.getState().phase).toBe("running"));

		expect(fetchMock).toHaveBeenCalledWith(
			"astravia-plugin://free-model-gateway/versions/0.2.0/dist/ofm-server.zip",
		);
		expect(fakes.installs).toEqual([
			{ serviceId: SERVICE_ID, artifacts: [{ destination: "server", data: "AQID" }] },
		]);
		expect(fakes.startCalls).toBe(1);
		expect(fakes.events).toEqual(["stop", "install", "start"]);
	});

	// 升级时宿主把状态降回 stopped，但旧子进程仍挂在启主记录上；此时直接 install 会报
	// “Stop the service before installing its runtime”。install 前无条件 stop 才能清掉它。
	it("stops the stale instance before installing a runtime that reports itself as stopped", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1]).buffer })),
		);
		const fakes = makeFakes({ status: serviceStatus({ phase: "stopped", installed: false }) });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();

		expect(fakes.events.slice(0, 2)).toEqual(["stop", "install"]);
		expect(fakes.stopCalls).toBe(1);
		expect(controller.getState().phase).toBe("running");
	});

	it("reports an install failure and notifies with the underlying error", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(1) })));
		const fakes = makeFakes({
			status: serviceStatus({ installed: false }),
			installError: new Error("disk full"),
		});
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();

		expect(controller.getState().phase).toBe("error");
		expect(controller.getState().messageKey).toBe("error.installFailed");
		expect(fakes.notifies[0]?.error?.message).toBe("disk full");
		expect(fakes.startCalls).toBe(0);
	});

	it("reports a start failure without leaving the view busy", async () => {
		const fakes = makeFakes({ startError: new Error("node missing") });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();

		expect(controller.getState().phase).toBe("error");
		expect(controller.getState().messageKey).toBe("error.installFailed");
		expect(controller.getState().busy).toBe(false);
	});

	it("starts once when ensureRunning is called concurrently", async () => {
		const fakes = makeFakes();
		const controller = new GatewayController(makeCtx(fakes));

		await Promise.all([controller.ensureRunning(), controller.ensureRunning()]);

		expect(fakes.startCalls).toBe(1);
	});

	it("syncs the model list into the owned provider once the service is ready", async () => {
		const fakes = makeFakes();
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();
		await vi.waitFor(() => expect(controller.getState().modelCount).toBe(2));

		const state = controller.getState();
		expect(state.phase).toBe("running");
		expect(state.baseUrl).toBe(CONNECTION_BASE_URL);
		expect(state.syncedAt).toBeTypeOf("number");
		expect(fakes.requests[0]?.path).toBe("/v1/models");
		expect(fakes.requests[0]?.headers?.authorization).toBe(`Bearer ${FORWARD_KEY}`);
		expect(fakes.replaced[0]?.[PROVIDER_ID]).toMatchObject({
			baseUrl: `${CONNECTION_BASE_URL}/v1`,
			apiKey: FORWARD_KEY,
			api: "openai-completions",
			models: [{ id: "m1", api: "openai-completions" }, { id: "m2", api: "openai-completions" }],
		});
	});

	it("keeps a user-renamed provider display name across syncs", async () => {
		const fakes = makeFakes({ ownedProviders: { [PROVIDER_ID]: { displayName: "My models" } } });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();
		await vi.waitFor(() => expect(fakes.replaced.length).toBe(1));

		expect(fakes.replaced[0]?.[PROVIDER_ID]).toMatchObject({ displayName: "My models" });
	});

	it("surfaces a missing forward key instead of writing a broken provider", async () => {
		const fakes = makeFakes({ dataFile: null });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();
		await vi.waitFor(() => expect(controller.getState().messageKey).toBe("error.noForwardKey"));

		expect(fakes.replaced).toEqual([]);
	});

	it("reports a failed model request and writes nothing", async () => {
		const fakes = makeFakes({ modelsOk: false });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();
		await vi.waitFor(() => expect(controller.getState().messageKey).toBe("error.syncFailed"));

		expect(fakes.replaced).toEqual([]);
	});

	it("never wipes the registry when the upstream returns no models", async () => {
		const fakes = makeFakes({ modelsBody: { object: "list", data: [] } });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.ensureRunning();
		await vi.waitFor(() => expect(controller.getState().messageKey).toBe("error.emptyModels"));

		expect(controller.getState().phase).toBe("running");
		expect(controller.getState().modelCount).toBeUndefined();
		expect(fakes.replaced).toEqual([]);
	});

	it("stops the service and returns to idle", async () => {
		const fakes = makeFakes();
		const controller = new GatewayController(makeCtx(fakes));
		await controller.ensureRunning();
		await vi.waitFor(() => expect(controller.getState().phase).toBe("running"));

		await controller.stop();

		expect(fakes.stopCalls).toBe(1);
		expect(controller.getState().phase).toBe("idle");
		expect(controller.getState().busy).toBe(false);
	});

	it("reports a stop failure", async () => {
		const fakes = makeFakes({ stopError: new Error("nope") });
		const controller = new GatewayController(makeCtx(fakes));

		await controller.stop();

		expect(controller.getState().phase).toBe("error");
		expect(controller.getState().messageKey).toBe("error.stopFailed");
		expect(fakes.notifies.length).toBe(1);
	});

	it("opens the management UI on the live service origin", async () => {
		const fakes = makeFakes();
		const controller = new GatewayController(makeCtx(fakes));
		await controller.ensureRunning();

		await controller.openManagement();

		expect(fakes.opened).toEqual([`${CONNECTION_BASE_URL}/`]);
	});

	it("passes the host's recent output through", async () => {
		const fakes = makeFakes({
			status: serviceStatus({ phase: "ready", recentOutput: "banner" }),
		});
		const controller = new GatewayController(makeCtx(fakes));

		expect(await controller.recentOutput()).toBe("banner");
	});

	it("maps phases onto the sidebar badge", async () => {
		const fakes = makeFakes();
		const controller = new GatewayController(makeCtx(fakes));
		expect(controller.navBadge()).toBeNull();

		await controller.ensureLoaded();
		await vi.waitFor(() => expect(controller.navBadge()).toEqual({ kind: "accent" }));

		fakes.status = { ...fakes.status, phase: "failed" };
		emit(fakes);
		await vi.waitFor(() => expect(controller.navBadge()).toEqual({ kind: "danger" }));
	});

	it("persists settings updates and drops subscribers on dispose", async () => {
		const fakes = makeFakes();
		fakes.files.set(GATEWAY_SETTINGS_PATH, JSON.stringify({ autoStart: false }));
		const controller = new GatewayController(makeCtx(fakes));
		await controller.ensureLoaded();
		const seen: string[] = [];
		controller.subscribe((state) => seen.push(state.phase));

		await controller.updateSettings({ autoStart: false });
		await controller.dispose();
		fakes.status = { ...fakes.status, phase: "failed" };
		emit(fakes);
		await Promise.resolve();

		expect(controller.getSettings()).toEqual({ autoStart: false });
		expect(JSON.parse(fakes.files.get(GATEWAY_SETTINGS_PATH) ?? "{}")).toEqual({ autoStart: false });
		expect(fakes.statusListeners.size).toBe(0);
		expect(seen).toEqual([]);
	});
});
