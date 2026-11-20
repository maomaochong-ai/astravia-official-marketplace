/**
 * `install-state.json`：装过什么，就按什么还原。
 *
 * 上游桌面版靠这份清单做到「卸载后 `config.toml` 与安装前逐字节一致」。
 * 插件侧同样需要它，因为注入点分布在 `$HOME` 的多个位置，而插件读不到那些文件：
 * 唯一可靠的还原依据是**装的时候记下来的那一份**。
 *
 * 两条设计约束：
 *   - 坏输入返回空状态而不是抛错 —— 这份文件会被用户手改，解析失败不该让界面崩；
 *   - 不按路径模式猜「哪些是本工具装的」—— 猜错就会删掉用户自己的东西。
 */

export const INSTALL_STATE_VERSION = 1;

export interface InstallStateEntry {
	target: string;
	form: string;
	/** 本次写过的文件（不含只改配置键的目标）。 */
	files: string[];
	/** 备份文件的通配前缀，还原时按最新一份取。 */
	backups: string[];
	/** 是否用了标记块（决定能否「只摘块」）。 */
	markerBlock: boolean;
	packLabel: string;
	installedAt: string;
}

export interface InstallState {
	version: number;
	entries: InstallStateEntry[];
}

export const EMPTY_INSTALL_STATE: InstallState = { version: INSTALL_STATE_VERSION, entries: [] };

/** 宽容解析：任何字段不合规就丢掉那一条，整体失败就返回空状态。 */
export function parseInstallState(text: string | null | undefined): InstallState {
	if (!text || text.trim().length === 0) return EMPTY_INSTALL_STATE;
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return EMPTY_INSTALL_STATE;
	}
	if (!raw || typeof raw !== "object") return EMPTY_INSTALL_STATE;
	const candidate = raw as { version?: unknown; entries?: unknown };
	const entries: InstallStateEntry[] = [];
	if (Array.isArray(candidate.entries)) {
		for (const item of candidate.entries) {
			if (!item || typeof item !== "object") continue;
			const entry = item as Record<string, unknown>;
			const target = typeof entry.target === "string" ? entry.target : "";
			if (target.length === 0) continue;
			entries.push({
				target,
				form: typeof entry.form === "string" ? entry.form : "marker-block",
				files: stringArray(entry.files),
				backups: stringArray(entry.backups),
				markerBlock: entry.markerBlock === true,
				packLabel: typeof entry.packLabel === "string" ? entry.packLabel : "",
				installedAt: typeof entry.installedAt === "string" ? entry.installedAt : "",
			});
		}
	}
	return { version: typeof candidate.version === "number" ? candidate.version : INSTALL_STATE_VERSION, entries };
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

/** 同一个目标重复安装时替换旧条目：state 是「现在装着什么」，不是历史。 */
export function upsertEntry(state: InstallState, entry: InstallStateEntry): InstallState {
	return {
		version: INSTALL_STATE_VERSION,
		entries: [...state.entries.filter(item => item.target !== entry.target), entry],
	};
}

export function entryForTarget(state: InstallState, target: string): InstallStateEntry | undefined {
	return state.entries.find(item => item.target === target);
}

/**
 * 卸载步骤：只针对清单里记过的文件。
 *
 * `markerBlock` 的条目优先「摘块」（块外是用户内容），只有明确要求逐字节还原时才用备份。
 * 没有备份就不给「用备份覆盖」这一步 —— 给一个不存在的文件路径等于教人删错文件。
 */
export function removalInstructions(state: InstallState): string[] {
	if (state.entries.length === 0) {
		return ["清单为空：没有可还原的记录（可能是第一次安装前，或 state 文件已被删除）。"];
	}
	const steps: string[] = [];
	for (const entry of state.entries) {
		const label = `[${entry.target}]`;
		if (entry.markerBlock) {
			steps.push(`${label} 按标记摘除块，块外内容保留`);
		}
		for (const file of entry.files) {
			if (!entry.markerBlock) steps.push(`${label} 删除或还原 ${file}`);
		}
		for (const backup of entry.backups) {
			steps.push(`${label} 如需逐字节还原：用 ${backup}* 里最新的一份覆盖回去`);
		}
		if (entry.files.length === 0 && entry.backups.length === 0) {
			steps.push(`${label} 该条目只改过配置键：把配置键还原成安装前的值`);
		}
	}
	return steps;
}

/** 从计划生成一条 state 记录：路径与备份命名在领域层统一，脚本按同一规则写盘。 */
export function entryFromPlan(input: {
	target: string;
	form: string;
	files: readonly string[];
	markerBlock: boolean;
	packLabel: string;
	now?: string;
}): InstallStateEntry {
	return {
		target: input.target,
		form: input.form,
		files: [...input.files],
		backups: input.files.map(file => `${file}.hanshuang-backup-`),
		markerBlock: input.markerBlock,
		packLabel: input.packLabel,
		installedAt: input.now ?? new Date().toISOString(),
	};
}
