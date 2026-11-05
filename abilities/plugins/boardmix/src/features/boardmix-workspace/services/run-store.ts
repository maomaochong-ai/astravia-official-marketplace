import { readJsonFile, writeJsonFile, type PluginContext } from "@astravia-org/plugin-sdk";
import {
	RUN_STATE_PATH,
	newerRun,
	readAutomationRun,
	type AutomationRun,
} from "../../../domain/boardmix-run";

/** 轮询间隔：工具 handler 与界面可能不在同一个 realm，存储是两者都能读的事实源。 */
export const RUN_POLL_MS = 600;

const listeners = new Set<(run: AutomationRun) => void>();

/** 同 realm 时立刻响；跨 realm 时这只是「乐观通知」，读存储那次会补上。 */
export function subscribeAutomationRuns(listener: (run: AutomationRun) => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function publish(run: AutomationRun): void {
	for (const listener of [...listeners]) {
		try {
			listener(run);
		} catch {
			// 一个订阅者抛错不该让整轮自动化失败。
		}
	}
}

export async function persistAutomationRun(ctx: PluginContext, run: AutomationRun): Promise<void> {
	publish(run);
	await writeJsonFile(ctx.storage, RUN_STATE_PATH, run).catch(() => {
		// 落库失败只影响实时展示，不影响这次导航的结果。
	});
}

export async function readStoredRun(ctx: PluginContext): Promise<AutomationRun | null> {
	try {
		return readAutomationRun(await readJsonFile<unknown>(ctx.storage, RUN_STATE_PATH));
	} catch {
		return null;
	}
}

/** 两份来源合并时永远取更新的那次运行，避免旧记录盖住新一轮。 */
export function mergeRuns(current: AutomationRun | null, next: AutomationRun | null): AutomationRun | null {
	return newerRun(current, next);
}
