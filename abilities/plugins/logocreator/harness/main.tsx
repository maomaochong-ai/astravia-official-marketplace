import { StrictMode, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { __PluginI18nContext, __setPluginHostBridge } from "@astravia-org/plugin-sdk";
import { LogoCanvas } from "../src/features/canvas/components/logo-canvas";
import { setPluginContext } from "../src/plugin-context";
import { normalizeSpec } from "../src/domain/spec";
import en from "../locales/en.json";
import zh from "../locales/zh.json";
import "../src/style.css";

/**
 * Fake host context — same shape the unit tests use, extended with two stored
 * designs so the result rail has something to show.
 */
const CWD = "C:/work/demo";

function design(id: string, brandName: string, createdAt: number, subject = "leaf") {
	return {
		id,
		spec: normalizeSpec({ brandName, type: "icon-name", style: "minimal", intent: "a leaf mark for a garden studio" }),
		engine: "local" as const,
		subject,
		createdAt,
		favorite: id === "d1",
	};
}

function context(seed: { items: unknown[] }) {
	const files: Record<string, string> = seed.items.length
		? { "designs.json": JSON.stringify({ schemaVersion: 1, items: seed.items }) }
		: {};
	const noop = () => undefined;
	const ctx = {
		plugin: { id: "logocreator", version: "0.0.0" },
		permissions: { has: () => true, require: noop },
		ui: {
			notify: (m: unknown) => console.log("notify", m),
			openActivityTab: noop,
			setActivityTabVisible: noop,
			openExternal: noop,
			getSidebarState: () => ({ visible: true, collapsed: false, narrow: false }),
			onSidebarStateChanged: () => ({ dispose: noop }),
		},
		storage: {
			list: async () => Object.keys(files),
			readFile: async (path: string) => files[path] ?? null,
			writeFile: async (path: string, data: string) => {
				files[path] = data;
				return { revision: "r", changedPaths: [path] };
			},
			commit: async () => ({ revision: "r", changedPaths: [] }),
			readSnapshot: async (paths: string[]) => ({
				revision: "r",
				files: Object.fromEntries(paths.map((p) => [p, files[p] ?? null])),
			}),
			putBlob: async () => ({ id: "b", url: "", mimeType: "image/png" }),
			putBlobFromFile: async () => ({ id: "b", url: "", mimeType: "image/png" }),
			readBlob: async () => null,
			getBlobRef: async () => null,
			deleteBlob: async () => undefined,
		},
		conversation: {
			sendPrompt: async () => ({ status: "queued" }),
			insertText: noop,
			createSession: async () => ({ id: "s", cwd: CWD, sessionPath: null, model: null, isStreaming: false }),
			abort: async () => undefined,
			on: () => ({ dispose: noop }),
		},
		media: { listProviders: async () => [], submit: noop, registerProvider: noop, onProvidersChanged: noop },
		jobs: { wait: noop, get: noop, cancel: noop },
		artifacts: { persist: noop, release: noop },
		fs: {
			saveAs: async () => null,
			readFile: noop,
			writeFile: noop,
			readDir: async () => [],
			listFilesRecursive: async () => [],
			createDirectory: noop,
			stat: async () => null,
			delete: noop,
			rename: noop,
			move: noop,
			watchDirectory: () => ({ dispose: noop }),
			readBinaryFile: noop,
		},
		agent: { registerTool: noop, registerSystemPromptProvider: noop, registerHook: noop, registerContinuationProvider: noop },
		i18n: { locale: "zh", t: (k: string) => k, onChange: () => ({ dispose: noop }) },
	};
	return ctx;
}

__setPluginHostBridge({
	useLocale: () => "zh",
	useActiveConversation: () => ({ id: "s1", cwd: CWD, sessionPath: null, model: null, isStreaming: false }) as never,
	useConversationMessages: () => [],
	usePromptAttachment: () => null,
	useSidebarState: () => ({ visible: true, collapsed: false, narrow: false }),
	conversation: {} as never,
});

function Panel({ width, state }: { width: number; state: "empty" | "history" }): JSX.Element {
	const items =
		state === "history"
			? [design("d1", "Fern & Field", 3_000), design("d2", "Kettle Lane", 2_000, "cup"), design("d3", "Vellum", 1_000, "book")]
			: [];
	setPluginContext(context({ items }) as never);
	return (
		<div className="overflow-hidden rounded-xl border border-neutral-700 bg-background" style={{ width, height: 700 }}>
			<div className="flex h-full flex-col">
				<div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 px-2 text-[11px] text-muted-foreground">
					<span className="rounded bg-muted px-1.5 py-0.5">当前标志设计</span>
				</div>
				<div className="min-h-0 flex-1">
					<LogoCanvas />
				</div>
			</div>
		</div>
	);
}

class FrameSlot extends HTMLElement {
	connectedCallback(): void {
		const width = Number(this.getAttribute("width") ?? 420);
		const state = (this.getAttribute("state") ?? "empty") as "empty" | "history";
		const host = document.createElement("div");
		this.appendChild(host);
		createRoot(host).render(
			<StrictMode>
				<div className="space-y-1">
					<p className="text-[11px] text-neutral-400">{this.getAttribute("label")}</p>
					<__PluginI18nContext.Provider value={{ locales: { en, zh }, defaultLocale: "zh" }}>
						<Panel width={width} state={state} />
					</__PluginI18nContext.Provider>
				</div>
			</StrictMode>,
		);
	}
}
customElements.define("frame-slot", FrameSlot);
