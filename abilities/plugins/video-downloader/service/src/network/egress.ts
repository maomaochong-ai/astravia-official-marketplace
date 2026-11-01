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

/**
 * Whether the engine has to be told to open a direct connection even though it could inherit one.
 *
 * `--proxy ""` is the only way to override a proxy the engine finds for itself: the user's OS-level
 * VPN exposes `HTTPS_PROXY`, yt-dlp reads it, and every domestic request then leaves through a
 * foreign exit node — which licensed video services answer with a geo block instead of a stream.
 * Without the flag the configured-proxy branch is the only one that can go direct, so a user who
 * merely turns on a system VPN still loses every domestic platform.
 */
export function needsDirectRoute(url: string, settings: EgressSettings): boolean {
  if (settings.proxyMode === "off") return true;
  if (settings.proxyMode === "auto") return isDomesticUrl(url);
  return false;
}
