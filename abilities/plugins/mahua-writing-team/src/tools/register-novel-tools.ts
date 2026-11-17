/**
 * 工具总装。36 个工具按弧分段住在各自的文件里，这里只按顺序挂上去。
 *
 * 纪律：写工具只回事实（`{ ok, phase, currentChapter, ... }`），不附带"接下来请调用 X"。
 * 下一步一律由 `mahua_next_instruction` 给出，避免模型看到两个来源。
 *
 * **记账**：`ctx.agent.registerTool` 返回 Disposable。以前这里丢掉了它们——插件停用后
 * 36 个工具仍留在宿主注册表里，指向一个已经销毁的 service：调用就抛错，从宿主角度看
 * 就是「卸载没卸干净」。现在把每一次注册都记下来，由入口的 cleanup 统一释放。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";

import type { StudioService } from "../application/studio-service.js";
import { registerChapterTools } from "./chapter-tools.js";
import { registerFoundationTools } from "./foundation-tools.js";
import { registerLedgerTools } from "./ledger-tools.js";
import { registerOutlineTools } from "./outline-tools.js";
import { registerReadingTools } from "./reading-tools.js";
import { registerWorkspaceTools } from "./workspace-tools.js";

export function registerNovelTools(ctx: PluginContext, service: StudioService): Disposable[] {
	const owned: Disposable[] = [];
	// 代理 `agent` 而不是复制它：`Object.create` 保留原型链，宿主方法里的 `this` 仍然有效。
	const agent = Object.create(ctx.agent) as PluginContext["agent"];
	agent.registerTool = ((registration: Parameters<PluginContext["agent"]["registerTool"]>[0]) => {
		const disposable = ctx.agent.registerTool(registration);
		owned.push(disposable);
		return disposable;
	}) as PluginContext["agent"]["registerTool"];
	const tracking = { ...ctx, agent } as PluginContext;

	registerReadingTools(tracking, service);
	registerFoundationTools(tracking, service);
	registerOutlineTools(tracking, service);
	registerChapterTools(tracking, service);
	registerLedgerTools(tracking, service);
	registerWorkspaceTools(tracking, service);

	return owned;
}
