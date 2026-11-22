/**
 * 面板写入的每一份状态：路径、作用域，以及它到底是什么。
 *
 * 为什么集中一处：路径此前散在多个 hook 里，其中提示词库还用的是裸键
 * （`prompt-library` / `prompt-backups`），而设置页展示的是 `workbench/prompt-library.json`
 * —— 页面写的落点和真实落点不是同一个文件。用户按页面上的路径去清，清不掉。
 *
 * 三个作用域是产品决定，不是实现细节：
 *   - `session`：本次对话自己的东西 —— 草稿、报告库、探测记录、宿主模型快照。
 *     换一个会话看不见，这是「串会话」的最后一道防线；跨会话的唯一合法通道是用户
 *     显式「沉淀到我的案例」。
 *   - `workspace`：这个工作区里的**成果沉淀**（我的案例）。同一工作区的会话共享，
 *     换一个项目看不见。
 *   - `plugin`：用户自己的**偏好与收藏**（设置、提示词库、备份、实验环境开关）。
 *     换项目仍带着走。
 */

export type StorageScope = "session" | "workspace" | "plugin";

export interface StorageEntry {
	/** 逻辑键，界面按它取标题；同时是清理时的标识。 */
	key: StorageKey;
	scope: StorageScope;
	/** 存储内的相对路径（已按作用域展开，可直接交给宿主 API）。 */
	path: string;
	/** 读到旧位置时用的路径；没有则为 null。 */
	legacyPath: string | null;
}

export type StorageKey =
	| "drafts"
	| "library"
	| "probeRecord"
	| "cases"
	| "settings"
	| "labMode"
	| "prompts"
	| "promptBackups";

const ROOT = "workbench";
const WORKSPACES = `${ROOT}/workspaces`;
const SESSIONS = `${ROOT}/sessions`;

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
 * 键 = 可读前缀 + 短哈希。
 *
 * 只取可读前缀会让 `/a/b` 与 `/a_b` 撞到同一个目录，两份数据就混在一起了；
 * 只用哈希则人看不懂自己那份数据在哪。两者都要。
 */
function scopedKey(raw: string | null | undefined, fallback: string): string {
	const value = (raw ?? "").trim();
	if (value.length === 0) return fallback;
	const slug = value
		.replace(/[\\/]+/g, "-")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase()
		.slice(-32);
	return `${slug.length > 0 ? slug : "root"}-${hash32(value)}`;
}

export function workspaceKey(cwd: string | null | undefined): string {
	return scopedKey(cwd, "default");
}

/**
 * 会话键。`null` 表示「宿主还没给会话 id」——那种情况下草稿进 `unsessioned`
 * 分区，而不是并进某个真实会话：宁可让用户看到「这个会话的草稿」是空的，
 * 也不要把 A 会话的草稿端到 B 会话面前。
 */
export function sessionKey(sessionId: string | null | undefined): string {
	return scopedKey(sessionId, "unsessioned");
}

function workspaceFile(file: string, cwd: string | null | undefined): string {
	return `${WORKSPACES}/${workspaceKey(cwd)}/${file}.json`;
}

function sessionFile(file: string, sessionId: string | null | undefined): string {
	return `${SESSIONS}/${sessionKey(sessionId)}/${file}.json`;
}

/**
 * 全部落点。顺序即界面顺序：先本次会话，再本工作区，最后偏好。
 *
 * `legacyPath` 有两个来源，都是真实历史：
 *   - 产物改成按工作区分文件（`workbench/library.json`）；
 *   - 提示词库此前用裸键（`prompt-library`），与设置页展示的路径不一致。
 */
export function storageEntries(cwd: string | null | undefined, sessionId?: string | null): StorageEntry[] {
	return [
		{ key: "drafts", scope: "session", path: sessionFile("drafts", sessionId), legacyPath: null },
		// 报告属于产生它的那次对话：换会话再看到上一段的报告，就是「串会话」本身。
		{ key: "library", scope: "session", path: sessionFile("library", sessionId), legacyPath: null },
		// 旧位置仍列出来，只为了能清掉（不清就永远占着地方，用户还以为会话里那份还在）。
		{ key: "probeRecord", scope: "session", path: sessionFile("probe", sessionId), legacyPath: null },
		{ key: "cases", scope: "workspace", path: workspaceFile("cases", cwd), legacyPath: `${ROOT}/cases.json` },
		{ key: "settings", scope: "plugin", path: `${ROOT}/settings.json`, legacyPath: null },
		{ key: "labMode", scope: "plugin", path: `${ROOT}/lab-mode.json`, legacyPath: null },
		{ key: "prompts", scope: "plugin", path: `${ROOT}/prompt-library.json`, legacyPath: "prompt-library" },
		{ key: "promptBackups", scope: "plugin", path: `${ROOT}/prompt-backups.json`, legacyPath: "prompt-backups" },
	];
}

export function storageEntry(key: StorageKey, cwd: string | null | undefined, sessionId?: string | null): StorageEntry {
	const found = storageEntries(cwd, sessionId).find(entry => entry.key === key);
	if (!found) throw new Error(`unknown storage key: ${key}`);
	return found;
}

/** 清理范围：本次会话草稿 / 全部产物 / 全部 / 单项。界面只给这几种，不做逐文件勾选。 */
export function pathsToClear(
	cwd: string | null | undefined,
	scope: StorageScope | "all",
	sessionId?: string | null,
): string[] {
	return storageEntries(cwd, sessionId)
		.filter(entry => scope === "all" || entry.scope === scope)
		.flatMap(entry => (entry.legacyPath ? [entry.path, entry.legacyPath] : [entry.path]));
}

/**
 * 存储占用的前缀。界面按它去问「这个插件到底占了多少」：
 * 前缀是真实的目录段，不是我们以为的文件名，所以统计结果能对上 `list` 的输出。
 */
export function usagePrefixes(cwd: string | null | undefined, sessionId?: string | null): string[] {
	return [
		`${SESSIONS}/${sessionKey(sessionId)}`,
		`${WORKSPACES}/${workspaceKey(cwd)}`,
		`${ROOT}`,
	];
}
