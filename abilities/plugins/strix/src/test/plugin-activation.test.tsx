import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The host bridge is what `useActiveConversation()` reads. In the app the host installs
 * it; here it is stubbed with the same shape, so the tab mounts against a real
 * conversation state (model + cwd) instead of a missing bridge.
 */
const conversationState = {
	id: "session-1",
	cwd: "D:\\open-source-projects\\strix",
	sessionPath: null,
	model: "anthropic/claude-opus-5-5",
	isStreaming: false,
};

vi.mock("@astravia-org/plugin-sdk", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@astravia-org/plugin-sdk")>();
	return { ...actual, useActiveConversation: () => conversationState };
});

import plugin from "../index";

/**
 * Activation and first paint, with the host stubbed.
 *
 * The panel is a Module Federation remote mounted by the host: when something in it
 * throws at render, the user sees an empty pane and nothing in the transcript. This
 * mounts the real component the plugin registers, so a crash shows up here instead of
 * in the app.
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
	let action: { onToggle?: (active: boolean) => void } | undefined;
	const listenerRef: { current: ((event: unknown) => void) | undefined } = { current: undefined };
	const ctx = {
		plugin: { id: "strix", version: "0.5.0", iconUrl: "astravia-plugin://strix/versions/0.5.0/assets/icon.png" },
		i18n: { t: (key: string) => key },
		// Kept in the stub on purpose: the panel must not reach for any of it. The tests
		// that care replace these with throwing spies (see "never calls a model itself").
		// `listenerRef` / `action` let a test drive the run the way the host does: toggle
		// the capsule, then push conversation events.
		ai: {
			listModels: async () => ({ defaultModel: "openai/gpt-5", models: [] }),
			complete: async () => {
				throw new Error("unused");
			},
			stream: async () => {
				throw new Error("unused");
			},
			chat: async () => {
				throw new Error("unused");
			},
		},
		ui: {
			registerActivityTab: (contribution: { component: () => React.ReactElement }) => {
				registered = contribution;
				return { dispose() {} };
			},
			registerInputAction: (contribution: { onToggle?: (active: boolean) => void }) => {
				action = contribution;
				return { dispose() {} };
			},
			setActivityTabVisible: () => undefined,
			openActivityTab: () => undefined,
		},
		// `agent.session.read`: the tab follows the active conversation, so the stub has to
		// answer with the same event stream the host does. The listener is captured so a
		// test can drive a turn exactly the way the host would.
		conversation: {
			on: (listener: (event: unknown) => void) => {
				listenerRef.current = listener;
				return { dispose() {} };
			},
			sendPrompt: async () => ({ status: "sent" }),
			insertText: () => undefined,
			abort: async () => undefined,
			createSession: async () => conversationState,
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
	return {
		ctx,
		tab: () => registered,
		/** Flip the composer capsule, as a click would. */
		toggle: (active: boolean) => action?.onToggle?.(active),
		/** Push a conversation event, as the host would. */
		emit: (event: unknown) => listenerRef.current?.(event),
	};
}

/** Fill the launch column's prompt and press Enter, the way a user launches a scan. */
function launchWith(text: string): void {
	const input = screen.getByLabelText("launch.label") as HTMLTextAreaElement;
	fireEvent.change(input, { target: { value: text } });
	fireEvent.keyDown(input, { key: "Enter" });
}

describe("plugin activation", () => {
	it("registers a tab and an input action, and the tab renders without throwing", async () => {
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);

		const tab = host.tab();
		expect(tab?.component).toBeTypeOf("function");

		// The service is unreachable in this stub, so the panel must fall back to its
		// launch screen with a failure line instead of crashing.
		render(tab!.component());
		expect(screen.getByText("launch.tagline")).toBeTruthy();
		expect(screen.getByLabelText("launch.label")).toBeTruthy();

		await disposeOf(disposable);
	});

	it("shows the conversation's model, not a settings default", async () => {
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);
		render(host.tab()!.component());
		// The conversation runs claude-opus-5-5 and the launch facts table says so.
		// 1.0.7：出处不再写进日志——事实表里已经有这一行，日志只放事件。
		expect(await screen.findByText("claude-opus-5-5")).toBeTruthy();
		expect(screen.queryByText(/log\.modelFromConversation/)).toBeNull();
		await disposeOf(disposable);
	});

	it("says which workspace the conversation is in", async () => {
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);
		render(host.tab()!.component());
		// 目录是事实表里的一行（launch.folder），不是日志里的一行。
		expect(screen.getByText(/launch\.folder/)).toBeTruthy();
		expect(screen.queryByText(/log\.workspaceMounted/)).toBeNull();
		await disposeOf(disposable);
	});

	it("survives a probe whose shape is an error object, not a probe", async () => {
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ environment: { error: "docker is not running" }, sandbox: { running: false }, findings: [] }), {
				status: 200,
			})) as typeof fetch;

		render(host.tab()!.component());
		expect(screen.getByText("launch.tagline")).toBeTruthy();
		await disposeOf(disposable);
	});

	it("survives a probe that is missing sections the pane expects", async () => {
		const host = fakeHost();
		const disposable = await plugin.activate(host.ctx);
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ environment: { ready: false }, sandbox: { running: false }, findings: [] }), {
				status: 200,
			})) as typeof fetch;

		render(host.tab()!.component());
		expect(screen.getByText("launch.tagline")).toBeTruthy();
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

	it("hands the launch prompt to the host conversation and never calls a model itself", async () => {
		const host = fakeHost();
		const listModels = vi.fn(async () => {
			throw new Error("the panel must not ask for a model list");
		});
		const chat = vi.fn(async () => {
			throw new Error("the panel must not run its own loop");
		});
		Object.assign(host.ctx.ai as unknown as Record<string, unknown>, { listModels, chat });
		const sent: string[] = [];
		Object.assign(host.ctx.conversation as unknown as Record<string, unknown>, {
			sendPrompt: async (text: string) => {
				sent.push(text);
				return { status: "sent" as const };
			},
		});

		const disposable = await plugin.activate(host.ctx);
		render(host.tab()!.component());
		launchWith("pentest staging.example.com");

		// The conversation is the only AI in the picture: the prompt lands there, and the
		// panel's own model surface is never touched.
		await vi.waitFor(() => expect(sent).toEqual(["pentest staging.example.com"]));
		expect(chat).not.toHaveBeenCalled();
		expect(listModels).not.toHaveBeenCalled();

		await disposeOf(disposable);
	});

	it("reports a failed delivery instead of inventing output", async () => {
		const host = fakeHost();
		Object.assign(host.ctx.conversation as unknown as Record<string, unknown>, {
			sendPrompt: async () => {
				throw new Error("No active conversation to send to");
			},
		});
		const disposable = await plugin.activate(host.ctx);
		render(host.tab()!.component());
		launchWith("scan a.test");

		// The failure is reported in the launch log; no transcript row is fabricated.
		expect(await screen.findByText(/log.sendFailed/)).toBeTruthy();

		await disposeOf(disposable);
	});

	it("follows the host turn but renders no prose of its own (ADR 0007)", async () => {
		const host = fakeHost();
		// The bridge is unreachable here; that only affects the environment probe.
		const disposable = await plugin.activate(host.ctx);
		render(host.tab()!.component());

		// 1. The capsule is what puts Strix on this turn.
		host.toggle(true);

		// 2. The host starts a turn and streams an answer token by token.
		await act(async () => {
			host.emit({ type: "turn-start" });
			host.emit({ type: "message-updated", delta: "Four renditions found" });
			host.emit({ type: "message-updated", delta: "; one IDOR filed." });
		});

		// The panel left the launch column, but the words are not here: they are in the chat,
		// rendered better there. Rendering them twice is the redundancy this change removes.
		expect(screen.queryByText("launch.tagline")).toBeNull();
		expect(screen.queryByText(/Four renditions found/)).toBeNull();

		// 3. The finished message changes nothing on the panel either.
		await act(async () => {
			host.emit({
				type: "message-added",
				message: { id: "m1", role: "assistant", text: "Four renditions found; one IDOR filed." },
			});
			host.emit({ type: "turn-end", stopReason: "stop" });
		});

		expect(screen.queryByText(/Four renditions found/)).toBeNull();
		// State still follows the turn: running while it runs, idle after it ends.
		expect(screen.getByText("scan.idle")).toBeTruthy();

		await disposeOf(disposable);
	});
});
