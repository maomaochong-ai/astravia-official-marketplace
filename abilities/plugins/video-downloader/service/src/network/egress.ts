import { isDomesticUrl } from "./domestic-hosts.js";

/** How the configured proxy is applied. `auto` keeps domestic platforms on the direct route. */
export type ProxyMode = "auto" | "always" | "off";

export const PROXY_MODES: readonly ProxyMode[] = ["auto", "always", "off"];

/** Browsers yt-dlp can read a session cookie out of, plus "none" for manual/absent. */
export type CookieBrowser = "" | "chrome" | "edge" | "safari" | "firefox" | "brave" | "chromium";

export const COOKIE_BROWSERS: readonly CookieBrowser[] = ["", "chrome", "edge", "safari", "firefox", "brave", "chromium"];

export interface EgressSettings {
  proxy: string;
  proxyMode: ProxyMode;
}

/**
 * Proxy to use for one target, or `""` for a direct connection.
 *
 * Under `auto` a domestic platform keeps the direct route: users in China reach it without a
 * proxy, and a foreign exit node makes licensed video services refuse the request outright.
 */
export function proxyForUrl(url: string, settings: EgressSettings): string {
  const proxy = settings.proxy.trim();
  if (!proxy || settings.proxyMode === "off") return "";
  if (settings.proxyMode === "auto" && isDomesticUrl(url)) return "";
  return proxy;
}
