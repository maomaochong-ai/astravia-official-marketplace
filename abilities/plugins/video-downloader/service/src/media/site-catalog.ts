import { siteGroups, unsupportedSites, type SiteGroupKey, type SiteReason } from "./site-capabilities.js";

/**
 * Presentation of the capability table, grouped for the panel and the `video_supported_sites` tool.
 *
 * The names below are the Chinese display labels the tool output has always used; the panel reads
 * the same groups through `/api/v1/sites` and translates `key` itself.
 */
const GROUP_NAMES: Record<SiteGroupKey, string> = {
  global: "国际平台",
  china: "国内平台",
  screen: "影视与番剧",
  audio: "音频",
  live: "直播",
};

export interface SiteGroup {
  key: SiteGroupKey;
  name: string;
  sites: string[];
}

export const SITE_GROUPS: SiteGroup[] = siteGroups()
  .filter((group) => group.sites.length > 0)
  .map((group) => ({ key: group.key, name: GROUP_NAMES[group.key], sites: group.sites }));

export function describeSiteGroups(): Array<{ name: string; sites: string[] }> {
  return SITE_GROUPS.map((group) => ({ name: group.name, sites: group.sites }));
}

/** Platforms the pinned engine cannot resolve, with the machine readable reason. */
export function describeUnsupportedSites(): Array<{ label: string; reason: SiteReason }> {
  return unsupportedSites();
}
