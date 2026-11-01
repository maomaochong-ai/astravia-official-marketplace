import { adapterId, type Adapter } from "./adapter";

/**
 * Adapters that ship with the plugin.
 *
 * ADR 0001 said the plugin would bundle no site script at all. That held while everything relied on
 * the engine; it stopped holding once the engine turned out to be permanently broken on whole
 * categories of page (a signed HLS address that expires, a player that only exposes its state to
 * page script). These three are the minimum that makes "every platform resolves" true in practice,
 * and they are inert unless the user runs one: nothing here talks to the network by itself.
 *
 * They are read-only. A built-in adapter is part of the release, so the panel must not offer to
 * edit or delete it — that state would be lost on the next update.
 */

const SNIFFER_BODY = String.raw`async function extract(ctx) {
  var found = [];
  var isMedia = function (value) {
    if (typeof value !== 'string') return false;
    if (!/^https?:\/\//i.test(value)) return false;
    return /\.(m3u8|mp4|m4v|webm|mov|m4a|mp3)(\?|#|$)/i.test(value);
  };
  var add = function (url, score) { if (isMedia(url)) found.push({ url: url, score: score }); };

  var elements = document.querySelectorAll('video, audio, source');
  for (var i = 0; i < elements.length; i += 1) {
    add(elements[i].currentSrc, 5);
    add(elements[i].getAttribute('src'), 4);
  }

  var metas = document.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"], meta[name="twitter:player:stream"]');
  for (var j = 0; j < metas.length; j += 1) add(metas[j].getAttribute('content'), 3);

  // What the page already fetched is the strongest signal: the player proved the address plays.
  try {
    var entries = performance.getEntriesByType('resource');
    for (var k = 0; k < entries.length; k += 1) {
      var name = entries[k].name;
      add(name, /\.m3u8(\?|$)/i.test(name) ? 6 : 2);
    }
  } catch (error) {
    // An opaque frame may not expose performance; the element scan above still stands.
  }

  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (var s = 0; s < scripts.length; s += 1) {
    try {
      var queue = [JSON.parse(scripts[s].textContent || '{}')];
      while (queue.length > 0) {
        var node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        var values = Object.keys(node).map(function (key) { return node[key]; });
        for (var v = 0; v < values.length; v += 1) {
          if (typeof values[v] === 'string') add(values[v], 3);
          else if (values[v] && typeof values[v] === 'object') queue.push(values[v]);
        }
      }
    } catch (error) {
      // A malformed JSON-LD block is not a reason to fail the whole run.
    }
  }

  if (found.length === 0) throw new Error('页面里没有发现可以直接播放的媒体地址');
  found.sort(function (a, b) { return b.score - a.score; });

  var content = function (selector) {
    var element = document.querySelector(selector);
    return element ? String(element.getAttribute('content') || '').trim() : '';
  };
  return {
    directUrl: found[0].url,
    title: content('meta[property="og:title"]') || document.title,
    thumbnailUrl: content('meta[property="og:image"]'),
    uploader: content('meta[property="og:site_name"]'),
    headers: { referer: location.href }
  };
}`;

const IQIYI_BODY = String.raw`async function extract(ctx) {
  var playback = window.playback;
  var info = playback && playback.msePlayback && playback.msePlayback._mvInfo;
  if (!info) throw new Error('播放器还没有取得播放信息：先在页面里播放几秒，再运行适配器');

  // The player exposes one object per rendition; the m3u8 address can sit anywhere in it, so the
  // whole tree is walked instead of reading a fixed field the site renames between releases.
  var urls = [];
  var walk = function (node, depth) {
    if (!node || typeof node !== 'object' || depth > 6) return;
    Object.keys(node).forEach(function (key) {
      var value = node[key];
      if (typeof value === 'string' && /^https?:\/\//i.test(value) && value.indexOf('.m3u8') > -1) urls.push(value);
      else if (value && typeof value === 'object') walk(value, depth + 1);
    });
  };
  walk(info, 0);
  if (urls.length === 0) throw new Error('播放信息里没有 .m3u8 地址，页面可能已经换了播放器');

  // A higher number in the name is a higher rendition on this site; ties keep the player's order.
  var score = function (url) {
    var hit = /(?:^|[^0-9])(\d{3,4})(?:[^0-9]|$)/.exec(url);
    return hit ? Number(hit[1]) : 0;
  };
  urls.sort(function (a, b) { return score(b) - score(a); });

  var content = function (selector) {
    var element = document.querySelector(selector);
    return element ? String(element.getAttribute('content') || '').trim() : '';
  };
  return {
    directUrl: urls[0],
    title: content('meta[property="og:title"]') || document.title,
    thumbnailUrl: content('meta[property="og:image"]'),
    headers: { referer: location.href, 'user-agent': navigator.userAgent }
  };
}`;

const WEIXIN_CHANNELS_BODY = String.raw`async function extract(ctx) {
  var content = function (selector) {
    var element = document.querySelector(selector);
    return element ? String(element.getAttribute('content') || element.textContent || '').trim() : '';
  };
  var title = content('meta[property="og:title"]') || content('h1') || document.title;
  if (!title) throw new Error('预览页里没有可识别的标题');

  // The share link only opens a preview shell: the stream address is handed to the WeChat client
  // through its own JSAPI and never appears in the page. Reporting the metadata is the honest
  // ceiling here, so the run returns no address instead of inventing one.
  return {
    metadataOnly: true,
    title: title,
    thumbnailUrl: content('meta[property="og:image"]'),
    uploader: content('meta[property="og:site_name"]') || content('.nickname')
  };
}`;

function builtin(name: string, id: string, match: string[], description: string, body: string): Adapter {
  return {
    id,
    meta: { name, version: "1.0.0", match, description, grant: "none" },
    body,
    enabled: true,
    updatedAt: 0,
    builtin: true,
  };
}

export const BUILTIN_ADAPTERS: Adapter[] = [
  builtin(
    "Page Sniffer",
    adapterId("Page Sniffer"),
    ["<all_urls>"],
    "%adapter.builtin.sniffer%",
    SNIFFER_BODY,
  ),
  builtin(
    "iQIYI Player",
    adapterId("iQIYI Player"),
    ["https://*.iqiyi.com/*", "https://m.iqiyi.com/*"],
    "%adapter.builtin.iqiyi%",
    IQIYI_BODY,
  ),
  builtin(
    "WeChat Channels",
    adapterId("WeChat Channels"),
    ["https://weixin.qq.com/sph/*", "https://channels.weixin.qq.com/*"],
    "%adapter.builtin.weixin%",
    WEIXIN_CHANNELS_BODY,
  ),
];

const BUILTIN_IDS = new Set(BUILTIN_ADAPTERS.map((adapter) => adapter.id));

export function isBuiltinAdapter(id: string): boolean {
  return BUILTIN_IDS.has(id);
}
