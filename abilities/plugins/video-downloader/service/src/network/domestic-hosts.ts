/**
 * Hosts that are reached directly even when a proxy is configured.
 *
 * The two user populations need opposite egress: a foreign platform is only reachable through a
 * proxy, while a domestic platform is normally reachable directly and a foreign exit node is both
 * slower and, for licensed video services, geo-blocked. Routing both through one setting makes the
 * fix for one population the bug for the other, so the engine's `--proxy` is resolved per URL.
 *
 * The list is a suffix table rather than a full domain list because the media itself is served
 * from CDN hosts (`*.bilivideo.com`, `*.douyinvod.com`) that the extractor never names in advance.
 */
const DOMESTIC_SUFFIXES: readonly string[] = [
  // Country TLD: every service under it is domestic by definition.
  "cn",
  // ByteDance
  "douyin.com",
  "iesdouyin.com",
  "douyinvod.com",
  "douyinpic.com",
  "byteimg.com",
  "bytedance.com",
  "snssdk.com",
  "ixigua.com",
  "ixiguavideo.com",
  // Bilibili
  "bilibili.com",
  "bilivideo.com",
  "bilivideo.cn",
  "b23.tv",
  "hdslb.com",
  // Tencent video / QQ music
  "qq.com",
  "gtimg.cn",
  "qpic.cn",
  "tc.qq.com",
  "video.qq.com",
  // iQiyi / Youku / Mango
  "iqiyi.com",
  "qiyi.com",
  "71.am",
  "iqiyipic.com",
  "youku.com",
  "tudou.com",
  "alicdn.com",
  "mgtv.com",
  "hitv.com",
  // Weibo
  "weibo.com",
  "weibo.cn",
  "sinaimg.cn",
  "weibocdn.com",
  "sina.com.cn",
  // Short-video / social
  "xiaohongshu.com",
  "xhscdn.com",
  "xhslink.com",
  "kuaishou.com",
  "kwai.com",
  "gifshow.com",
  "zhihu.com",
  "zhimg.com",
  "acfun.cn",
  "douyu.com",
  "huya.com",
  "bilibili.tv",
  // Music / audio
  "163.com",
  "126.net",
  "ximalaya.com",
  "xmcdn.com",
  "qingting.fm",
  "lizhi.fm",
  // Other domestic video portals
  "sohu.com",
  "itc.cn",
  "baidu.com",
  "bdstatic.com",
  "haokan.com",
  "miaopai.com",
  "tangdou.com",
  "yinyuetai.com",
  "xinpianchang.com",
  "hupu.com",
];

/** `hostname` of a URL string, or `""` when it does not parse. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isDomesticHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\./u, "");
  if (!host) return false;
  return DOMESTIC_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function isDomesticUrl(url: string): boolean {
  return isDomesticHost(hostnameOf(url));
}
