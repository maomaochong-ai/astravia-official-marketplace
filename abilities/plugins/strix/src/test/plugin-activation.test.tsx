import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import plugin from "../index";

/**
 * Activation and first paint, with the host stubbed.
 *
 * The panel is a Module Federation remote mounted by the host: when something in
 * it throws at render, the user sees an empty pane and nothing in the transcript.
 * This mounts the real component the plugin registers, so a crash shows up here
 * instead of in the app.
 */

afterEach(cleanup);

/** Activation may hand back a disposable object, a bare function, or nothing. */
async function disposeOf(value: unknown): Promise<void> {
	if (typeof value === "function") await (value as () => void | Promise<void>)();
	else if (value && typeof (value as { dispose?: unknown }).dispose === "function") {
		await (value as { dispose: () => void | Promise<void> }).dispose();
	}
}

function fakeHost(services: Record<string, unknown> = {}) {
	let registered: { component: () => React.ReactElement } | undefined;
	const ctx = {
		plugin: { id: "strix", version: "0.0.0", iconUrl: "astravia-plugin://strix/versions/0.0.0/assets/icon.png" },
		i18n: { t: (key: string) => key },
		conversation: { sendPrompt: async () => ({ status: "sent" }) },
		ui: {
			registerActivityTab: (contribution: { component: () => React.ReactElement }) => {
				registered = contribution;
				return { dispose() {} };
			},
			registerInputAction: () => ({ dispose() {} }),
			setActivityTabVisible: () => undefined,
			openActivityTab: () => undefined,
		},
		services: {
			getStatus: async () => ({ phase: "stopped", installed: true }),
			start: async () => ({ phase: "ready", installed: true }),
			connection: async () => ({ baseUrl: "http://127.0.0.1:9" }),
			install: async () => ({ phase: "ready", installed: true }),
			onStatusChange: () => ({ dispose() {} }),
			...services,
		},
	} as unknown as Parameters<typeof plugin.activate>[0];
	return { ctx, tab: () => registered };
}

describe("plugin activation", () => {
	it("registers a tab and an input action, and the tab renders without throwing", async () => {
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);

		const tab = host.tab();
		expect(tab?.component).toBeTypeOf("function");

		// The service is unreachable in this stub, so the panel must fall back to its
		// error state instead of crashing.
		render(tab!.component());
		expect(screen.getByText("panel.subtitle")).toBeTruthy();
		expect(screen.getByLabelText("composer.label")).toBeTruthy();

		await disposeOf(disposable);
	});

	it("renders the ready state when the service reports a live sandbox", async () => {
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					environment: {
						python: { version: "3.13", executable: "python", found: true },
						engine: { installed: true, version: "1.7.0" },
						docker: { ready: true, detail: "", image: "img", imagePresent: true },
						ready: true,
					},
					sandbox: { running: true, sessionId: "s1", targets: ["example.com"], uptimeSec: 12 },
					findings: [{ id: "f1", title: "XSS in search", severity: "high" }],
				}),
				{ status: 200 },
			)) as typeof fetch;

		render(host.tab()!.component());
		expect(await screen.findByText("example.com")).toBeTruthy();
		expect(screen.getByText("XSS in search")).toBeTruthy();
		await disposeOf(disposable);
	});

	it("survives a probe whose shape is an error object, not a probe", async () => {
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					environment: { error: "docker is not running" },
					sandbox: { running: false },
					findings: [],
				}),
				{ status: 200 },
			)) as typeof fetch;

		render(host.tab()!.component());
		expect(screen.getByText("panel.subtitle")).toBeTruthy();
		await disposeOf(disposable);
	});

	it("survives a probe that is missing sections the pane expects", async () => {
		// A probe is assembled from several host calls; if one of them fails the object
		// still carries `ready`, and every field below it is missing.
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({ environment: { ready: false }, sandbox: { running: false }, findings: [] }),
				{ status: 200 },
			)) as typeof fetch;

		render(host.tab()!.component());
		expect(screen.getByText("panel.subtitle")).toBeTruthy();
		await disposeOf(disposable);
	});

	it("never leaves an unhandled rejection when the bridge is down", async () => {
		const host = fakeHost({ getStatus: () => Promise.reject(new Error("no service")) });
		const spy = vi.fn();
		process.on("unhandledRejection", spy);
		const disposable = await plugin.activate(host.ctx);
		render(host.tab()!.component());
		await new Promise((resolve) => setTimeout(resolve, 50));
		process.off("unhandledRejection", spy);
		expect(spy).not.toHaveBeenCalled();
		await disposeOf(disposable);
	});
});
