import { hostnameOf } from "../network/domestic-hosts.js";

/**
 * What the engine can and cannot do per platform, from the extractor set of the pinned build.
 *
 * The table is the single source of truth: the panel's coverage view, the `video_supported_sites`
 * tool and the pre-flight check all read it, so the advertised list can never drift from what the
 * engine actually registers. Every `extractor: true` entry was checked against
 * `yt-dlp --list-extractors` for the pinned release; an entry the engine cannot handle stays in the
 * table with a `reason` so the failure reads as a site fact instead of a plugin bug.
 */
export type SiteCookie = "none" | "anonymous" | "session";

export type SiteGroupKey = "global" | "china" | "screen" | "audio" | "live";

/** Why the pinned engine cannot resolve a platform. Translated by the panel. */
export type SiteReason = "engine-missing" | "upstream-broken" | "site-offline";

export interface SiteCapability {
  key: string;
  label: string;
  group: SiteGroupKey;
  hosts: string[];
  /** `false` means the pinned engine ships no working extractor for the host. */
  extractor: boolean;
  /** What the page needs before it yields formats. */
  cookie: SiteCookie;
  /** The page parses anonymously, but its full quality needs a signed-in session. */
  loginForQuality?: boolean;
  /** Set only when `extractor` is `false`. */
  reason?: SiteReason;
}

export const SITE_CAPABILITIES: readonly SiteCapability[] = [
  // International
  { key: "youtube", label: "YouTube", group: "global", hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"], extractor: true, cookie: "none" },
  { key: "x", label: "X", group: "global", hosts: ["x.com", "twitter.com"], extractor: true, cookie: "none" },
  { key: "tiktok", label: "TikTok", group: "global", hosts: ["tiktok.com"], extractor: true, cookie: "none" },
  { key: "instagram", label: "Instagram", group: "global", hosts: ["instagram.com"], extractor: true, cookie: "session" },
  { key: "facebook", label: "Facebook", group: "global", hosts: ["facebook.com", "fb.watch"], extractor: true, cookie: "session" },
  { key: "reddit", label: "Reddit", group: "global", hosts: ["reddit.com", "redd.it"], extractor: true, cookie: "none" },
  { key: "vimeo", label: "Vimeo", group: "global", hosts: ["vimeo.com"], extractor: true, cookie: "none" },
  { key: "dailymotion", label: "Dailymotion", group: "global", hosts: ["dailymotion.com", "dai.ly"], extractor: true, cookie: "none" },
  { key: "twitch", label: "Twitch", group: "global", hosts: ["twitch.tv"], extractor: true, cookie: "none" },
  { key: "soundcloud", label: "SoundCloud", group: "global", hosts: ["soundcloud.com"], extractor: true, cookie: "none" },
  { key: "bandcamp", label: "Bandcamp", group: "global", hosts: ["bandcamp.com"], extractor: true, cookie: "none" },
  { key: "rumble", label: "Rumble", group: "global", hosts: ["rumble.com"], extractor: true, cookie: "none" },
  { key: "bitchute", label: "BitChute", group: "global", hosts: ["bitchute.com"], extractor: true, cookie: "none" },
  { key: "vk", label: "VK", group: "global", hosts: ["vk.com", "vkvideo.ru"], extractor: true, cookie: "none" },
  { key: "snapchat", label: "Snapchat", group: "global", hosts: ["snapchat.com"], extractor: true, cookie: "none" },
  { key: "linkedin", label: "LinkedIn", group: "global", hosts: ["linkedin.com"], extractor: true, cookie: "session" },
  { key: "imgur", label: "Imgur", group: "global", hosts: ["imgur.com"], extractor: true, cookie: "none" },
  { key: "streamable", label: "Streamable", group: "global", hosts: ["streamable.com"], extractor: true, cookie: "none" },
  { key: "pinterest", label: "Pinterest", group: "global", hosts: ["pinterest.com", "pin.it"], extractor: true, cookie: "none" },
  { key: "tumblr", label: "Tumblr", group: "global", hosts: ["tumblr.com"], extractor: true, cookie: "none" },
  // The pinned engine ships no Threads extractor; the host stays in the table so the panel can
  // say why instead of letting the probe spend its timeout to learn the same thing.
  { key: "threads", label: "Threads", group: "global", hosts: ["threads.net"], extractor: false, cookie: "none", reason: "engine-missing" },
  { key: "nicovideo", label: "niconico", group: "global", hosts: ["nicovideo.jp", "nico.ms"], extractor: true, cookie: "session" },
  { key: "bluesky", label: "Bluesky", group: "global", hosts: ["bsky.app"], extractor: true, cookie: "none" },
  { key: "newgrounds", label: "Newgrounds", group: "global", hosts: ["newgrounds.com"], extractor: true, cookie: "none" },

  // Mainland video
  { key: "bilibili", label: "哔哩哔哩", group: "china", hosts: ["bilibili.com", "b23.tv"], extractor: true, cookie: "none", loginForQuality: true },
  { key: "douyin", label: "抖音", group: "china", hosts: ["douyin.com", "iesdouyin.com"], extractor: true, cookie: "session" },
  { key: "ixigua", label: "西瓜视频", group: "china", hosts: ["ixigua.com"], extractor: true, cookie: "anonymous" },
  { key: "xiaohongshu", label: "小红书", group: "china", hosts: ["xiaohongshu.com", "xhslink.com"], extractor: true, cookie: "session" },
  { key: "weibo", label: "微博", group: "china", hosts: ["weibo.com", "weibo.cn"], extractor: true, cookie: "session" },
  { key: "zhihu", label: "知乎", group: "china", hosts: ["zhihu.com"], extractor: true, cookie: "none" },
  { key: "toutiao", label: "今日头条", group: "china", hosts: ["toutiao.com"], extractor: true, cookie: "none" },
  { key: "cctv", label: "央视网", group: "china", hosts: ["cctv.com", "cntv.cn"], extractor: true, cookie: "none" },

  // Long form and anime
  { key: "youku", label: "优酷", group: "screen", hosts: ["youku.com"], extractor: true, cookie: "none" },
  { key: "iqiyi", label: "爱奇艺", group: "screen", hosts: ["iqiyi.com"], extractor: true, cookie: "session" },
  { key: "qq-video", label: "腾讯视频", group: "screen", hosts: ["v.qq.com"], extractor: true, cookie: "none" },
  { key: "acfun", label: "AcFun", group: "screen", hosts: ["acfun.cn"], extractor: true, cookie: "none" },
  { key: "xinpianchang", label: "新片场", group: "screen", hosts: ["xinpianchang.com"], extractor: true, cookie: "none" },
  { key: "sohu", label: "搜狐视频", group: "screen", hosts: ["tv.sohu.com", "sohu.com"], extractor: true, cookie: "none" },

  // Audio
  { key: "netease-music", label: "网易云音乐", group: "audio", hosts: ["music.163.com"], extractor: true, cookie: "none" },
  { key: "qq-music", label: "QQ 音乐", group: "audio", hosts: ["y.qq.com"], extractor: true, cookie: "session" },
  { key: "ximalaya", label: "喜马拉雅", group: "audio", hosts: ["ximalaya.com"], extractor: true, cookie: "none" },
  { key: "qingting", label: "蜻蜓 FM", group: "audio", hosts: ["qingting.fm"], extractor: true, cookie: "none" },
  { key: "zingmp3", label: "Zing MP3", group: "audio", hosts: ["zingmp3.vn"], extractor: true, cookie: "none" },

  // Live
  { key: "huya", label: "虎牙", group: "live", hosts: ["huya.com"], extractor: true, cookie: "none" },
  { key: "douyu", label: "斗鱼", group: "live", hosts: ["douyu.com"], extractor: true, cookie: "none" },

  // No usable extractor in the pinned engine. Kept so the failure is a site fact with a reason.
  { key: "kuaishou", label: "快手", group: "china", hosts: ["kuaishou.com", "kwai.com", "gifshow.com"], extractor: false, cookie: "none", reason: "engine-missing" },
  { key: "haokan", label: "好看视频", group: "china", hosts: ["haokan.baidu.com"], extractor: false, cookie: "none", reason: "engine-missing" },
  { key: "hupu", label: "虎扑", group: "china", hosts: ["hupu.com"], extractor: false, cookie: "none", reason: "engine-missing" },
  { key: "tangdou", label: "糖豆", group: "china", hosts: ["tangdou.com"], extractor: false, cookie: "none", reason: "engine-missing" },
  { key: "yinyuetai", label: "音悦台", group: "china", hosts: ["yinyuetai.com"], extractor: false, cookie: "none", reason: "engine-missing" },
  { key: "miaopai", label: "秒拍", group: "china", hosts: ["miaopai.com"], extractor: false, cookie: "none", reason: "site-offline" },
  { key: "mgtv", label: "芒果 TV", group: "screen", hosts: ["mgtv.com"], extractor: false, cookie: "none", reason: "engine-missing" },
  { key: "kuwo", label: "酷我音乐", group: "audio", hosts: ["kuwo.cn"], extractor: false, cookie: "none", reason: "upstream-broken" },
];

const HOST_INDEX: ReadonlyArray<{ suffix: string; capability: SiteCapability }> = SITE_CAPABILITIES.flatMap((capability) =>
  capability.hosts.map((suffix) => ({ suffix, capability })),
);

/** A URL that already points at a media file: the engine's generic extractor downloads it as is. */
const DIRECT_MEDIA = /\.(?:mp4|m4v|webm|mkv|mov|flv|ts|m3u8|mp3|m4a|aac|opus|ogg|wav|flac)$/iu;

export function isDirectMediaUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return DIRECT_MEDIA.test(path);
  } catch {
    return false;
  }
}

export function capabilityForHost(hostname: string): SiteCapability | null {
  const host = hostname.trim().toLowerCase().replace(/^\./u, "");
  if (!host) return null;
  for (const entry of HOST_INDEX) {
    if (host === entry.suffix || host.endsWith(`.${entry.suffix}`)) return entry.capability;
  }
  return null;
}

export function capabilityForUrl(url: string): SiteCapability | null {
  return capabilityForHost(hostnameOf(url));
}

/**
 * Suffix list for the panel's "supported platforms" copy and the `video_supported_sites` tool,
 * derived from the table so neither can advertise a platform the engine cannot extract.
 */
export function supportedSiteLabels(): string[] {
  return SITE_CAPABILITIES.filter((site) => site.extractor).map((site) => site.label);
}

/** Platforms the engine cannot resolve, each with the reason the panel has to explain. */
export function unsupportedSites(): Array<{ label: string; reason: SiteReason }> {
  return SITE_CAPABILITIES.filter((site) => !site.extractor && site.reason).map((site) => ({
    label: site.label,
    reason: site.reason as SiteReason,
  }));
}

/** One group of supported labels, keyed so the panel can translate the heading itself. */
export function siteGroups(): Array<{ key: SiteGroupKey; sites: string[] }> {
  const order: SiteGroupKey[] = ["global", "china", "screen", "audio", "live"];
  return order.map((key) => ({
    key,
    sites: SITE_CAPABILITIES.filter((site) => site.group === key && site.extractor).map((site) => site.label),
  }));
}
