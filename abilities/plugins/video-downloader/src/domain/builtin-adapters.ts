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
  var looksMedia = function (value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false;
    if (/\.(m3u8|mp4|m4v|webm|mov|m4a|mp3|flv|ts)(\?|#|$)/i.test(value)) return true;
    if (/stodownload|encfilekey|videoplayback|getvideo|playurl|mime=video/i.test(value)) return true;
    return /(m3u8|mp4|hls|dash)/i.test(value) && /\/(playlist|manifest|master|media|stream)(\/|\?|$)/i.test(value);
  };

  var found = [];
  var index = {};
  var add = function (url, score, force) {
    var value = typeof url === 'string' ? url.trim() : '';
    if (!/^https?:\/\//i.test(value)) return;
    if (!force && !looksMedia(value)) return;
    var previous = index[value];
    if (previous) {
      if (score > previous.score) previous.score = score;
      return;
    }
    var entry = { url: value, score: score };
    index[value] = entry;
    found.push(entry);
  };

  // A userscript sees every request the page makes because it is inside that page. So is this:
  // hooking the two request APIs turns the player itself into the oracle for the real address.
  var originalFetch = window.fetch;
  var XHR = window.XMLHttpRequest;
  var originalOpen = XHR && XHR.prototype ? XHR.prototype.open : null;
  if (typeof originalFetch === 'function') {
    window.fetch = function (input, init) {
      try { add(typeof input === 'string' ? input : input && input.url, 8); } catch (error) {}
      return originalFetch.call(this, input, init);
    };
  }
  if (typeof originalOpen === 'function') {
    XHR.prototype.open = function (method, url) {
      try { add(url, 8); } catch (error) {}
      return originalOpen.apply(this, arguments);
    };
  }

  try {
    var elements = document.querySelectorAll('video, audio, source');
    for (var i = 0; i < elements.length; i += 1) {
      // Whatever a media element is bound to is media by definition, extension or not.
      add(elements[i].currentSrc, 9, true);
      add(elements[i].getAttribute('src'), 9, true);
    }

    var metas = document.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"], meta[name="twitter:player:stream"]');
    for (var j = 0; j < metas.length; j += 1) add(metas[j].getAttribute('content'), 3);

    // What the page already fetched is the next strongest signal: the player proved it plays.
    try {
      var entries = performance.getEntriesByType('resource');
      for (var k = 0; k < entries.length; k += 1) {
        var name = entries[k].name;
        add(name, /\.m3u8(\?|$)/i.test(name) ? 6 : 4);
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

    // A player that has not started has not asked for anything yet: nudge it, then read the wire.
    var settled = function () {
      for (var f = 0; f < found.length; f += 1) {
        if (found[f].score >= 8 || /\.m3u8(\?|#|$)/i.test(found[f].url)) return true;
      }
      return false;
    };
    if (!settled()) {
      var videos = document.querySelectorAll('video');
      for (var n = 0; n < videos.length; n += 1) {
        try {
          var played = videos[n].play();
          if (played && typeof played.catch === 'function') played.catch(function () {});
        } catch (error) {
          // Autoplay policies may refuse; the hooks above still catch a later request.
        }
      }
      if (videos.length === 0) {
        var buttons = document.querySelectorAll('[class*="play"], [aria-label*="播放"], [title*="播放"]');
        for (var b = 0; b < buttons.length && b < 3; b += 1) {
          try { buttons[b].click(); } catch (error) {}
        }
      }
      var deadline = Date.now() + 2500;
      while (Date.now() < deadline && !settled()) {
        await new Promise(function (resolve) { setTimeout(resolve, 200); });
      }
    }
  } finally {
    if (typeof originalFetch === 'function') window.fetch = originalFetch;
    if (typeof originalOpen === 'function') XHR.prototype.open = originalOpen;
  }

  // A segment is the inside of a stream, never a stream: keep one only when nothing else exists.
  var ranked = found.filter(function (entry) { return !/\.ts(\?|#|$)/i.test(entry.url); });
  if (ranked.length === 0) ranked = found;
  if (ranked.length === 0) throw new Error('页面里没有发现可以直接播放的媒体地址，可能需要先登录或播放几秒');
  var weight = function (entry) {
    return entry.score + (/\.m3u8(\?|#|$)/i.test(entry.url) ? 4 : 0);
  };
  ranked.sort(function (a, b) { return weight(b) - weight(a); });

  var content = function (selector) {
    var element = document.querySelector(selector);
    return element ? String(element.getAttribute('content') || '').trim() : '';
  };
  return {
    directUrl: ranked[0].url,
    title: content('meta[property="og:title"]') || document.title,
    thumbnailUrl: content('meta[property="og:image"]'),
    uploader: content('meta[property="og:site_name"]'),
    headers: { referer: location.href, 'user-agent': navigator.userAgent }
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
  var uploader = content('meta[property="og:site_name"]') || content('.nickname');
  var cover = content('meta[property="og:image"]');

  var isMedia = function (value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false;
    return /stodownload|encfilekey|finder\.video\.qq\.com|\.(mp4|m3u8|m4v)(\?|#|$)/i.test(value);
  };

  // A logged-in web player plays a plain <video>, so its address is in the DOM or already on the
  // wire. The share shell never plays anything; that difference is the whole story of this site.
  var pick = function () {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i += 1) {
      if (isMedia(videos[i].currentSrc)) return videos[i].currentSrc;
      var src = videos[i].getAttribute('src');
      if (isMedia(src)) return src;
    }
    try {
      var entries = performance.getEntriesByType('resource');
      for (var k = entries.length - 1; k >= 0; k -= 1) {
        if (isMedia(entries[k].name)) return entries[k].name;
      }
    } catch (error) {
      // performance is a bonus signal here, never a precondition.
    }
    return '';
  };

  var url = pick();
  if (!url) {
    var videos = document.querySelectorAll('video');
    for (var n = 0; n < videos.length; n += 1) {
      try {
        var played = videos[n].play();
        if (played && typeof played.catch === 'function') played.catch(function () {});
      } catch (error) {
        // Refusing to autoplay is not a failure: the address may still arrive from the request.
      }
    }
    var deadline = Date.now() + 2500;
    while (Date.now() < deadline && !url) {
      await new Promise(function (resolve) { setTimeout(resolve, 250); });
      url = pick();
    }
  }

  if (url) {
    return {
      directUrl: url,
      title: title || '视频号',
      thumbnailUrl: cover,
      uploader: uploader,
      headers: { referer: location.href, 'user-agent': navigator.userAgent }
    };
  }

  // No address and a login prompt on screen means the user is one scan away. Saying so keeps the
  // panel honest: a metadata-only answer here would read as "the plugin gave up for no reason".
  var marks = document.querySelectorAll('img[src*="qrcode"], [class*="qrcode"], [class*="login"]');
  var text = (document.body && document.body.textContent) || '';
  if (marks.length > 0 || /扫码登录|微信扫码|登录后查看|请使用微信/.test(text)) {
    throw new Error('NEEDS_LOGIN:视频号这一步需要登录：用手机微信扫描面板里的二维码，扫完点重试');
  }

  if (!title) throw new Error('预览页里没有可识别的标题');
  return { metadataOnly: true, title: title, thumbnailUrl: cover, uploader: uploader };
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
