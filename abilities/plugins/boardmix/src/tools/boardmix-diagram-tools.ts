import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { planDiagram, stripFence } from "../domain/boardmix-diagram";
import { canvasPasteScript } from "../domain/boardmix-page-scripts";
import { saveBoardmixShot } from "../features/boardmix-workspace/services/boardmix-shot";
import { boardmixTab } from "../features/boardmix-workspace/services/tab-registry";
import { boardmixWorkspace } from "../features/boardmix-workspace/services/workspace-cwd";
import { TOOL_IDS } from "../plugin-ids";

const TOOL_SCOPE = ["conversation", "project"] as const;

/** Mermaid 源文件的落点。文件名由内容推出来，不覆盖同名文件之外的东西。 */
export const DIAGRAM_DIR = ".boardmix/diagrams";

function join(dir: string, name: string): string {
	return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

function failure(reason: string, extra: Record<string, unknown> = {}): string {
	return JSON.stringify({ ok: false, open: boardmixTab() !== null, reason, ...extra });
}

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

/**
 * `boardmix_diagram`：把 Mermaid 交给产品自己的转换器。
 *
 * 两段式，故意不合成一步：
 *   1. 默认只**落盘**（`.boardmix/diagrams/<name>.mmd`）并回一条导入路径。用户随时能用它。
 *   2. `apply: true` 时再往画布投一次真实粘贴，然后拍一张图——图没看见，就不算画上。
 *
 * 为什么不直接调画布 API：那套 `createSticky` 对象模型不在页面全局上（ADR bm-0001）。
 * 为什么不叫它"生成图形"：转换是 Boardmix 做的，我们只递了源文件（ADR bm-0002）。
 */
export function registerDiagramTool(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool<{
			text: string;
			title?: string;
			limit?: number;
			apply?: boolean;
			preview?: boolean;
		}>({
			id: TOOL_IDS.diagram,
			label: "%tool.diagram.label%",
			description:
				"Turn Mermaid source into a real Boardmix diagram. Step one writes the `.mmd` into the project and " +
				"tells the user where it is; step two (`apply: true`) pastes it onto the canvas so Boardmix's own " +
				"Mermaid importer creates editable shapes, then captures a PNG. " +
				"Pass the Mermaid body — flowchart / graph / sequenceDiagram / erDiagram / classDiagram / pie / quadrantChart, " +
				"the six kinds the product documents. The reply reports the shape estimate against the account's element " +
				"limit, whether the paste was accepted, and the shot path. " +
				"Read that PNG before saying anything landed: the conversion is Boardmix's, and the canvas is pixels to us. " +
				"Without `apply` nothing is drawn — that is the default on purpose.",
			parameters: {
				type: "object",
				properties: {
					text: { type: "string", description: "Mermaid source, with or without a ```mermaid fence." },
					title: { type: "string", description: "File name to save under; defaults to the diagram's own title." },
					limit: {
						type: "number",
						description: "Element budget to compare against. Defaults to 150 (the free tier's per-file limit).",
					},
					apply: {
						type: "boolean",
						description: "Paste it onto the canvas now. Defaults to false: stage the file and hand over the path.",
					},
					preview: { type: "boolean", description: "Open the shot in Astravia's previewer. Defaults to true." },
				},
				required: ["text"],
				additionalProperties: false,
			},
			scope_use: [...TOOL_SCOPE],
			timeoutMs: 60_000,
			handler: async ({ trigger }) => {
				const input = trigger.input ?? { text: "" };
				const plan = planDiagram({ text: input.text, title: input.title, limit: input.limit });

				if (!plan.accepted) {
					return failure(plan.reason ?? "rejected", {
						next:
							plan.reason === "text-required"
								? "Write the Mermaid first (that is your deliverable), then call this with it."
								: plan.reason?.startsWith("not-mermaid")
									? "Rewrite the first line as one of the six supported kinds; prose and DOT are not Mermaid."
									: "Add at least one node and one edge — a bare declaration converts to nothing.",
					});
				}

				const cwd = boardmixWorkspace();
				if (!cwd) {
					return failure("no-workspace", {
						next: "Open the Boardmix panel once in this project so the file has somewhere to land.",
					});
				}

				const dir = join(cwd, DIAGRAM_DIR);
				const path = join(dir, plan.fileName);
				try {
					await ctx.fs.createDirectory(dir);
				} catch {
					/* 已存在是常态；写失败会在下面报出来 */
				}
				const source = `${stripFence(String(input.text))}\n`;
				try {
					await ctx.fs.writeFile(path, source, "utf8");
				} catch (error) {
					return failure("write-failed", {
						detail: String((error as Error)?.message ?? error),
						next: "Pick a different title, or check that the project directory is writable.",
					});
				}

				const staged = {
					path,
					kind: plan.kind,
					elements: plan.elements,
					overBudget: plan.reason?.startsWith("over-budget") === true,
				};

				if (input.apply !== true) {
					return JSON.stringify({
						ok: true,
						applied: false,
						staged,
						next:
							`Saved ${plan.fileName} (${plan.elements} elements, ${plan.kind}). ` +
							"Hand the user that path and the panel entry that imports it, or call again with apply: true " +
							"to paste it onto the canvas.",
					});
				}

				const handle = boardmixTab();
				if (!handle) {
					return JSON.stringify({
						ok: true,
						applied: false,
						staged,
						reason: "no-tab",
						next: "The file is saved. Call boardmix_open, then call this again with apply: true.",
					});
				}

				const gaps = handle.gaps();
				if (gaps.length > 0) {
					return JSON.stringify({ ok: false, applied: false, staged, reason: "primitive-unavailable", gaps });
				}

				const result = await handle.read(canvasPasteScript(source));
				const accepted =
					!!result && typeof result === "object" && (result as { ok?: unknown }).ok === true;

				const shot = await saveBoardmixShot(ctx, handle, "diagram");
				const previewed = shot ? (input.preview === false ? false : showToUser(ctx, shot.path, shot.name)) : false;

				return JSON.stringify({
					ok: accepted,
					applied: accepted,
					staged,
					paste: result ?? null,
					shot: shot?.path ?? null,
					previewed,
					next: accepted
						? "Read that PNG. If the shapes are not there, the canvas did not take the paste: hand the user the " +
							".mmd path instead of pasting again."
						: "The paste did not reach the canvas. Give the user the .mmd path and the import entry; do not repeat " +
							"the same paste.",
				});
			},
		}),
	];
}
