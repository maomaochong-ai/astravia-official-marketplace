import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { StudioService } from "./application/studio-service.js";
import type { EntitlementGate } from "./entitlement/entitlement-gate.js";

/**
 * activate() 建立的运行时对象。组件是零 props 的，拿不到 ctx，又不能写进模块顶层
 * ——MF 的共享依赖是异步填充的，顶层求值会拿到半成品。
 */
export interface StudioRuntime {
	ctx: PluginContext;
	service: StudioService;
	gate: EntitlementGate;
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

let runtime: StudioRuntime | null = null;
let translate: Translate | null = null;

/**
 * 装上这一轮的运行时，并把同一个对象还回去当所有权凭证。
 *
 * 宿主会给同一个插件开多个能力会话（会话面与项目面各一次，`capabilitySessionId` 不同），
 * 两次 `activate` 落在同一个模块实例上：后一次先装好运行时，前一次过几十毫秒才 dispose。
 * 无条件 `setStudioRuntime(null)` 会把后来者刚装上的那份抹掉，界面从此读不到 ctx 又不再报错，
 * 只能停在启动骨架上——一条只在启动竞态里出现的静默空白。凭证让卸载只能拆自己装的那一份。
 */
export function setStudioRuntime(next: StudioRuntime): StudioRuntime {
	runtime = next;
	translate = (key, params) => next.ctx.i18n.t(key, params);
	return next;
}

/**
 * 最近一次 activate 装上的翻译函数，卸载之后仍然保留。
 *
 * 运行时没了界面还要说话：告诉用户「还没起来」比留一块无字骨架诚实。全新的进程里还没
 * 装过任何一次运行时，这里就是 null，调用方退回骨架。
 */
export function getStudioTranslator(): Translate | null {
	return translate;
}

/** 只拆自己装上的那一份；别人已经接管就什么都不做。 */
export function clearStudioRuntime(owned: StudioRuntime): void {
	if (runtime === owned) runtime = null;
}

/** 无条件清空。只在测试里用：生产卸载必须走 `clearStudioRuntime`，否则会踩到重复激活的竞态。 */
export function resetStudioRuntime(): void {
	runtime = null;
	translate = null;
}

export function getStudioRuntime(): StudioRuntime {
	if (!runtime) throw new Error("mahua-writing-team: studio runtime is not ready");
	return runtime;
}

/** 给「拿不到就算了」的调用点用：顶栏里的入口按钮没有运行时就不画。 */
export function tryGetStudioRuntime(): StudioRuntime | null {
	return runtime;
}
