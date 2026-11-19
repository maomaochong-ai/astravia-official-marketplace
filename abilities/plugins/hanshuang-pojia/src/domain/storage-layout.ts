/**
 * 面板写入的每一份状态：路径、作用域、以及它到底是什么。
 *
 * 为什么要集中一处：路径此前散在三个 hook 里（`workbench/library.json`、
 * `workbench/settings.json`、`workbench/lab-mode.json` 与两处提示词键）。结果是
 * 设置页没法把「插件到底写了什么」列全，也没法只清其中一项——用户只能整体删插件。
 *
 * 作用域是产品决定，不是实现细节：
 *   - `workspace`：这个工作区里的**产物**（样本库、我的案例）。换一个项目不该看到上一个
 *     项目的分析结果，否则就是串会话。
 *   - `plugin`：用户自己的**偏好与收藏**（设置、提示词库、实验环境开关）。换项目仍然带着走，
 *     在这里改成每工作区一份，用户会以为提示词丢了。
 */

export type StorageScope = "workspace" | "plugin";

export interface StorageEntry {
	/** 逻辑键，界面按它取标题；同时是清理时的标识。 */
	key: StorageKey;
	scope: StorageScope;
	/** 存储内的相对路径（已按作用域展开，可直接交给宿主 API）。 */
	path: string;
	/** 读到旧位置时用的路径；没有则为 null。 */
	legacyPath: string | null;
}

export type StorageKey = "library" | "cases" | "settings" | "labMode" | "prompts" | "promptBackups";

const ROOT = "workbench";
const WORKSPACES = `${ROOT}/workspaces`;

/**
 * 32 位 FNV-1a。用途只有一个：让 `a/b` 与 `a_b` 得到不同的键。
 * 它不是安全哈希，也不需要是——这里防的是「两个路径折叠成同一个目录」。
 */
function hash32(value: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0");
}

/**
 * 工作区键：可读前缀 + 短哈希。
 *
 * 只取可读前缀会让 `/a/b` 与 `/a_b` 撞到同一个目录，两个项目的产物就混在一起了；
 * 只用哈希则人看不懂自己那份数据在哪。两者都要。
 */
export function workspaceKey(cwd: string | null | undefined): string {
	const raw = (cwd ?? "").trim();
	if (raw.length === 0) return "default";
	const slug = raw
		.replace(/[\\/]+/g, "-")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase()
		.slice(-32);
	return `${slug.length > 0 ? slug : "root"}-${hash32(raw)}`;
}

function workspaceFile(file: string, cwd: string | null | undefined): string {
	return `${WORKSPACES}/${workspaceKey(cwd)}/${file}.json`;
}

/**
 * 全部落点。顺序即界面顺序：先产物，后偏好。
 *
 * `legacyPath` 只给改成按工作区分文件的项用：老版本写在插件根下，升级后要能读回来，
 * 读不到就当成空，不能把用户的样本库静默丢掉。
 */
export function storageEntries(cwd: string | null | undefined): StorageEntry[] {
	return [
		{ key: "library", scope: "workspace", path: workspaceFile("library", cwd), legacyPath: `${ROOT}/library.json` },
		{ key: "cases", scope: "workspace", path: workspaceFile("cases", cwd), legacyPath: `${ROOT}/cases.json` },
		{ key: "settings", scope: "plugin", path: `${ROOT}/settings.json`, legacyPath: null },
		{ key: "labMode", scope: "plugin", path: `${ROOT}/lab-mode.json`, legacyPath: null },
		{ key: "prompts", scope: "plugin", path: `${ROOT}/prompt-library.json`, legacyPath: null },
		{ key: "promptBackups", scope: "plugin", path: `${ROOT}/prompt-backups.json`, legacyPath: null },
	];
}

export function storageEntry(key: StorageKey, cwd: string | null | undefined): StorageEntry {
	const found = storageEntries(cwd).find(entry => entry.key === key);
	if (!found) throw new Error(`unknown storage key: ${key}`);
	return found;
}

/** 清理范围：全部产物 / 全部 / 单项。界面只给这三种，不做逐文件勾选。 */
export function pathsToClear(cwd: string | null | undefined, scope: StorageScope | "all"): string[] {
	return storageEntries(cwd)
		.filter(entry => scope === "all" || entry.scope === scope)
		.flatMap(entry => (entry.legacyPath ? [entry.path, entry.legacyPath] : [entry.path]));
}
