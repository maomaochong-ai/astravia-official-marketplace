/**
 * Ability-page setup card: the only place a user is asked to authorize.
 *
 * The card must stay honest about the keyless tier, send the user to the official
 * API-key page rather than a local form pretending to be OAuth, and never claim a
 * connection it does not have.
 */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { AUTHORIZE_URL, type AccountState, type FirecrawlConfig } from "../src/runtime/config";
import { AbilitySetupSlot } from "../src/features/setup/ability-setup-slot";
import { setSetupDeps } from "../src/features/setup/deps";

const spies = vi.hoisted(() => ({ openExternal: vi.fn(async () => {}), notify: vi.fn() }));

const STRINGS: Record<string, string> = {
	"setup.title": "Firecrawl account",
	"setup.connected": "connected",
	"setup.keyless": "keyless",
	"setup.remaining": "Credits",
	"setup.renews": "Renews",
	"setup.keylessBody": "Keyless answers search and scrape only.",
	"setup.keyedBody": "The key signs every request.",
	"setup.refresh": "Refresh credits",
	"setup.manage": "Manage keys",
	"setup.disconnect": "Disconnect",
	"setup.authorize": "Open firecrawl.dev",
	"setup.authorizeHint": "Sign in and create a key",
	"setup.keyPlaceholder": "fc-…",
	"setup.connect": "Verify and save",
	"setup.connecting": "Verifying…",
};

vi.mock("../src/runtime/plugin-context", () => ({
	hasPluginContext: () => true,
	getPluginContext: () => ({
		i18n: {
			locale: "en",
			t: (key: string) => STRINGS[key] ?? key,
			onChange: () => ({ dispose: () => {} }),
		},
		ui: { notify: spies.notify, openExternal: spies.openExternal },
	}),
	setPluginContext: () => {},
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function harness(initial: AccountState, overrides: Partial<FirecrawlConfig> = {}) {
	let account = initial;
	const listeners = new Set<() => void>();
	const config = {
		get account() {
			return account;
		},
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		connect: vi.fn(async (key: string) => {
			account = { connected: true, remainingCredits: 480, planCredits: 500 };
			for (const listener of listeners) listener();
			return key.length > 0;
		}),
		disconnect: vi.fn(async () => {
			account = { connected: false };
			for (const listener of listeners) listener();
		}),
		refreshAccount: vi.fn(async () => account),
		...overrides,
	} as unknown as FirecrawlConfig;
	const ctx = { ui: { notify: spies.notify, openExternal: spies.openExternal } } as unknown as PluginContext;
	return { config, ctx };
}

describe("AbilitySetupSlot", () => {
	// Runs first on purpose: the registry starts empty, and an unregistered slot
	// must vanish rather than render a card with dead buttons.
	it("renders nothing before activation published the config", () => {
		const view = render(<AbilitySetupSlot abilityId="firecrawl" installed enabled />);
		expect(view.container.innerHTML).toBe("");
	});

	it("explains the keyless tier and hands the user to the official key page", async () => {
		const { config, ctx } = harness({ connected: false });
		setSetupDeps({ ctx, config });
		const view = render(<AbilitySetupSlot abilityId="firecrawl" installed enabled />);

		expect(view.getByText("keyless")).toBeTruthy();
		expect(view.getByText("Keyless answers search and scrape only.")).toBeTruthy();
		expect(view.queryByText("Disconnect")).toBeNull();

		fireEvent.click(view.getByText("Open firecrawl.dev"));

		await waitFor(() => expect(spies.openExternal).toHaveBeenCalledWith(AUTHORIZE_URL));
		expect(AUTHORIZE_URL).toBe("https://www.firecrawl.dev/app/api-keys");
	});

	it("verifies the pasted key before accepting it, then shows the plan", async () => {
		const { config, ctx } = harness({ connected: false });
		setSetupDeps({ ctx, config });
		const view = render(<AbilitySetupSlot abilityId="firecrawl" installed enabled />);

		const save = view.getByText("Verify and save");
		expect((save as HTMLButtonElement).disabled).toBe(true);

		fireEvent.change(view.getByPlaceholderText("fc-…"), { target: { value: "fc-new" } });
		expect((save as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(save);

		await waitFor(() => expect(config.connect).toHaveBeenCalledWith("fc-new"));
		await waitFor(() => expect(view.getByText("connected")).toBeTruthy());
		expect(view.getByText("480 / 500")).toBeTruthy();
		expect(view.getByText("The key signs every request.")).toBeTruthy();
		expect(view.queryByText("Verify and save")).toBeNull();
	});

	it("reports a rejected key without pretending to be connected", async () => {
		const { config, ctx } = harness({ connected: false }, {
			connect: vi.fn(async () => false),
		});
		setSetupDeps({ ctx, config });
		const view = render(<AbilitySetupSlot abilityId="firecrawl" installed enabled />);

		fireEvent.change(view.getByPlaceholderText("fc-…"), { target: { value: "fc-typo" } });
		fireEvent.click(view.getByText("Verify and save"));

		await waitFor(() => expect(config.connect).toHaveBeenCalledWith("fc-typo"));
		expect(view.getByText("keyless")).toBeTruthy();
		expect(view.getByText("Verify and save")).toBeTruthy();
	});

	it("drops a connected key from the card on disconnect", async () => {
		const { config, ctx } = harness({
			connected: true,
			remainingCredits: 480,
			planCredits: 500,
			billingPeriodEnd: "2026-11-01T00:00:00.000Z",
		});
		setSetupDeps({ ctx, config });
		const view = render(<AbilitySetupSlot abilityId="firecrawl" installed enabled />);

		expect(view.getByText("connected")).toBeTruthy();
		expect(view.getByText("480 / 500")).toBeTruthy();

		fireEvent.click(view.getByText("Disconnect"));

		await waitFor(() => expect(config.disconnect).toHaveBeenCalled());
		await waitFor(() => expect(view.getByText("keyless")).toBeTruthy());
		expect(view.queryByText("480 / 500")).toBeNull();
	});

	it("surfaces a browser hand-off failure instead of swallowing it", async () => {
		spies.openExternal.mockRejectedValueOnce(new Error("no handler"));
		const { config, ctx } = harness({ connected: false });
		setSetupDeps({ ctx, config });
		const view = render(<AbilitySetupSlot abilityId="firecrawl" installed enabled />);

		fireEvent.click(view.getByText("Open firecrawl.dev"));

		await waitFor(() =>
			expect(spies.notify).toHaveBeenCalledWith({ message: "no handler", error: true }),
		);
	});
});
