/**
 * 插件主题信号（单一事实源）。
 *
 * 宿主把明暗写在 <html data-mode="dark|light">，但插件 CSS 会被
 * @astravia-org/plugin-vite 包进 @scope ([data-astravia-plugin-root="dbx-pro"])，
 * 作用域内的祖先选择器匹配不到 scope 根之外的 html——`html[data-mode=dark] .dbx-root`
 * 会被解读成 `:scope html[data-mode=dark] .dbx-root`（作用域内不可能出现 html）。
 *
 * 因此这里把结论写成 **插件根元素上的属性** data-dbx-theme，
 * 由 src/style.css 的属性选择器消费（深色逐字取设计稿，浅色为推导色板）。
 *
 * 判定顺序：
 *   1. <html data-mode="dark|light">（宿主权威信号）
 *   2. prefers-color-scheme（宿主未声明时跟随系统，覆盖 JS 尚未执行的窗口）
 *   3. 宿主 --background 令牌亮度（宿主自定义色板兜底）
 *   4. 深色（插件长期以深色为主）
 */

export type PluginTheme = "light" | "dark";

const PLUGIN_THEME_ATTR = "data-dbx-theme";
const PLUGIN_ROOT_SELECTOR = '[data-astravia-plugin-root="dbx-pro"]';

/**
 * 从任意 CSS 颜色串解析 rgb 分量。
 * 直接匹配 rgb()/rgba()/#hex；oklch()/hsl()/具名色等交给浏览器
 * （临时元素赋值后读计算样式，浏览器会归一化成 rgb）。
 * 返回裸通道串（如 "240 5% 96%"）时视为无效。
 */
function parseColorChannels(value: string): [number, number, number] | null {
	const v = value.trim().toLowerCase();
	if (!v || v === "transparent") return null;
	const m = v.match(/rgba?\(([^)]+)\)/);
	if (m) {
		const parts = m[1].split(/[ ,/]+/).map((s) => s.trim()).filter(Boolean);
		const r = Number(parts[0]);
		const g = Number(parts[1]);
		const b = Number(parts[2]);
		if ([r, g, b].every((n) => Number.isFinite(n))) return [r, g, b];
	}
	if (v.startsWith("#")) {
		let hex = v.slice(1);
		if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
		if (hex.length >= 6) {
			return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
		}
	}
	// oklch / hsl / 具名色等：浏览器能吃掉的合法颜色都会被计算样式归一化为 rgb。
	try {
		const probe = document.createElement("div");
		probe.style.display = "none";
		probe.style.color = v;
		document.body.appendChild(probe);
		const resolved = getComputedStyle(probe).color;
		probe.remove();
		const rm = resolved.match(/rgba?\(([^)]+)\)/);
		if (rm) {
			const parts = rm[1].split(/[ ,/]+/).map((s) => s.trim()).filter(Boolean);
			const r = Number(parts[0]);
			const g = Number(parts[1]);
			const b = Number(parts[2]);
			if ([r, g, b].every((n) => Number.isFinite(n))) return [r, g, b];
		}
	} catch {
		// 无 DOM 环境（单测）或赋值失败：忽略
	}
	return null;
}

/** 颜色是否近似不透明（rgb 字符串的 alpha 通道）。 */
function isOpaqueColor(value: string): boolean {
	const m = value.trim().match(/rgba?\(([^)]+)\)/);
	if (!m) return true; // hex / 具名色视为不透明
	const parts = m[1].split(/[ ,/]+/).map((s) => s.trim()).filter(Boolean);
	const alpha = parts.length === 4 ? Number(parts[3]) : 1;
	return !Number.isFinite(alpha) || alpha >= 0.999;
}

function luminanceTheme(value: string): PluginTheme | null {
	if (!value || !isOpaqueColor(value)) return null;
	const channels = parseColorChannels(value);
	if (!channels) return null;
	const [r, g, b] = channels;
	return 0.299 * r + 0.587 * g + 0.114 * b >= 128 ? "light" : "dark";
}

function pluginRoots(): HTMLElement[] {
	if (typeof document === "undefined") return [];
	return Array.from(document.querySelectorAll<HTMLElement>(PLUGIN_ROOT_SELECTOR));
}

function readHostMode(): PluginTheme | null {
	if (typeof document === "undefined") return null;
	const mode = document.documentElement?.getAttribute("data-mode");
	return mode === "dark" || mode === "light" ? mode : null;
}

function prefersColorScheme(): PluginTheme | null {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
	try {
		if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
		if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
	} catch {
		// 老环境 / 测试 mock 不支持：忽略
	}
	return null;
}

/**
 * 宿主色板兜底：读插件根**之外**的 --background（插件根内部已被设计稿令牌覆盖，
 * 读它会得到自我引用的结果），再沿祖先链找第一个不透明背景色。
 */
function probeHostBackground(root: HTMLElement | null): PluginTheme | null {
	if (typeof document === "undefined") return null;
	let el: HTMLElement | null = root?.parentElement ?? document.documentElement;
	if (!el) return null;
	const fromToken = luminanceTheme(getComputedStyle(el).getPropertyValue("--background").trim());
	if (fromToken) return fromToken;
	while (el) {
		const theme = luminanceTheme(getComputedStyle(el).backgroundColor);
		if (theme) return theme;
		el = el.parentElement;
	}
	return null;
}

/** 解析当前应有的主题（不写 DOM）。 */
function resolvePluginTheme(root?: HTMLElement | null): PluginTheme {
	const anchor = root ?? pluginRoots()[0] ?? null;
	return readHostMode() ?? prefersColorScheme() ?? probeHostBackground(anchor) ?? "dark";
}

let current: PluginTheme | null = null;
let disposer: (() => void) | null = null;
const listeners = new Set<() => void>();

function commit(theme: PluginTheme): void {
	if (theme === current) return;
	current = theme;
	for (const listener of listeners) listener();
}

/**
 * 把主题写到每个插件根元素的 data-dbx-theme 上（CSS 据此切换令牌）。
 * 主题未变时不碰 DOM。
 */
export function applyPluginTheme(theme?: PluginTheme): PluginTheme {
	const roots = pluginRoots();
	const resolved = theme ?? resolvePluginTheme(roots[0] ?? null);
	for (const el of roots) {
		if (el.getAttribute(PLUGIN_THEME_ATTR) !== resolved) {
			el.setAttribute(PLUGIN_THEME_ATTR, resolved);
		}
	}
	commit(resolved);
	return resolved;
}

export function subscribePluginTheme(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** 当前主题快照（首次读取时才探测并写 DOM）。 */
export function getPluginTheme(): PluginTheme {
	if (current) return current;
	return applyPluginTheme();
}

/**
 * 启动主题监听：立即应用一次，并在宿主切换主题（<html data-mode> 变化）
 * 或系统外观变化时同步。
 *
 * 可重复调用：同一进程内只安装一次，返回同一个解除函数。
 * 插件 JS 加载时调用（src/index.tsx），使属性在 React 挂载前就已就位，
 * 避免首帧按默认浅色渲染。
 */
export function initPluginTheme(): () => void {
	if (disposer) return disposer;
	if (typeof document === "undefined") {
		disposer = () => {};
		return disposer;
	}

	const sync = () => applyPluginTheme();

	// 只监听 <html> 上的主题信号。后挂载的插件根由 React 侧覆盖
	// （工作台挂载时调用 applyPluginTheme），避免密集渲染期间反复查询 DOM。
	const observer =
		typeof MutationObserver === "function" ? new MutationObserver(() => sync()) : null;
	observer?.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-mode", "class", "style"],
	});
		typeof MutationObserver === "function"
			? new MutationObserver(() => {
					// 新挂载的插件根还没带属性，重新同步全部根元素
					sync();
				})
			: null;
	observer?.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-mode", "class", "style"],
	});
	if (document.body) observer?.observe(document.body, { childList: true, subtree: true });

	let media: MediaQueryList | null = null;
	const onMediaChange = () => sync();
	if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
		try {
			media = window.matchMedia("(prefers-color-scheme: dark)");
			media.addEventListener("change", onMediaChange);
		} catch {
			media = null;
		}
	}

	sync();

	disposer = () => {
		observer?.disconnect();
		media?.removeEventListener("change", onMediaChange);
		disposer = null;
	};
	return disposer;
}
