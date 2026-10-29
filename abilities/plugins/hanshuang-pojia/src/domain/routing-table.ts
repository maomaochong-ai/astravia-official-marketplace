import generated from "./routing-table.generated.json";

/**
 * 上游任务路由表（单一事实源是 `Tool/scripts/routing.json`，44 条）。
 *
 * 这份数据只回答两件事：这条请求属不属于某条已知路由、那条路由指向的技能在不在包里。
 * 它不决定形态，也不替用户挑工具——只把「你以为有、其实没有」
 * 的那一层如实说出来。数据由 `scripts/sync-routing-table.mjs --from …` 生成，
 * 手改会被 `--check` 拒绝。
 */

export interface RoutingRoute {
	id: string;
	label: string;
	/** 上游 skill 路径，形如 `apk-reverse/SKILL.md`。 */
	skill: string;
	/** 技能目标，即去掉 SKILL.md 的路径段。 */
	target: string;
	/** 生成时该目标是否真的在 `agent/skills` 下。 */
	present: boolean;
	/** 命中词（上游原文正则）。 */
	keywords: string[];
}

export interface RouteMatch {
	route: RoutingRoute;
	/** 命中的正则原文，便于在面板上标注为什么判成这条。 */
	hits: string[];
}

export interface RoutingCoverage {
	routes: number;
	targets: number;
	present: number;
	/** 有路由、但包里没有落点的技能目标（去重、升序）。 */
	missing: string[];
	/** 全都没命中时归到哪条路由（上游 `meta.fallbackId`），只用于报告，不自动追加提示。 */
	fallbackId: string;
	/** 表内容指纹前 8 位：排查「页面还是旧版」时，它比版本号更能说明加载的是哪份表。 */
	sourceSha8: string;
}

export const ROUTING_ROUTES: readonly RoutingRoute[] = generated.routes;

export const ROUTING_FALLBACK_ID: string = generated.fallbackId;

export const ROUTING_SOURCE_SHA256: string = generated.sourceSha256;

/** 上游正则是 Python 语法，绝大多数与 JS 通用；编译不了的按「不命中」处理，绝不猜。 */
const compiled = new Map<string, RegExp | null>();

function matcher(pattern: string): RegExp | null {
	const cached = compiled.get(pattern);
	if (cached !== undefined) return cached;
	let built: RegExp | null = null;
	try {
		// 不挂 g 标志：g 会把 lastIndex 带到下一次测试上，结果取决于调用顺序。
		built = new RegExp(pattern, "i");
	} catch {
		built = null;
	}
	compiled.set(pattern, built);
	return built;
}

/** 命中哪些路由；按命中词数量降序，同分按路由 id 升序，最多返回 `limit` 条。 */
export function matchRoutes(prompt: string, limit = 3): RouteMatch[] {
	const text = prompt ?? "";
	if (text.trim() === "") return [];
	const matches: RouteMatch[] = [];
	for (const route of ROUTING_ROUTES) {
		const hits: string[] = [];
		for (const pattern of route.keywords) {
			const regex = matcher(pattern);
			if (regex && regex.test(text)) hits.push(pattern);
		}
		if (hits.length > 0) matches.push({ route, hits });
	}
	matches.sort((left, right) => {
		if (left.hits.length !== right.hits.length) return right.hits.length - left.hits.length;
		return left.route.id.localeCompare(right.route.id);
	});
	return matches.slice(0, Math.max(1, limit));
}

export function routingCoverage(): RoutingCoverage {
	const targets = new Set<string>();
	const missing = new Set<string>();
	let present = 0;
	for (const route of ROUTING_ROUTES) {
		targets.add(route.target);
		if (route.present) present += 1;
		else missing.add(route.target);
	}
	return {
		routes: ROUTING_ROUTES.length,
		targets: targets.size,
		present,
		missing: [...missing].sort((left, right) => left.localeCompare(right)),
		fallbackId: ROUTING_FALLBACK_ID,
		sourceSha8: ROUTING_SOURCE_SHA256.slice(0, 8),
	};
}

/**
 * 给提示词用的一句话路由提示。`present` 为真时也要说，因为它是「优先读哪本技能」的线索；
 * 为假时必须说清楚没落点，否则模型会假装自己读过了。
 */
export function describeRouteMatch(match: RouteMatch): string {
	const { route, hits } = match;
	const label = `${route.id} ${route.label}`;
	const evidence = hits.slice(0, 2).map(hit => `\`${hit}\``).join("、");
	if (route.present) return `请求更像 ${label}（命中 ${evidence}），对应技能 \`${route.target}\` 在包内，先读它再动手。`;
	return `请求更像 ${label}（命中 ${evidence}），但对应技能 \`${route.target}\` 未随包分发：不要假装读过它，改用插件自带工具按同样的作业顺序做。`;
}
