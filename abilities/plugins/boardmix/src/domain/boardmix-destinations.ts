/**
 * boardmix 的地址面。整个插件只有这里写死域名——`DESTINATIONS` 之外不得出现
 * 字面量 `boardmix.cn`（见 ADR 0002：钉 origin，不钉路径）。
 */

export const BOARDMIX_ORIGIN = "https://boardmix.cn";

/** 白板站点自己的域名后缀。子域（如 cdnhw）也属于同一产品面。 */
export const BOARDMIX_HOST_SUFFIX = "boardmix.cn";

/** 登录页路径（Observed：/login 为 404，真正的登录入口在 /user/login）。 */
export const LOGIN_PATH_PREFIX = "/user/login";

export const DESTINATIONS = {
	/** 工作台首页。SPA 根，深链失效时也退得回来。 */
	workspace: `${BOARDMIX_ORIGIN}/app/`,
	recentFiles: `${BOARDMIX_ORIGIN}/app/recent-file`,
	create: `${BOARDMIX_ORIGIN}/app/create`,
	aiPpt: `${BOARDMIX_ORIGIN}/app/ai/ppt`,
	aiFlowchart: `${BOARDMIX_ORIGIN}/app/ai/flowchart`,
	aiChat: `${BOARDMIX_ORIGIN}/app/ai/chat`,
	login: `${BOARDMIX_ORIGIN}${LOGIN_PATH_PREFIX}/`,
} as const;

export type DestinationKey = keyof typeof DESTINATIONS;

/** 阶梯第三级：连工作台都打不开时退到站点根。 */
export const SITE_ROOT = `${BOARDMIX_ORIGIN}/`;

export type BoardmixPhase = "login" | "workspace" | "unknown";

export function isBoardmixHost(hostname: string): boolean {
	const host = hostname.toLowerCase();
	return host === BOARDMIX_HOST_SUFFIX || host.endsWith(`.${BOARDMIX_HOST_SUFFIX}`);
}

/**
 * 只接受 https + boardmix 域。返回解析后的 URL，其余一律 null ——
 * 调用方据此决定「要不要信这个地址」，不据此拦截导航。
 */
export function boardmixUrlOf(raw: unknown): URL | null {
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return null;
	}
	if (parsed.protocol !== "https:") return null;
	if (!isBoardmixHost(parsed.hostname)) return null;
	return parsed;
}

export function isBoardmixUrl(raw: unknown): boolean {
	return boardmixUrlOf(raw) !== null;
}

/** 把地址归类成界面上要显示的三态。认不出来就是 unknown，不猜。 */
export function phaseOf(raw: string): BoardmixPhase {
	const parsed = boardmixUrlOf(raw);
	if (!parsed) return "unknown";
	const path = parsed.pathname.toLowerCase();
	if (path.startsWith(LOGIN_PATH_PREFIX)) return "login";
	if (path === "/app" || path.startsWith("/app/")) return "workspace";
	return "unknown";
}

export function originOf(raw: string): string {
	const parsed = boardmixUrlOf(raw);
	return parsed?.origin ?? "";
}
