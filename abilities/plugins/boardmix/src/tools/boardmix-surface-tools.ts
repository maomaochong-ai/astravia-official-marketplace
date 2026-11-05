import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { PAGE_OUTLINE_SCRIPT } from "../domain/boardmix-outline";
import {
	eventsFor,
	labelOf,
	readSteps,
	settleMsFor,
	STEP_LIMIT,
	type BoardmixStep,
} from "../domain/boardmix-input";
import { saveBoardmixShot } from "../features/boardmix-workspace/services/boardmix-shot";
import { boardmixTab, type BoardmixTabHandle } from "../features/boardmix-workspace/services/tab-registry";
import { boardmixWorkspace } from "../features/boardmix-workspace/services/workspace-cwd";
import { TOOL_IDS } from "../plugin-ids";

const TOOL_SCOPE = ["conversation", "project"] as const;

const NO_TAB =
	"Call boardmix_open first: the board lives in its activity tab, and these tools only act on that tab.";

interface OutlineItem {
	tag: string;
	label: string;
	role: string;
	x: number;
	y: number;
}

interface PageOutline {
	url?: string;
	title?: string;
	readyState?: string;
	login?: boolean;
	size?: { width: number; height: number };
	scroll?: { x: number; y: number };
	items?: OutlineItem[];
	text?: string;
}

function failure(reason: string, extra: Record<string, unknown> = {}): string {
	return JSON.stringify({ ok: false, open: boardmixTab() !== null, reason, ...extra });
}

/** 三个能力缺一个就整体不可用：读不到页面就别谈点它。 */
function primitivesMissing(handle: BoardmixTabHandle): string | null {
	const gaps = handle.gaps();
	return gaps.length > 0 ? failure("primitive-unavailable", { gaps }) : null;
}

async function outlineOf(handle: BoardmixTabHandle): Promise<PageOutline | null> {
	const value = await handle.read(PAGE_OUTLINE_SCRIPT);
	if (!value || typeof value !== "object") return null;
	return value as PageOutline;
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Put the capture in front of the *person*, not just the model.
 *
 * A returned path is a string in a tool result — invisible to whoever is watching.
 * `ui.previewFile` gives the same PNG to the host's own previewer, so the board
 * opens inside Astravia. Best effort: an older host or a refused path must never
 * turn a working screenshot into a failed tool.
 */
function showToUser(ctx: PluginContext, path: string, name: string): boolean {
	const ui = ctx.ui as { previewFile?: (file: { path?: string; name?: string; mimeType?: string }) => void };
	if (typeof ui.previewFile !== "function") return false;
	try {
		ui.previewFile({ path, name, mimeType: "image/png" });
		return true;
	} catch {
		return false;
	}
}

const STEP_SCHEMA = {
	type: "object",
	properties: {
		op: {
			type: "string",
			enum: ["click", "move", "type", "key", "scroll", "wait"],
			description:
				"click/move use x,y from boardmix_read. type sends text as keystrokes to whatever has focus. " +
				"key takes one key name (Enter, Tab, Escape, Backspace, ArrowRight, a single letter) with optional modifiers. " +
				"scroll uses x,y plus dy. wait just pauses.",
		},
		x: { type: "number", description: "Viewport pixel column, as printed by boardmix_read." },
		y: { type: "number", description: "Viewport pixel row, as printed by boardmix_read." },
		button: { type: "string", enum: ["left", "right"], description: "Mouse button for click. Defaults to left." },
		clicks: { type: "number", description: "1 or 2. A double click needs both." },
		text: { type: "string", description: "For op=type: the text to type into the focused field." },
		key: { type: "string", description: "For op=key: Enter, Tab, Escape, Backspace, a letter, …" },
		modifiers: {
			type: "array",
			items: { type: "string", enum: ["shift", "control", "alt", "meta"] },
			description: "For op=key: held modifiers.",
		},
		dy: { type: "number", description: "For op=scroll: vertical delta in pixels (positive scrolls down)." },
		ms: { type: "number", description: "For op=wait: milliseconds, max 5000." },
		label: { type: "string", description: "What this step does, in the user's language; echoed in the result." },
	},
	required: ["op"],
	additionalProperties: false,
} as const;

/**
 * 面板的「眼睛」与「手」：读页面、截图、发真实输入。
 *
 * 这三件事都不是新机制——它们就是 `<webview>` 自己的
 * `executeJavaScript` / `capturePage` / `sendInputEvent`。此前的插件只用了
 * 导航，所以它只能把页面搬到对的地方，剩下的都得人点。
 *
 * 边界写清楚：DOM 能读到按钮和输入框，读不到画布里的图形；截图能看见图形，
 * 但那是像素，不能靠它推断图层结构。两个工具一起用才完整。
 */
export function registerSurfaceTools(ctx: PluginContext): Disposable[] {
	const disposables: Disposable[] = [];

	// ------------------------------------------------------------------ read
	disposables.push(
		ctx.agent.registerTool<{ query?: string; limit?: number }>({
			id: TOOL_IDS.read,
			label: "%tool.read.label%",
			description:
				"Read the Boardmix page that is open in the panel: address, title, whether this is the login page, " +
				"the visible viewport size, the page text, and up to 120 controls with the exact point to click " +
				"(x, y in viewport pixels — feed those straight to boardmix_act). " +
				"Use `query` to narrow to labels containing a word (\"share\", \"export\", \"登录\"). " +
				"Read it before clicking: it is how you find out what is actually on screen. " +
				"Canvas shapes are pixels and do NOT appear here — call boardmix_shot for those. " +
				"Requires the panel to be open; it never opens one for you.",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string", description: "Case-insensitive substring filter on control labels." },
					limit: { type: "number", description: "How many controls to return, 1–80. Defaults to 40." },
				},
				additionalProperties: false,
			},
			scope_use: [...TOOL_SCOPE],
			timeoutMs: 30_000,
			handler: async ({ trigger }) => {
				const handle = boardmixTab();
				if (!handle) return failure("no-tab", { next: NO_TAB });
				const missing = primitivesMissing(handle);
				if (missing) return missing;
				const outline = await outlineOf(handle);
				if (!outline) return failure("read-failed", { next: "Read the panel again; the page may be mid-navigation." });

				const query = typeof trigger.input?.query === "string" ? trigger.input.query.trim().toLowerCase() : "";
				const limit = Math.min(Math.max(Math.round(trigger.input?.limit ?? 40), 1), 80);
				const all = Array.isArray(outline.items) ? outline.items : [];
				const matched = query ? all.filter(item => item.label.toLowerCase().includes(query)) : all;
				return JSON.stringify({
					ok: true,
					url: outline.url ?? "",
					title: outline.title ?? "",
					login: outline.login === true,
					readyState: outline.readyState ?? "",
					size: outline.size ?? null,
					scroll: outline.scroll ?? null,
					total: all.length,
					shown: Math.min(matched.length, limit),
					items: matched.slice(0, limit),
					text: outline.text ?? "",
					next:
						all.length === 0
							? "No controls matched the selector: the page is probably still painting, or it is a canvas-only screen. Call boardmix_shot."
							: "Click with boardmix_act using the x,y of an item.",
				});
			},
		}),
	);

	// ------------------------------------------------------------------ shot
	disposables.push(
		ctx.agent.registerTool<{ preview?: boolean }>({
			id: TOOL_IDS.shot,
			label: "%tool.shot.label%",
			description:
				"Capture what the Boardmix panel is showing as a PNG, save it inside the project " +
				"(`.boardmix/shots/`, newest four kept) and open it in Astravia's own previewer so the user sees the " +
				"board too. Then read the returned path to look at the picture yourself — whiteboards, diagrams and " +
				"slides exist only as pixels, so this is the only way to see what the user sees. " +
				"Requires the panel to be open.",
			parameters: {
				type: "object",
				properties: {
					preview: {
						type: "boolean",
						description: "Open the capture in Astravia's previewer. Defaults to true.",
					},
				},
				additionalProperties: false,
			},
			scope_use: [...TOOL_SCOPE],
			timeoutMs: 40_000,
			handler: async ({ trigger }) => {
				const handle = boardmixTab();
				if (!handle) return failure("no-tab", { next: NO_TAB });
				const missing = primitivesMissing(handle);
				if (missing) return missing;
				if (!boardmixWorkspace()) {
					return failure("no-workspace", {
						next: "Open the Boardmix panel once in this project so it can report where to save the image.",
					});
				}
				const shot = await saveBoardmixShot(ctx, handle, "view");
				if (!shot) return failure("shot-failed", { next: "Retry once the panel has finished loading." });
				const previewed = trigger.input?.preview === false ? false : showToUser(ctx, shot.path, shot.name);
				return JSON.stringify({
					ok: true,
					path: shot.path,
					name: shot.name,
					bytes: shot.bytes,
					previewed,
					next: "Read that PNG to see the board. It is a picture: it shows what is drawn but not the layer tree.",
				});
			},
		}),
	);

	// ------------------------------------------------------------------- act
	disposables.push(
		ctx.agent.registerTool<{ steps: unknown[]; settle_ms?: number }>({
			id: TOOL_IDS.act,
			label: "%tool.act.label%",
			description:
				"Drive the Boardmix panel with real mouse and keyboard input: click at the x,y that boardmix_read " +
				"printed, type into a focused field, press a key, scroll, or wait. Steps run in order and the result " +
				"reports every one. Read the page first — a click needs a point that exists. " +
				"Boardmix is a normal web app, so these are the same events a person produces: menus open, dialogs " +
				"appear, forms submit. Nothing is faked, and nothing is guaranteed: after acting, read or capture " +
				"again to confirm what actually changed instead of assuming it worked.",
			parameters: {
				type: "object",
				properties: {
					steps: { type: "array", minItems: 1, maxItems: STEP_LIMIT, items: STEP_SCHEMA },
					settle_ms: {
						type: "number",
						description: "Pause after each click in milliseconds, 50–3000. Defaults to 400.",
					},
				},
				required: ["steps"],
				additionalProperties: false,
			},
			scope_use: [...TOOL_SCOPE],
			timeoutMs: 90_000,
			handler: async ({ trigger }) => {
				const handle = boardmixTab();
				if (!handle) return failure("no-tab", { next: NO_TAB });
				const missing = primitivesMissing(handle);
				if (missing) return missing;

				const parsed = readSteps(trigger.input?.steps);
				if (typeof parsed === "string") {
					return failure(parsed, { next: "Fix that step and send the batch again; nothing was sent to the page." });
				}
				const base = Math.min(Math.max(Math.round(trigger.input?.settle_ms ?? 400), 50), 3000);

				const trail: Array<{ index: number; label: string; ok: boolean }> = [];
				let stoppedAt: number | null = null;
				for (let index = 0; index < parsed.length; index += 1) {
					const step: BoardmixStep = parsed[index];
					const sent = step.op === "wait" ? true : handle.input(eventsFor(step));
					trail.push({ index, label: labelOf(step), ok: sent });
					if (!sent) {
						stoppedAt = index;
						break;
					}
					await sleep(settleMsFor(step, base));
				}

				const outline = await outlineOf(handle);
				return JSON.stringify({
					ok: stoppedAt === null,
					steps: trail,
					stoppedAt,
					url: outline?.url ?? "",
					title: outline?.title ?? "",
					login: outline?.login === true,
					next:
						stoppedAt === null
							? "Read the page again (boardmix_read) or capture it (boardmix_shot) to confirm the result."
							: "The input channel refused that step; the page did not receive it.",
				});
			},
		}),
	);

	return disposables;
}
