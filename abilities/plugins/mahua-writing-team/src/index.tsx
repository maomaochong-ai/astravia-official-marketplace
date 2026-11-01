import { definePlugin, type Disposable } from "@astravia-org/plugin-sdk";
import { StudioService } from "./application/studio-service.js";
import { attachConsoleLogStorage, hydrateConsoleLog } from "./application/console-log/console-log-storage.js";
import { EntitlementGate } from "./entitlement/entitlement-gate.js";
import { registerConsoleFeedHooks } from "./features/workbench/hooks/register-console-feed.js";
import { clearStudioRuntime, setStudioRuntime } from "./plugin-context.js";
import { ManuscriptRepository } from "./repository/manuscript-repository.js";
import { registerStudioTab } from "./studio-tab.js";
import { registerStudioTurnCard } from "./studio-turn-card.js";
import { registerNovelTools } from "./tools/register-novel-tools.js";
import "./style.css";

const nowOf = () => new Date();

const NOOP: Disposable = { dispose: () => {} };

/**
 * 可选面的注册护栏。
 *
 * 宿主把 `activate` 的返回当成一次事务：抛出去，宿主就把这次已经登记的贡献全部撤掉，
 * 插件在界面上等于不存在。而工作台标签页是唯一必需项，回合卡片、活动流、Agent 工具都是
 * 附加面——它们注册失败只该少一个面，不该让整张工作台跟着消失。
 *
 * 失败要留痕：写进 console，下一次有人看不到东西时能顺着这里查。
 */
function optional(label: string, register: () => Disposable): Disposable {
	try {
		return register();
	} catch (error) {
		console.warn(`[mahua-writing-team] ${label} 注册失败，已跳过这一面`, error);
		return NOOP;
	}
}

/** 同上，用于返回 void 的注册（Agent 工具）。 */
function optionalVoid(label: string, register: () => void): void {
	try {
		register();
	} catch (error) {
		console.warn(`[mahua-writing-team] ${label} 注册失败，已跳过这一面`, error);
	}
}

export default definePlugin({
	async activate(ctx) {
		const gate = new EntitlementGate(ctx.storage, nowOf);
		const repository = new ManuscriptRepository(ctx.storage, () => nowOf().toISOString());
		const service = new StudioService(repository, gate, nowOf);
		const studioRuntime = setStudioRuntime({ ctx, service, gate });

		await gate.load();

		optionalVoid("novel-tools", () => registerNovelTools(ctx, service));

		// 一张界面，一个宿主形态：活动面板里的「麻花小说网」标签页（日常入口，也是唯一入口）。
		// 「全屏工作台」是本插件自己的覆盖层，不是宿主的整页路由——用户要的是铺满窗口，
		// 整页路由换来的仍是带宿主侧栏与页头的画面，还要多养一条平行的入口。
		// 未激活时同一界面显示激活页，凭证过期不会让入口消失。
		const tab = registerStudioTab(ctx);
		const turnCard = optional("turn-card", () => registerStudioTurnCard(ctx));

		// 运行台的活动流（ADR 0027 §1 修订版）：先把上次落盘的事件灌回内存，再订阅后续写入。
		// 灌历史放在注册 hook 之前：hook 一旦先到，这一轮的真事件就不该被旧记录压在后面。
		await hydrateConsoleLog(ctx.storage);
		const detachConsoleLog = attachConsoleLogStorage(ctx.storage);
		const unhook = optional("console-feed", () => registerConsoleFeedHooks(ctx));

		return () => {
			turnCard.dispose();
			tab.dispose();
			unhook.dispose();
			detachConsoleLog();
		clearStudioRuntime(studioRuntime);
		};
	},
});
