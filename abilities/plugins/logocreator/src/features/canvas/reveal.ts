import type { PluginContext } from "@astravia-org/plugin-sdk";
import { activeScopeKey } from "./canvas-prompt";
import { setPendingDesignIds } from "./pending-design";
import { LOGO_TAB_ID } from "../../tab-ids";

/**
 * 把一个刚做好的设计送到画布上，并把 tab 打开。
 *
 * 上一版这里只在调用抛错时才补一次「带 cwd」的重试，而宿主对不匹配的会话常常是**静默无操作**
 * 而不是抛错 —— 于是工具报告成功、面板却没出现，用户看到的是「对话里做完了，tab 里什么都没有」。
 *
 * 现在的顺序按 SDK 的约定来（`ui.ts`：tool handler 与后台任务**应当**显式传自己的 cwd，
 * 省略 cwd 表示「宿主当前显示的会话」）：
 *
 *  1. 先按本次工具会话的 cwd 挂上并打开 —— 这是文档说的正确用法；
 *  2. 再补一次不带 cwd 的调用，覆盖「工具会话与前台会话是同一条、但宿主只认前台」的宿主变体；
 *     两次都不抛才算打开成功，任一次抛错就记下来（另一个成功的尝试仍然有效）。
 *
 * 参考插件（astravia-ui-design）的工具也是这么做的：`setActivityTabVisible(id, true, { cwd })`
 * 紧接 `openActivityTab(id, { width: "max", cwd: session.cwd })`。
 *
 * pending id 仍写两份（活动作用域 + 工具会话 cwd）：面板解析到哪个作用域都能认领。
 */
export interface RevealResult {
	opened: boolean;
	/** 打开失败时的第一条原因；可以直接给用户看。 */
	error?: string;
}

export function revealInCanvas(
	ctx: PluginContext,
	cwd: string | null | undefined,
	designId: string | readonly string[],
): RevealResult {
	// 交接给面板：它挂载或重渲染时认领。整批都留下，面板才会把所有新图铺开。
	// 之前只记一个 id，于是「对话里出了三张，画布上只有一张」。
	const ids = typeof designId === "string" ? [designId] : [...designId];
	setPendingDesignIds(cwd ?? undefined, ids);
	setPendingDesignIds(activeScopeKey(), ids);

	const errors: string[] = [];

	const attach = (options?: { cwd: string }): void => {
		try {
			ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true, options);
		} catch (cause) {
			errors.push(describe(cause));
		}
	};

	const open = (options?: { width: "max"; cwd: string } | { width: "max" }): void => {
		try {
			ctx.ui.openActivityTab(LOGO_TAB_ID, options);
		} catch (cause) {
			errors.push(describe(cause));
		}
	};

	// ① 工具会话自己那条对话：文档推荐的写法。
	if (cwd) attach({ cwd });
	// ② 前台会话：即使 ① 静默无效，这一步也会把面板开在用户正在看的地方。
	attach();
	// ③ 先带 cwd 打开；④ 再不带 cwd 打开一次（同一个 tab 重复打开是幂等的）。
	if (cwd) open({ width: "max", cwd });
	open({ width: "max" });

	// 谁都没抛错 = 至少有一次真的到达宿主。宿主 API 是 void，无法更强地确认；
	// 面板那边还有 pending 认领与「跟随最新 AI 设计」两条兜底。
	return errors.length === 0 ? { opened: true } : { opened: false, error: errors[0] };
}

function describe(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
