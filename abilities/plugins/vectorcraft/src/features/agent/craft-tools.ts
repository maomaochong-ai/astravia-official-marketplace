import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../../app.config.ts";
import { parse } from "../../domain/kernel-document.ts";
import { craftEngine, publishCraftProgress, waitForCraftEngine } from "../editor/session-registry.ts";
import type { ActStep, KernelEngine } from "../editor/kernel/engine.ts";

/**
 * The tool surface: five tools, one of which (`act`) carries the whole gesture
 * vocabulary.
 *
 * Every tool here works on the document, not on pixels. `click` selects the shape at
 * a point, `set` patches the selection, `align` lays shapes out — so a batch is a
 * short, reviewable list of edits rather than a script of mouse coordinates that
 * breaks the moment a window is resized.
 *
 * A tool result reaches the model as text only. That is why `act` returns the text map
 * and the mean colour before and after: a change is measured, not assumed.
 *
 * ADR: docs/adr/<slug>/craft-0009-one-batch-and-a-text-map.md
 * ADR: docs/adr/<slug>/craft-0011-the-engine-is-ours.md
 */

const SCOPE = ["conversation", "project"] as const;

function text(payload: unknown): string {
	return JSON.stringify(payload, null, 2);
}

const STEP_SCHEMA = {
	type: "object",
	required: ["op"],
	additionalProperties: false,
	properties: {
		op: {
			type: "string",
			enum: [
				"label",
				"ready",
				"wait",
				"move",
				"click",
				"drag",
				"type",
				"key",
				"insert",
				"set",
				"delete",
				"select",
				"arrange",
				"align",
				"save",
				"capture",
			],
			description:
				"insert adds a shape (`kind` + optional `patch`), set patches the selection (`patch`), " +
				"click selects what is at `x`,`y`, drag moves the selection by a delta, type writes text, " +
				"key presses a shortcut, arrange/align reorder or align, save exports a PNG and capture only narrates.",
		},
		label: { type: "string", description: "What this step does, in the user's language." },
		x: { type: "number", description: "Horizontal page fraction, 0 (left) to 1 (right)." },
		y: { type: "number", description: "Vertical page fraction, 0 (top) to 1 (bottom)." },
		x2: { type: "number" },
		y2: { type: "number" },
		kind: { type: "string", enum: ["rect", "ellipse", "line", "text", "image"] },
		patch: {
			type: "object",
			description:
				"Shape fields: x, y, w, h, fill, stroke, strokeWidth, radius, opacity, text, fontSize, color, align, src.",
			additionalProperties: true,
		},
		text: { type: "string" },
		key: { type: "string", description: '"Delete", "Escape", "cmd+z", "cmd+d", "cmd+a".' },
		ids: { type: "array", items: { type: "string" } },
		mode: {
			type: "string",
			description: "arrange: front|back|forward|backward. align: left|center-x|right|top|middle|bottom|distribute-x|distribute-y.",
		},
		ms: { type: "number" },
		region: { type: "string", enum: ["all", "page", "selection"] },
		columns: { type: "number" },
		rows: { type: "number" },
		save: { type: "boolean" },
		name: { type: "string" },
	},
} as const;

function describe(engine: KernelEngine) {
	const document = engine.document();
	return {
		mode: document.mode,
		size: `${document.width}×${document.height}`,
		shapes: document.shapes.filter((shape) => !shape.locked).length,
		selection: engine.formatSelection(),
		zoom: Math.round(engine.zoom() * 100),
		dirty: engine.dirty(),
	};
}

function probeOf(engine: KernelEngine, options: { region?: string; columns?: number; rows?: number }) {
	const probe = engine.probe(options);
	if (!probe) return null;
	return {
		region: probe.region,
		size: `${probe.columns}×${probe.rows}`,
		mean: probe.mean,
		meanRgb: probe.meanRgb,
		contrast: probe.contrast,
		cells: probe.cells,
	};
}

function unavailable(id: string) {
	return text({
		open: false,
		error: "tab-not-open",
		next: `Call ${id}_open_editor first; the tab has to be mounted before there is an engine to drive.`,
	});
}

export function registerCraftTools(ctx: PluginContext): Disposable[] {
	const id = APP.id;
	const disposables: Disposable[] = [];

	disposables.push(
		ctx.agent.registerTool({
			id: `${id}_open_editor`,
			label: "%tool.open%",
			description:
				`Open the ${APP.name} editor in an Astravia activity tab and report whether it mounted. ` +
				`Use this first when the user wants to design, lay out or arrange something; every other ${APP.name} ` +
				`tool needs the tab open. Opening does not touch the user's document.`,
			parameters: { type: "object", properties: {}, additionalProperties: false },
			scope_use: [...SCOPE],
			timeoutMs: 20000,
			async handler() {
				ctx.ui.openActivityTab(APP.tabId, { width: "max" });
				const engine = await waitForCraftEngine(8000);
				if (!engine) {
					return text({ open: true, ready: false, error: "tab-did-not-register-engine" });
				}
				return text({
					open: true,
					ready: true,
					page: describe(engine),
					probe: probeOf(engine, { columns: 24, rows: 12 }),
					next: `Call ${id}_act to change the page; read the returned map after each batch.`,
				});
			},
		}),
	);

	disposables.push(
		ctx.agent.registerTool({
			id: `${id}_editor_status`,
			label: "%tool.status%",
			description:
				`Report the current ${APP.name} page without changing it: surface, page size, shape count, ` +
				`selection, zoom, whether it is saved, and a coarse text map of the canvas. Read-only.`,
			parameters: {
				type: "object",
				properties: {
					region: { type: "string", enum: ["all", "page", "selection"] },
					columns: { type: "number", description: "Map width in cells, 4–64. Defaults to 32." },
					rows: { type: "number", description: "Map height in cells, 2–36. Defaults to 18." },
				},
				additionalProperties: false,
			},
			scope_use: [...SCOPE],
			timeoutMs: 15000,
			async handler(context) {
				const engine = craftEngine();
				if (!engine) return unavailable(id);
				const input = (context.trigger.input ?? {}) as { region?: string; columns?: number; rows?: number };
				return text({ open: true, ready: true, page: describe(engine), probe: probeOf(engine, input) });
			},
		}),
	);

	disposables.push(
		ctx.agent.registerTool({
			id: `${id}_act`,
			label: "%tool.act%",
			description:
				`Run an ordered batch of edits against the ${APP.name} page, then report the text map and average ` +
				`colour before and after so the change is measurable. Coordinates are page fractions (0–1). Prefer ` +
				`semantic steps (insert / set / align / select) over click-drag; use click and drag when the user is ` +
				`talking about something already on the page.`,
			parameters: {
				type: "object",
				properties: {
					steps: { type: "array", items: STEP_SCHEMA, description: "1–40 steps, run in order." },
					stopOnError: { type: "boolean", description: "Defaults to true." },
					region: { type: "string", enum: ["all", "page", "selection"] },
					columns: { type: "number" },
					rows: { type: "number" },
				},
				required: ["steps"],
				additionalProperties: false,
			},
			scope_use: [...SCOPE],
			timeoutMs: 120000,
			async handler(context) {
				const engine = craftEngine() ?? (await waitForCraftEngine(3000));
				if (!engine) return unavailable(id);
				const input = (context.trigger.input ?? {}) as {
					steps?: ActStep[];
					stopOnError?: boolean;
					region?: string;
					columns?: number;
					rows?: number;
				};
				const steps = Array.isArray(input.steps) ? input.steps.slice(0, 40) : [];
				if (steps.length === 0) return text({ ok: false, error: "no-steps" });

				engine.onProgress = (progress) => publishCraftProgress(progress);
				try {
					const report = await engine.act(steps, input.stopOnError !== false);
					const saved: string[] = [];
					for (const step of steps) {
						if (step.op !== "save") continue;
						const png = engine.png();
						if (!png) continue;
						const name = step.name ?? `${APP.name}-${Date.now()}`;
						const path = await ctx.fs.saveAs(`${name}.png`, png.replace(/^data:image\/png;base64,/, ""), "base64", {
							title: "保存画布",
							filters: [{ name: "PNG", extensions: ["png"] }],
						});
						if (path) saved.push(path);
					}
					return text({
						ok: report.ok,
						elapsedMs: report.elapsedMs,
						steps: report.steps,
						page: describe(engine),
						change: report.change,
						probe: probeOf(engine, { region: input.region, columns: input.columns, rows: input.rows }),
						saved,
					});
				} finally {
					engine.onProgress = undefined;
					publishCraftProgress(null);
				}
			},
		}),
	);

	disposables.push(
		ctx.agent.registerTool({
			id: `${id}_probe`,
			label: "%tool.probe%",
			description:
				`Read the ${APP.name} canvas as text: one letter per cell (colour family, upper case is light), ` +
				`the mean colour and a contrast figure. Use it to check whether anything is on the page or whether ` +
				`the last change landed.`,
			parameters: {
				type: "object",
				properties: {
					region: { type: "string", enum: ["all", "page", "selection"] },
					columns: { type: "number", description: "4–64, defaults to 32." },
					rows: { type: "number", description: "2–36, defaults to 18." },
				},
				additionalProperties: false,
			},
			scope_use: [...SCOPE],
			timeoutMs: 15000,
			async handler(context) {
				const engine = craftEngine();
				if (!engine) return unavailable(id);
				const input = (context.trigger.input ?? {}) as { region?: string; columns?: number; rows?: number };
				const probe = probeOf(engine, input);
				if (!probe) return text({ open: true, probe: null, error: "canvas-not-painted" });
				return text({ open: true, probe });
			},
		}),
	);

	disposables.push(
		ctx.agent.registerTool({
			id: `${id}_open_document`,
			label: "%tool.document%",
			description:
				`Load a ${APP.name} project JSON from the workspace into the open tab and report what it contains. ` +
				`The file must be a document this plugin exported; anything else is refused rather than half-imported.`,
			parameters: {
				type: "object",
				properties: {
					path: { type: "string", description: "Workspace-relative path to the .json project." },
				},
				required: ["path"],
				additionalProperties: false,
			},
			scope_use: [...SCOPE],
			timeoutMs: 30000,
			async handler(context) {
				const engine = craftEngine() ?? (await waitForCraftEngine(3000));
				if (!engine) return unavailable(id);
				const input = (context.trigger.input ?? {}) as { path?: string };
				if (!input.path) return text({ ok: false, error: "path-required" });
				try {
					const read = await ctx.fs.readFile(input.path);
					const raw = read.encoding === "base64" ? atob(read.content) : read.content;
					const document = parse(raw, engine.document());
					if (document.shapes.length === 0 && !raw.includes("\"shapes\"")) {
						return text({ ok: false, error: "not-a-craft-document", path: input.path });
					}
					engine.setDocument({ ...document, mode: engine.document().mode });
					return text({ ok: true, path: input.path, page: describe(engine) });
				} catch (error) {
					return text({ ok: false, error: String((error as Error)?.message ?? error) });
				}
			},
		}),
	);

	return disposables;
}
