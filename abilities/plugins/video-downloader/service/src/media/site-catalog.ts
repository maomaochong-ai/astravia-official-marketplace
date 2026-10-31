export interface SiteGroup {
  key: string;
  label: string;
  sites: string[];
}

/**
 * Editorially grouped list of the platforms the pinned engine registers extractors for.
 *
 * The engine reports its own `site` string per extraction; this catalogue only powers the empty
 * state and the `video_supported_sites` tool. It lists what actually has an extractor: a platform
 * without one always ends in "no formats", so advertising it would turn a missing engine feature
 * into a support ticket. `site-capabilities` is the machine-readable form of the same fact.
 */
export const SITE_GROUPS: SiteGroup[] = [
  {
    key: "global-video",
    label: "国际平台",
    sites: ["YouTube", "Instagram", "TikTok", "X", "Facebook", "Vimeo", "Reddit", "Tumblr", "Pinterest", "Threads"],
  },
  {
    key: "china-video",
    label: "国内平台",
    sites: ["Bilibili", "抖音", "西瓜视频", "微博", "小红书", "知乎"],
  },
  {
    key: "long-form",
    label: "影视与番剧",
    sites: ["优酷", "爱奇艺", "腾讯视频", "芒果 TV", "AcFun", "新片场", "搜狐视频"],
  },
  {
    key: "audio",
    label: "音频",
    sites: ["网易云音乐", "QQ 音乐", "喜马拉雅", "Zing MP3"],
  },
  {
    key: "live",
    label: "直播",
    sites: ["虎牙", "斗鱼"],
  },
];

export function describeSiteGroups(): Array<{ name: string; sites: string[] }> {
  return SITE_GROUPS.map((group) => ({ name: group.label, sites: group.sites }));
}
