import { hostnameOf } from "../network/domestic-hosts.js";

/**
 * What the engine can and cannot do per platform, from the extractor set of the pinned build.
 *
 * Two failure modes have to be separated before a request is spent on them:
 * a platform the engine has no extractor for (no request will ever work) and a platform whose page
 * only yields formats with a cookie. Without this table both surface as a 25-second timeout and the
 * same generic message, which reads as a plugin bug instead of a missing session.
 */
export interface SiteCapability {
  key: string;
  label: string;
  hosts: string[];
  /** `false` means the pinned engine ships no extractor for the host. */
  extractor: boolean;
  /** What the page needs before it yields formats. */
  cookie: "none" | "anonymous" | "session";
  /** The page parses anonymously, but its full quality needs a signed-in session. */
  loginForQuality?: boolean;
}

export const SITE_CAPABILITIES: readonly SiteCapability[] = [
  { key: "bilibili", label: "哔哩哔哩", hosts: ["bilibili.com", "b23.tv"], extractor: true, cookie: "none", loginForQuality: true },
  { key: "douyin", label: "抖音", hosts: ["douyin.com", "iesdouyin.com"], extractor: true, cookie: "session" },
  { key: "ixigua", label: "西瓜视频", hosts: ["ixigua.com"], extractor: true, cookie: "anonymous" },
  { key: "xiaohongshu", label: "小红书", hosts: ["xiaohongshu.com", "xhslink.com"], extractor: true, cookie: "session" },
  { key: "weibo", label: "微博", hosts: ["weibo.com", "weibo.cn"], extractor: true, cookie: "session" },
  { key: "zhihu", label: "知乎", hosts: ["zhihu.com"], extractor: true, cookie: "none" },
  { key: "qq-video", label: "腾讯视频", hosts: ["v.qq.com"], extractor: true, cookie: "none" },
  { key: "iqiyi", label: "爱奇艺", hosts: ["iqiyi.com"], extractor: true, cookie: "session" },
  { key: "youku", label: "优酷", hosts: ["youku.com"], extractor: true, cookie: "none" },
  { key: "mgtv", label: "芒果 TV", hosts: ["mgtv.com"], extractor: true, cookie: "session" },
  { key: "acfun", label: "AcFun", hosts: ["acfun.cn"], extractor: true, cookie: "none" },
  { key: "douyu", label: "斗鱼", hosts: ["douyu.com"], extractor: true, cookie: "none" },
  { key: "huya", label: "虎牙", hosts: ["huya.com"], extractor: true, cookie: "none" },
  { key: "netease-music", label: "网易云音乐", hosts: ["music.163.com"], extractor: true, cookie: "none" },
  { key: "qq-music", label: "QQ 音乐", hosts: ["y.qq.com"], extractor: true, cookie: "session" },
  { key: "ximalaya", label: "喜马拉雅", hosts: ["ximalaya.com"], extractor: true, cookie: "none" },
  { key: "xinpianchang", label: "新片场", hosts: ["xinpianchang.com"], extractor: true, cookie: "none" },
  { key: "sohu", label: "搜狐视频", hosts: ["tv.sohu.com", "sohu.com"], extractor: true, cookie: "none" },
  // No extractor in the pinned engine: reported up front instead of after a wasted request.
  { key: "kuaishou", label: "快手", hosts: ["kuaishou.com", "kwai.com", "gifshow.com"], extractor: false, cookie: "none" },
  { key: "haokan", label: "好看视频", hosts: ["haokan.baidu.com"], extractor: false, cookie: "none" },
  { key: "miaopai", label: "秒拍", hosts: ["miaopai.com"], extractor: false, cookie: "none" },
  { key: "tangdou", label: "糖豆", hosts: ["tangdou.com"], extractor: false, cookie: "none" },
  { key: "yinyuetai", label: "音悦台", hosts: ["yinyuetai.com"], extractor: false, cookie: "none" },
  { key: "hupu", label: "虎扑", hosts: ["hupu.com"], extractor: false, cookie: "none" },
  { key: "qingting", label: "蜻蜓 FM", hosts: ["qingting.fm"], extractor: false, cookie: "none" },
];

export function capabilityForHost(hostname: string): SiteCapability | null {
  const host = hostname.trim().toLowerCase().replace(/^\./u, "");
  if (!host) return null;
  return SITE_CAPABILITIES.find((site) => site.hosts.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) ?? null;
}

export function capabilityForUrl(url: string): SiteCapability | null {
  return capabilityForHost(hostnameOf(url));
}

/**
 * Suffix list for the panel's "supported platforms" copy, derived from the table so the panel can
 * never advertise a platform the engine cannot extract.
 */
export function supportedSiteLabels(): string[] {
  return SITE_CAPABILITIES.filter((site) => site.extractor).map((site) => site.label);
}
