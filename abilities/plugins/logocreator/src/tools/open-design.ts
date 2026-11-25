import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { isDesignFolder } from "../domain/design-folder";
import { getPluginContext } from "../plugin-context";
import { openDesignFolder } from "../features/canvas/open-folder";
import { TOOL_LABELS } from "../contributions";
import { TOOL_OPEN_DESIGN } from "../tab-ids";

interface OpenDesignPayload {
	folder: string;
}

/**
 * `logocreator_open_design` — 打开项目里已有的设计包。
 *
 * 没有这个工具时，「打开某个 `.logocreator-design`」只能由用户在文件树里右键完成；
 * 对话里 agent 只能在生成后靠 reveal 打开**刚生成的那份**，上一个会话留下的包它够不着。
 *
 * 工具只做打开与载入，不重新渲染、不覆盖文件：打开一份稿是读操作。
 */
export function createOpenDesignTool(): PluginAgentToolRegistration<OpenDesignPayload> {
	return {
		id: TOOL_OPEN_DESIGN,
		name: TOOL_OPEN_DESIGN,
		label: TOOL_LABELS.openDesign,
		description: [
			"Open an existing `<slug>.logocreator-design/` package on disk in the canvas, the same way right-clicking it in the file tree does.",
			"Use it when the user names a design folder, asks to reopen a previous design, or after you listed the project and found one — not to create a new design (that is `logocreator_design`).",
			"The folder must be a `*.logocreator-design` package this plugin wrote; the tool reads `design.astravia-log` inside it and loads that spec.",
			"If the folder does not exist or the manifest is unreadable, the tool says which of the two it was and does not touch anything.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				folder: {
					type: "string",
					description:
						"Design package folder relative to the project root (or absolute inside it), e.g. `acme.logocreator-design` or `brands/acme.logocreator-design`.",
				},
			},
			required: ["folder"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger, session }) => {
			const raw = String(trigger.input?.folder ?? "").trim();
			if (!raw) return { opened: false, error: "`folder` is required." };

			const folder = raw.replace(/\\/g, "/").replace(/\/+$/, "");
			if (!isDesignFolder(folder)) {
				return {
					opened: false,
					error: `Not a design package: \`${folder}\`. A package folder ends with \`.logocreator-design\` — open it in the file tree to see the real name.`,
				};
			}

			const result = await openDesignFolder(getPluginContext(), folder);
			if (!result.opened) {
				return {
					opened: false,
					error:
						result.error === "manifest-unreadable"
							? `The package exists but its \`design.astravia-log\` could not be read: \`${folder}\`.`
							: `The canvas could not be opened: ${result.error ?? "unknown"}.`,
				};
			}

			return {
				opened: true,
				folder,
				designId: result.designId,
				notes: [
					`The canvas is now showing ${folder}. Its spec is loaded, so follow-up edits and \`logocreator_brand_kit\` apply to this design.`,
					session.cwd ? "" : "No workspace root was reported, so the folder path was used as given.",
				].filter(Boolean),
			};
		},
	};
}
