/**
 * Host browser adapter.
 *
 * `ctx.browser` hands out a session id, not an object: every call re-states the
 * id. This adapter owns the lifecycle (create → navigate → act → read → close)
 * so the domain layer only ever sees `BrowserPort`.
 *
 * The host runtime may be missing or outdated; that surfaces here as a plain
 * error and the pipeline degrades to static rendering instead of failing the
 * scrape.
 */

import type { PluginBrowserAction, PluginContext } from "@astravia-org/plugin-sdk";
import type { BrowserAction, BrowserPort, BrowserPortFactory } from "../domain/render/types";

/** Assertions on the browser surface were not available when a plugin is loaded lazily. */
type BrowserApi = PluginContext["browser"];

export function hasBrowserApi(ctx: PluginContext): boolean {
	const browser = ctx.browser as BrowserApi | undefined;
	return Boolean(browser && browser.sessions && typeof browser.sessions.create === "function");
}

const PROFILE_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function createBrowserPortFactory(ctx: PluginContext): BrowserPortFactory | undefined {
	if (!hasBrowserApi(ctx)) return undefined;
	return async (options): Promise<BrowserPort> => {
		const browser = ctx.browser;
		const wanted = options?.profileId?.trim();
		if (wanted && !PROFILE_ID.test(wanted)) {
			throw new Error(`Invalid browser profile id: use 1-64 letters, digits, dot, dash or underscore`);
		}
		const session = await browser.sessions.create({
			profile: wanted ? { type: "persistent", id: wanted } : { type: "ephemeral" },
		});
		let closed = false;
		const close = async (): Promise<void> => {
			if (closed) return;
			closed = true;
			await browser.sessions.close(session.id).catch(() => undefined);
		};
		return {
			async open(url: string, timeoutMs: number) {
				const state = await browser.navigate(session.id, url);
				return { url: state.url || url, title: state.title };
			},
			async act(action: BrowserAction) {
				await browser.act(session.id, toHostAction(action));
			},
			async readText() {
				const content = await browser.readText(session.id, { maxChars: 400_000 });
				return content.text;
			},
			async snapshot() {
				const snapshot = await browser.snapshot(session.id);
				return snapshot.content;
			},
			async screenshot(fullPage: boolean) {
				const shot = await browser.screenshot(session.id, { fullPage });
				return shot.dataUrl;
			},
			close,
		};
	};
}

function toHostAction(action: BrowserAction): PluginBrowserAction {
	switch (action.type) {
		case "click":
			return { type: "click", target: action.target };
		case "fill":
			return { type: "fill", target: action.target, value: action.value };
		case "type":
			return { type: "type", target: action.target, value: action.value };
		case "select":
			return { type: "select", target: action.target, value: action.value };
		case "check":
			return { type: "check", target: action.target, checked: action.checked };
		case "press":
			return { type: "press", key: action.key };
		case "scroll":
			return { type: "scroll", direction: action.direction, amount: action.amount };
		case "wait":
			return { type: "wait", milliseconds: action.milliseconds, target: action.target };
		case "back":
			return { type: "back" };
		case "reload":
			return { type: "reload" };
	}
}
