import { useMemo } from "react";
import { getStudioRuntime } from "../../../plugin-context.js";

export type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * 视图唯一的翻译入口。
 *
 * 所有帧、所有窄栏文案都从这里取，键在 locales/*.json 里；缺键时 `ctx.i18n.t` 会抛错，
 * 好过悄悄显示英文键名。回调按 `ctx` 记忆，避免每次渲染都换一个新函数让副作用反复重跑。
 */
export function useTranslator(): Translate {
	const ctx = getStudioRuntime().ctx;
	return useMemo<Translate>(() => (key, params) => ctx.i18n.t(key, params), [ctx]);
}

