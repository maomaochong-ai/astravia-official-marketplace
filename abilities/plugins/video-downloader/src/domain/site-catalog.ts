const SITE_LABELS: Record<string, string> = {
  youtube: "YouTube",
  youtu: "YouTube",
  bilibili: "Bilibili",
  b23: "Bilibili",
  douyin: "抖音",
  iesdouyin: "抖音",
  tiktok: "TikTok",
  twitter: "X",
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  vimeo: "Vimeo",
  reddit: "Reddit",
  tumblr: "Tumblr",
  pinterest: "Pinterest",
  threads: "Threads",
  rumble: "Rumble",
  odysee: "Odysee",
  bitchute: "BitChute",
  vk: "VK",
  weibo: "微博",
  kuaishou: "快手",
  ixigua: "西瓜视频",
  xiaohongshu: "小红书",
  zhihu: "知乎",
  youku: "优酷",
  iqiyi: "爱奇艺",
  iq: "爱奇艺",
  qq: "腾讯视频",
  mgtv: "芒果 TV",
  acfun: "AcFun",
  ximalaya: "喜马拉雅",
  netease: "网易云音乐",
  "163": "网易云音乐",
  yinyuetai: "音悦台",
  zingmp3: "Zing MP3",
  zing: "Zing MP3",
  huya: "虎牙",
  douyu: "斗鱼",
  haokan: "好看视频",
  miaopai: "秒拍",
  tangdou: "糖豆",
  hupu: "虎扑",
  xinpianchang: "新片场",
  udn: "UDN",
  geekbang: "极客时间",
  bcy: "半次元",
  pixivision: "Pixivision",
  toutiao: "今日头条",
};

const GENERIC_HINTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /youtu\.?be/iu, label: "YouTube" },
  { pattern: /bilibili|b23\.tv/iu, label: "Bilibili" },
  { pattern: /douyin/iu, label: "抖音" },
  { pattern: /xiaohongshu|xhslink/iu, label: "小红书" },
  { pattern: /instagram/iu, label: "Instagram" },
  { pattern: /tiktok/iu, label: "TikTok" },
  { pattern: /twitter|x\.com/iu, label: "X" },
  { pattern: /weibo/iu, label: "微博" },
];

/** Human label for the `site` string lux reports, falling back to the URL host. */
export function siteLabel(site: string | undefined, url?: string, unknown = "Unknown"): string {
  const key = (site ?? "").trim().toLowerCase();
  if (key && SITE_LABELS[key]) return SITE_LABELS[key];
  if (url) {
    for (const hint of GENERIC_HINTS) {
      if (hint.pattern.test(url)) return hint.label;
    }
    try {
      const host = new URL(url).hostname.replace(/^www\./u, "");
      const brand = host.split(".")[0] ?? "";
      if (brand) return brand.charAt(0).toUpperCase() + brand.slice(1);
    } catch {
      // Not a URL we can parse.
    }
  }
  if (!key) return unknown;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Single glyph used in the monogram tile; avoids inventing brand artwork. */
export function siteMonogram(site: string | undefined, url?: string): string {
  const label = siteLabel(site, url);
  const first = [...label][0] ?? "?";
  return first.toUpperCase();
}

/** The curated subset shown in the empty state, shortest first. */
export const FEATURED_SITES = [
  "YouTube",
  "Bilibili",
  "抖音",
  "小红书",
  "X",
  "Instagram",
  "TikTok",
  "微博",
  "快手",
  "西瓜视频",
  "知乎",
  "优酷",
  "爱奇艺",
  "Vimeo",
] as const;
