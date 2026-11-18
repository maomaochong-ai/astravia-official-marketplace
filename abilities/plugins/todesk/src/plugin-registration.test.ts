import { describe, expect, it, vi } from "vitest";
import { INPUT_ACTION_ID, registerTodeskPlugin, TAB_ID, VIEW_ID } from "./plugin-registration";
import type { ConsoleDeps, RunResult } from "./runtime-contract";

const STATUS_OUT = `[libusb] Info: noise
ToDesk ID:123456789
ToDesk 4.8.8.4 for windows
Start ToDesk with Windows: ON
PID:7332   C:\\Program Files\\ToDesk\\ToDesk.exe
Server:authds.todesk.com  Port:443`;

function fakeCtx(options: { settings?: Record<string, unknown>; failRun?: boolean } = {}) {
	const { settings = {}, failRun = false } = options;
	const registered: { id: string }[] = [];
	const runs: { file: string; args: string[]; env?: Record<string, string> }[] = [];
	const views: Record<string, unknown>[] = [];
	const actions: Record<string, unknown>[] = [];
	const opened: string[] = [];
	const prompts: { id: string }[] = [];
	const tabs: Record<string, unknown>[] = [];
	let settingsValue: Record<string, unknown> = settings;

	const ctx = {
		ui: {
			registerWorkspaceView: (contribution: Record<string, unknown>) => {
				views.push(contribution);
				return { dispose: () => undefined };
			},
			registerActivityTab: (contribution: Record<string, unknown>) => {
				tabs.push(contribution);
				return { dispose: () => undefined };
			},
			registerInputAction: (contribution: Record<string, unknown>) => {
				actions.push(contribution);
				return { dispose: () => undefined };
			},
			openActivityTab: (tabId: string) => {
				opened.push(tabId);
			},
		},
		agent: {
			registerTool: (registration: { id: string }) => {
				registered.push(registration);
				return { dispose: () => undefined };
			},
			registerSystemPromptProvider: (registration: { id: string }) => {
				prompts.push(registration);
				return { dispose: () => undefined };
			},
		},
	};

	const deps: ConsoleDeps = {
		readTextFile: async () => {
			throw new Error("ENOENT");
		},
		listDirectory: async () => [],
		readSettings: async () => settingsValue,
		writeSettings: async (value) => {
			settingsValue = value;
		},
		openExternal: async () => undefined,
		run: async (file, args, env): Promise<RunResult> => {
			runs.push({ file, args, env });
			if (failRun) throw new Error("Plugin todesk command disabled by user: ToDesk.exe");
			if (args[0] === "-status") return { exitCode: 1, stdout: STATUS_OUT, stderr: "" };
			return { exitCode: 1, stdout: "", stderr: "" };
		},
		notifyError: () => undefined,
		notify: () => undefined,
	};

	return { ctx, deps, registered, runs, views, tabs, actions, opened, prompts, settings: () => settingsValue };
}

const AnyComponent = () => null;

function toolOf(registered: { id: string }[], id: string) {
	return registered.find((tool) => tool.id === id) as unknown as {
		handler: (context: unknown) => Promise<string>;
	};
}

describe("plugin registration", () => {
	it("registers the sidebar page, a dormant panel tab, and a composer button", () => {
		const { ctx, deps, views, tabs, actions, opened } = fakeCtx();
		registerTodeskPlugin(ctx as never, deps, AnyComponent);

		expect(views.map((view) => view.id)).toEqual([VIEW_ID]);
		// Off by default: activation must not mount the console into every conversation.
		expect(tabs[0]).toMatchObject({ id: TAB_ID, initiallyVisible: false });

		// The composer's own “+” lists bottom panels, so a composer entry has to be an
		// input action; it must open the tab rather than toggle a mode.
		expect(actions.map((action) => action.id)).toEqual([INPUT_ACTION_ID]);
		const onToggle = actions[0].onToggle as () => boolean | void;
		expect(onToggle()).toBe(false);
		expect(opened).toEqual([TAB_ID]);
	});

	it("registers eleven tools and no MCP-dependent one", () => {
		const { ctx, deps, registered } = fakeCtx();
		registerTodeskPlugin(ctx as never, deps, AnyComponent);
		expect(registered.map((tool) => tool.id).sort()).toEqual([
			"todesk_account",
			"todesk_autostart",
			"todesk_connect",
			"todesk_devices",
			"todesk_disconnect",
			"todesk_open_client",
			"todesk_posture",
			"todesk_readiness",
			"todesk_status",
			"todesk_tray",
			"todesk_usage",
		]);
	});

	it("runs ToDesk.exe with the install dir on PATH", async () => {
		const { ctx, deps, registered, runs } = fakeCtx();
		registerTodeskPlugin(ctx as never, deps, AnyComponent);

		const payload = JSON.parse(await toolOf(registered, "todesk_status").handler({ trigger: { input: {} } }));
		expect(payload).toMatchObject({ ok: true, device_id: "123456789", version: "4.8.8.4", autostart: true });
		const statusRun = runs.find((run) => run.args[0] === "-status");
		expect(statusRun?.file).toBe("ToDesk.exe");
		expect(statusRun?.env?.PATH).toContain("C:\\Program Files\\ToDesk");
	});

	it("quotes the host's own error when the command is not granted", async () => {
		const { ctx, deps, registered } = fakeCtx({ failRun: true });
		registerTodeskPlugin(ctx as never, deps, AnyComponent);

		const payload = JSON.parse(await toolOf(registered, "todesk_status").handler({ trigger: { input: {} } }));
		expect(payload.ok).toBe(false);
		expect(payload.host_error).toContain("disabled by user");
	});

	it("refuses a connect without the far side's password", async () => {
		const { ctx, deps, registered, runs } = fakeCtx();
		registerTodeskPlugin(ctx as never, deps, AnyComponent);

		const payload = JSON.parse(
			await toolOf(registered, "todesk_connect").handler({ trigger: { input: { device_id: "111 222 333" } } }),
		);
		expect(payload.ok).toBe(false);
		expect(payload.reason).toContain("password");
		expect(runs.some((run) => run.args.includes("-control"))).toBe(false);
	});

	it("passes the password through to -control", async () => {
		const { ctx, deps, registered, runs } = fakeCtx();
		registerTodeskPlugin(ctx as never, deps, AnyComponent);

		await toolOf(registered, "todesk_connect").handler({
			trigger: { input: { device_id: "111222333", password: "a12345" } },
		});
		expect(runs.some((run) => run.args.join(" ") === "-control -id 111222333 -passwd a12345")).toBe(true);
	});

	it("honours a per-capability off switch", async () => {
		const { ctx, deps, registered, runs } = fakeCtx({ settings: { tools: { connect: false } } });
		registerTodeskPlugin(ctx as never, deps, AnyComponent);

		const payload = JSON.parse(
			await toolOf(registered, "todesk_connect").handler({ trigger: { input: { device_id: "111222333" } } }),
		);
		expect(payload.ok).toBe(false);
		expect(payload.reason).toContain("switched off");
		expect(runs.some((run) => run.args.includes("-control"))).toBe(false);
	});

	it("toggles autostart and reports the observed state", async () => {
		const { ctx, deps, registered, runs } = fakeCtx();
		registerTodeskPlugin(ctx as never, deps, AnyComponent);

		const payload = JSON.parse(
			await toolOf(registered, "todesk_autostart").handler({ trigger: { input: { enabled: false } } }),
		);
		expect(payload).toMatchObject({ ok: true, requested: false, observed_autostart: true });
		expect(runs.some((run) => run.args.join(" ") === "-autostart off")).toBe(true);
	});

	it("teaches the model the tools and the boundary on every turn", async () => {
		const { ctx, deps, prompts } = fakeCtx();
		registerTodeskPlugin(ctx as never, deps, AnyComponent);

		expect(prompts.map((p) => p.id)).toEqual(["todesk-capability"]);
		const handler = (prompts[0] as unknown as { handler: () => Promise<unknown[]> }).handler;
		const ops = (await handler()) as { type: string; block: { content: string } }[];
		const text = ops[0].block.content;
		expect(text).toContain("todesk_status");
		expect(text).toContain("temporary password");
		expect(text).toContain("cannot see the remote screen");
	});
});
