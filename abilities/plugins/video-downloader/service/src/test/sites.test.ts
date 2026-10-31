import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isDomesticHost, isDomesticUrl } from "../network/domestic-hosts.js";
import { proxyForUrl } from "../network/egress.js";
import { capabilityForUrl, isDirectMediaUrl, siteGroups, supportedSiteLabels, unsupportedSites } from "../media/site-capabilities.js";
import { unsupportedCode } from "../service-context.js";
import { ttwidSuffixFor, writeAnonymousCookieFile } from "../ytdlp/cookie-bootstrap.js";
import { normalizeSettings } from "../settings/settings-store.js";

const temporaryDirectories: string[] = [];

async function temporaryRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "video-downloader-sites-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function ttvidResponse(value: string): Response {
  return new Response("{}", { status: 200, headers: { "set-cookie": `ttwid=${value}; Path=/; Domain=.ixigua.com` } });
}

describe("egress routing", () => {
  const settings = { proxy: "http://127.0.0.1:7890", proxyMode: "auto" as const };

  it("keeps mainland platforms on the direct route under auto", () => {
    // A foreign exit node makes licensed video services refuse the request outright.
    expect(proxyForUrl("https://www.bilibili.com/video/BV1xx411c7mD", settings)).toBe("");
    expect(proxyForUrl("https://v.douyin.com/iJxxxxx/", settings)).toBe("");
    expect(proxyForUrl("https://www.xiaohongshu.com/explore/abc", settings)).toBe("");
    expect(proxyForUrl("https://y.qq.com/n/ryqq/songDetail/abc", settings)).toBe("");
    // The media itself comes off a CDN the extractor never names in advance.
    expect(isDomesticUrl("https://upos-sz-mirrorcos.bilivideo.com/x.flv")).toBe(true);
    expect(isDomesticUrl("https://v3-web.douyinvod.com/x.mp4")).toBe(true);
  });

  it("sends foreign platforms through the proxy under auto", () => {
    expect(proxyForUrl("https://www.youtube.com/watch?v=abc", settings)).toBe("http://127.0.0.1:7890");
    expect(proxyForUrl("https://x.com/user/status/1", settings)).toBe("http://127.0.0.1:7890");
  });

  it("honours always and off", () => {
    expect(proxyForUrl("https://www.bilibili.com/video/BV1", { ...settings, proxyMode: "always" })).toBe(
      "http://127.0.0.1:7890",
    );
    expect(proxyForUrl("https://www.youtube.com/watch?v=abc", { ...settings, proxyMode: "off" })).toBe("");
    expect(proxyForUrl("https://www.youtube.com/watch?v=abc", { proxy: "  ", proxyMode: "auto" })).toBe("");
  });

  it("does not treat a look-alike suffix as domestic", () => {
    expect(isDomesticHost("notbilibili.com")).toBe(false);
    expect(isDomesticHost("bilibili.com.evil.example")).toBe(false);
    expect(isDomesticHost("www.bilibili.com")).toBe(true);
    expect(isDomesticHost("")).toBe(false);
  });
});

describe("site capabilities", () => {
  it("reports a platform the engine has no extractor for", () => {
    expect(capabilityForUrl("https://v.kuaishou.com/abc")?.extractor).toBe(false);
    expect(capabilityForUrl("https://haokan.baidu.com/v?vid=1")?.extractor).toBe(false);
    expect(capabilityForUrl("https://www.hupu.com/x")?.extractor).toBe(false);
  });

  it("records which platforms need a session", () => {
    expect(capabilityForUrl("https://www.douyin.com/video/123")?.cookie).toBe("session");
    expect(capabilityForUrl("https://www.xiaohongshu.com/explore/abc")?.cookie).toBe("session");
    // Ixigua is satisfied by the anonymous ttwid the plugin registers itself.
    expect(capabilityForUrl("https://www.ixigua.com/7000000000000000000")?.cookie).toBe("anonymous");
    expect(capabilityForUrl("https://www.bilibili.com/video/BV1")?.loginForQuality).toBe(true);
    expect(capabilityForUrl("https://example.com/video.mp4")).toBeNull();
  });

  it("never advertises a platform without an extractor", () => {
    const labels = supportedSiteLabels();
    expect(labels).toContain("哔哩哔哩");
    // Qingting FM ships a working extractor; the table used to deny it.
    expect(labels).toContain("蜻蜓 FM");
    expect(labels).not.toContain("快手");
  });

  it("keeps an unsupported platform with the reason the engine gives", () => {
    expect(capabilityForUrl("https://www.mgtv.com/b/1/2.html")?.reason).toBe("engine-missing");
    expect(capabilityForUrl("https://www.kuwo.cn/play_detail/1")?.reason).toBe("upstream-broken");
    expect(capabilityForUrl("https://www.miaopai.com/show/x.htm")?.reason).toBe("site-offline");
    // Mango TV has no extractor in the pinned build, so it must not be advertised either.
    expect(supportedSiteLabels()).not.toContain("芒果 TV");
    // Threads has no extractor in the pinned build either; the table used to claim it did.
    expect(capabilityForUrl("https://www.threads.net/@someone/post/1")?.reason).toBe("engine-missing");
  });

  it("maps each reason onto its own failure code", () => {
    expect(unsupportedCode("engine-missing")).toBe("site_unsupported");
    expect(unsupportedCode("upstream-broken")).toBe("site_upstream_broken");
    expect(unsupportedCode("site-offline")).toBe("site_offline");
    expect(unsupportedCode(undefined)).toBe("site_unsupported");
  });

  it("lets a direct media link bypass the platform table", () => {
    // The host is unsupported as a page, but the generic extractor downloads a bare file.
    expect(capabilityForUrl("https://v.kuaishou.com/x")?.extractor).toBe(false);
    expect(isDirectMediaUrl("https://v.kuaishou.com/x.mp4")).toBe(true);
    expect(isDirectMediaUrl("https://v.kuaishou.com/x.m3u8?token=1")).toBe(true);
    expect(isDirectMediaUrl("https://v.kuaishou.com/x")).toBe(false);
  });

  it("groups every advertised platform exactly once", () => {
    const groups = siteGroups();
    expect(groups.map((group) => group.key)).toEqual(["global", "china", "screen", "audio", "live"]);
    const all = groups.flatMap((group) => group.sites);
    expect(all).toHaveLength(supportedSiteLabels().length);
    expect(new Set(all).size).toBe(all.length);
  });

  it("lists the unsupported platforms with their reason", () => {
    const reasons = new Map(unsupportedSites().map((site) => [site.label, site.reason]));
    expect(reasons.get("快手")).toBe("engine-missing");
    expect(reasons.get("酷我音乐")).toBe("upstream-broken");
    expect(reasons.has("哔哩哔哩")).toBe(false);
  });
});

describe("anonymous cookie bootstrap", () => {
  it("writes a ttwid jar scoped to the byte dance host", async () => {
    const dataRoot = await temporaryRoot();
    const path = await writeAnonymousCookieFile({
      url: "https://www.ixigua.com/7000000000000000000",
      dataRoot,
      name: "probe-test",
      fetchImpl: (async () => ttvidResponse("1%7Cabc")) as unknown as typeof fetch,
    });
    expect(path).not.toBeNull();
    const body = await readFile(path as string, "utf8");
    expect(body.startsWith("# Netscape HTTP Cookie File")).toBe(true);
    expect(body).toContain(".ixigua.com");
    expect(body).toContain("ttwid\t1%7Cabc");
  });

  it("stays out of the way when the site needs no anonymous cookie or the call fails", async () => {
    const dataRoot = await temporaryRoot();
    const youtube = await writeAnonymousCookieFile({
      url: "https://www.youtube.com/watch?v=abc",
      dataRoot,
      name: "probe-youtube",
    });
    expect(youtube).toBeNull();

    const failed = await writeAnonymousCookieFile({
      url: "https://www.ixigua.com/1",
      dataRoot,
      name: "probe-failed",
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });
    expect(failed).toBeNull();

    const rejected = await writeAnonymousCookieFile({
      url: "https://www.douyin.com/video/1",
      dataRoot,
      name: "probe-rejected",
      fetchImpl: (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch,
    });
    expect(rejected).toBeNull();
  });

  it("only claims the hosts it has an endpoint for", () => {
    expect(ttwidSuffixFor("www.ixigua.com")).toBe("ixigua.com");
    expect(ttwidSuffixFor("v.douyin.com")).toBe("douyin.com");
    expect(ttwidSuffixFor("www.bilibili.com")).toBeNull();
  });
});

describe("settings for egress and cookies", () => {
  it("defaults to auto routing with no browser jar", () => {
    const settings = normalizeSettings({});
    expect(settings.proxyMode).toBe("auto");
    expect(settings.cookieBrowser).toBe("");
  });

  it("drops values the engine cannot use", () => {
    expect(normalizeSettings({ proxyMode: "sometimes" as never }).proxyMode).toBe("auto");
    expect(normalizeSettings({ proxyMode: "always" }).proxyMode).toBe("always");
    expect(normalizeSettings({ cookieBrowser: "netscape" as never }).cookieBrowser).toBe("");
    expect(normalizeSettings({ cookieBrowser: "edge" }).cookieBrowser).toBe("edge");
  });
});
