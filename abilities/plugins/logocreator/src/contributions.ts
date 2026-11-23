/**
 * Every string this plugin hands to the host for rendering.
 *
 * They live here, not inline at the call sites, because the host resolves a
 * `%key%` only when the plugin's own catalog is loaded and the key is present:
 * a missing key falls back to the **bare key**, so the composer chip and the tab
 * read `panel.title` instead of `LogoCreator`. One module means one place to check,
 * one loop to test, and no label that quietly drifted away from the catalog.
 */
export const PLUGIN_NAME_KEY = "%name%";
export const TAB_LABEL_KEY = "%tab.label%";
export const INPUT_ACTION_LABEL_KEY = "%panel.title%";
/**
 * 身份字符串用**字面值**，不用 `%key%`。
 *
 * `skillPresentation.displayName` 与编辑器标签这些会进了消息 token / 历史记录的地方，
 * 一旦宿主某条路径没解析 `%…%`，用户看到的就是 `%name%`（实际发生过）。
 * 能力卡与 tab 仍走 `%tab.label%`：它们在每次渲染时都重新解析，且有测试盯。
 */
export const SKILL_DISPLAY_NAME = "LogoCreator";
export const OPEN_FOLDER_LABEL_KEY = "%fileExplorer.openDesign%";

export const TOOL_LABELS = {
	design: "%tool.design.label%",
	kit: "%tool.kit.label%",
	catalog: "%tool.catalog.label%",
	notes: "%tool.notes.label%",
	plan: "%tool.plan.label%",
	image: "%tool.image.label%",
} as const;

/**
 * Card renderer type. Must be globally unique across plugins, hence the plugin id
 * prefix — the same convention the host documents for `image-gen:preview`.
 */
export const IMAGE_CARD_TYPE = "logocreator:image";

/** Input-action id. The host prefixes it with `<pluginId>:`, so it must not repeat the plugin id. */
export const INPUT_ACTION_ID = "brand";

/** Every `%key%` above, for the catalog-completeness test. */
export const CONTRIBUTION_LABEL_KEYS = [
	OPEN_FOLDER_LABEL_KEY,
	PLUGIN_NAME_KEY,
	TAB_LABEL_KEY,
	INPUT_ACTION_LABEL_KEY,
	...Object.values(TOOL_LABELS),
] as const;

/** Strip the `%…%` wrapper: the host's resolver wants the bare catalog key. */
export function catalogKey(raw: string): string {
	const match = /^%([^%]+)%$/.exec(raw);
	return match ? match[1] : raw;
}
