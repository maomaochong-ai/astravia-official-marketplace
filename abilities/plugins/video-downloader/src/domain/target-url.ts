/**
 * Share sheets, chat apps and short-link apps wrap a link in prose:
 * `7.97 复制打开抖音，看看【…】如果累了就回故乡 https://v.douyin.com/jusf6MklgkI/ eBT:/ n@Q.xF 07/04`.
 * Pasting that whole line into the field must still resolve to the link, so the target is
 * extracted before it reaches the engine.
 */

/** Everything that ends a link inside running text, including CJK prose and full-width punctuation. */
const STOP = `\\s<>"'\\u3000-\\u303f\\u4e00-\\u9fff\\uff00-\\uffef\\u2018\\u2019\\u201c\\u201d\\u00b7`;
const WITH_SCHEME = new RegExp(`https?:\\/\\/[^${STOP}]+`, "giu");
/** `v.douyin.com/abc`, `www.bilibili.com/video/BV1xx`, `b23.tv/abc` — no scheme, still a link. */
const BARE_LINK = new RegExp(`(?:[\\w-]+\\.)+[a-z]{2,}(?:\\/[^${STOP}]*)?`, "giu");
const TRAILING = /[.,;:!?，。；：！？、）)\]】》〉”’"'…]+$/u;
const LEADING = /^[（(【《〈“‘]+/u;
const KNOWN_TLD = /\.(?:com|cn|net|org|tv|me|io|cc|xyz|app|link|to|be|co|so|fm|video)$/iu;

function trimEdges(candidate: string): string {
  return candidate.replace(TRAILING, "").replace(LEADING, "");
}

/** A bare token is only a link when it carries a path or a recognisable top-level domain. */
function isBareLink(candidate: string): boolean {
  const host = candidate.split("/")[0] ?? "";
  return candidate.includes("/") || KNOWN_TLD.test(host);
}

/**
 * Pull the first usable link out of arbitrary text. Returns an empty string when the text
 * carries no link. A bare host is completed to `https://` so the engine receives a URL.
 */
export function extractTargetUrl(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  for (const match of text.matchAll(WITH_SCHEME)) {
    const candidate = trimEdges(match[0]);
    if (candidate.length > "https://".length) return candidate;
  }

  for (const match of text.matchAll(BARE_LINK)) {
    const candidate = trimEdges(match[0]);
    if (isBareLink(candidate)) return `https://${candidate}`;
  }

  return "";
}
