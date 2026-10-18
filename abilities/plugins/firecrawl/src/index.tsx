/**
 * Firecrawl plugin entry.
 *
 * Two UI surfaces, both plugin-side only:
 *   1. activity tab "crawl.console" — animated spider web + live console; the
 *      same store the agent tools write to, so a tool-started crawl animates here.
 *   2. input action "firecrawl.openConsole" — puts the tab in the strip and opens
 *      it, and tells the agent which tool to reach for on the next prompt.
 *
 * The store is created once per activation and passed to components through a
 * closure: activity-tab components are typed as zero-props.
 */
import "./style.css";
import type { JSX } from "react";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { CrawlConsoleTab } from "./features/crawler-console";
import { CrawlRunStore } from "./features/crawler-console/services/crawl-run-store";
import { crawlSite } from "./domain/crawl/crawler";
import { createHostBinaryFetcher, createHostHttpClient } from "./runtime/http-client";
import { createBrowserPortFactory } from "./runtime/browser-session";
import { createAiPort } from "./runtime/ai";
import { setPluginContext } from "./runtime/plugin-context";
import { watchConversation } from "./runtime/conversation-watch";
import { FIRECRAWL_TAB_ID } from "./tab-id";
import { registerFirecrawlTools } from "./tools/register-tools";

const FIRECRAWL_ACTION_ID = "firecrawl.openConsole";

// Tab icons render as raw <svg> (Iconify CSS classes do not apply in that slot).
const spiderIcon = (): JSX.Element => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
		<circle cx="12" cy="12" r="3.2" />
		<path d="M12 8.8V4M12 15.2V20M8.8 12H4M15.2 12H20M9 9L5.6 5.6M15 9l3.4-3.4M9 15l-3.4 3.4M15 15l3.4 3.4" />
	</svg>
);

export default definePlugin({
	async activate(ctx: PluginContext): Promise<Disposable> {
		setPluginContext(ctx);

		const client = createHostHttpClient(ctx);
		// Both handles are optional: a host without the browser runtime or a
		// configured model still scrapes, crawls and maps.
		const browser = createBrowserPortFactory(ctx);
		const ai = createAiPort(ctx);
		// Binary transport (PDFs): a base64 fetch, so documents are read as documents.
		const binary = createHostBinaryFetcher(ctx);
		const store = new CrawlRunStore((target, options, hooks) =>
			crawlSite(client, target, options, hooks, { browser, binary }),
		);
		// The console follows the conversation: a URL mentioned in the prompt, or one
		// the agent is about to fetch, becomes the target without the user retyping it.
		const conversation = watchConversation(ctx, store);

		// The tab is the visible entry point: register it before anything that can
		// fail, so a missing optional API never removes the plugin from the UI.
		const tabDisposable = ctx.ui.registerActivityTab({
			id: FIRECRAWL_TAB_ID,
			label: "%tab.label%",
			icon: spiderIcon(),
			order: 26,
			scope_use: ["conversation", "project"],
			initiallyVisible: true,
			component: () => <CrawlConsoleTab store={store} />,
		});

		let tools: Disposable[] = [];
		try {
			tools = registerFirecrawlTools(ctx, { client, store, browser, ai, binary });
		} catch (error) {
			console.warn("[firecrawl] tool registration unavailable", error);
			ctx.ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
		}

		let action: Disposable | null = null;
		try {
			action = ctx.ui.registerInputAction({
				id: FIRECRAWL_ACTION_ID,
				label: "%action.openConsole.label%",
				icon: spiderIcon(),
				scope_use: ["conversation", "project"],
				onToggle: (active) => {
					ctx.ui.setActivityTabVisible(FIRECRAWL_TAB_ID, active);
					if (active) ctx.ui.openActivityTab(FIRECRAWL_TAB_ID, { width: "max" });
				},
				decoratePrompt: () => ({ instructions: ["%prompt.console.instructions%"] }),
			});
		} catch (error) {
			console.warn("[firecrawl] input action unavailable", error);
		}

		return {
			dispose(): void {
				conversation.dispose();
				store.stop();
				for (const disposable of [...tools].reverse()) disposable.dispose();
				action?.dispose();
				tabDisposable.dispose();
			},
		};
	},
});
