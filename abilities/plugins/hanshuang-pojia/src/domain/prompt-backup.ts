/**
 * 提示词备份与还原。
 *
 * 寒霜注入工具在写入前会备份原始文件到 ~/.cc-switch/backups/。
 * 这里的等价物是：修改提示词前自动生成一个备份快照，用户可以一键还原。
 * 备份只存提示词内容和元信息，不存完整库状态。
 */

import type { PromptItem } from "./prompt-library";

export interface PromptBackup {
	id: string;
	/** 被备份的 prompt id。 */
	promptId: string;
	/** 备份时的 prompt 名称。 */
	promptName: string;
	/** 快照内容。 */
	snapshot: Omit<PromptItem, "id" | "createdAt" | "updatedAt">;
	createdAt: number;
}

export function createBackup(prompt: PromptItem): PromptBackup {
	const now = Date.now();
	const { id, createdAt, updatedAt, ...snapshot } = prompt;
	return {
		id: `backup-${now}-${Math.random().toString(36).slice(2, 8)}`,
		promptId: id,
		promptName: prompt.name,
		snapshot,
		createdAt: now,
	};
}

/** 从备份还原 prompt：保留原 id，用快照覆盖内容。 */
export function restoreFromBackup(prompt: PromptItem, backup: PromptBackup): PromptItem {
	return {
		...prompt,
		name: backup.snapshot.name,
		description: backup.snapshot.description,
		content: backup.snapshot.content,
		mode: backup.snapshot.mode,
		active: backup.snapshot.active,
		updatedAt: Date.now(),
	};
}

/** 按 promptId 过滤备份，按时间倒序。 */
export function backupsForPrompt(backups: PromptBackup[], promptId: string): PromptBackup[] {
	return backups
		.filter(b => b.promptId === promptId)
		.sort((a, b) => b.createdAt - a.createdAt);
}

/** 限制每个 prompt 的备份数量，保留最新的 N 个。 */
export function pruneBackups(backups: PromptBackup[], maxPerPrompt = 10): PromptBackup[] {
	const byPrompt = new Map<string, PromptBackup[]>();
	for (const b of backups) {
		const list = byPrompt.get(b.promptId) ?? [];
		list.push(b);
		byPrompt.set(b.promptId, list);
	}
	const result: PromptBackup[] = [];
	for (const list of byPrompt.values()) {
		list.sort((a, b) => b.createdAt - a.createdAt);
		result.push(...list.slice(0, maxPerPrompt));
	}
	return result;
}
