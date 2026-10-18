export interface SiteGroup {
  key: string;
  label: string;
  sites: string[];
}

/**
 * Editorially grouped list of the sites lux registers extractors for.
 *
 * lux reports its own `site` string per extraction; this catalogue only powers the empty
 * state and the `video_supported_sites` tool, so it never has to match upstream exactly.
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
    sites: ["Bilibili", "抖音", "快手", "西瓜视频", "微博", "小红书", "知乎", "好看视频", "秒拍", "糖豆"],
  },
  {
    key: "long-form",
    label: "影视与番剧",
    sites: ["优酷", "爱奇艺", "腾讯视频", "芒果 TV", "AcFun", "新片场", "虎扑"],
  },
  {
    key: "audio",
    label: "音频",
    sites: ["网易云音乐", "喜马拉雅", "音悦台", "Zing MP3"],
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
