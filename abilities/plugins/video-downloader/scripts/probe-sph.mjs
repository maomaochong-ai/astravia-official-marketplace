#!/usr/bin/env node
/**
 * Live check for a WeChat Channels (视频号) share link.
 *
 * The built-in adapter is metadata-only on purpose: the share page renders a preview shell and the
 * stream address is handed to the WeChat client, so "no address" is the expected answer rather than
 * a bug. This script records that conclusion against a real link, so a future regression (or a page
 * that starts exposing a real stream) is visible instead of argued about.
 *
 * usage:
 *   node scripts/probe-sph.mjs "https://weixin.qq.com/sph/AfDHNPBu7M"
 *   node scripts/probe-sph.mjs <url> --json
 *
 * Playwright is not a dependency of this plugin. Point NODE_PATH at an install, e.g.
 *   NODE_PATH=$(npm root -g) node scripts/probe-sph.mjs <url>
 */
import { createRequire } from "node:module";

const MEDIA_PATTERN = /\.(m3u8|mp4|m4v|webm|mov|m4a|mp3)(\?|#|$)/iu;
const DEFAULT_TIMEOUT_MS = 30_000;

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const url = argv.find((argument) => !argument.startsWith("--"));

if (!url) {
  console.error('usage: node scripts/probe-sph.mjs "<share link>" [--json]');
  process.exit(2);
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core"].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try the next one
    }
  }
  console.error(
    "playwright is not resolvable from here.\n" +
      "  NODE_PATH=$(npm root -g) node scripts/probe-sph.mjs <url>\n" +
      "or set PLAYWRIGHT_MODULE=/abs/path/to/playwright",
  );
  process.exit(3);
}

const { chromium } = loadPlaywright();

const browser = await chromium.launch({
  channel: "chrome",
  // The panel resolves domestic sites directly; the probe must see the same page, not the VPN exit.
  args: ["--proxy-server=direct://", "--proxy-bypass-list=*"],
});

const started = Date.now();
try {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const media = new Set();
  page.on("response", (response) => {
    const target = response.url();
    if (MEDIA_PATTERN.test(target)) media.add(target);
  });

  await page.goto(url, { waitUntil: "load", timeout: DEFAULT_TIMEOUT_MS });
  // The preview shell hydrates after load; give the player its chance to request a stream.
  await page.waitForTimeout(6_000);

  const facts = await page.evaluate(() => {
    const content = (selector) => {
      const element = document.querySelector(selector);
      return element ? String(element.getAttribute("content") || "").trim() : "";
    };
    const videos = Array.from(document.querySelectorAll("video, source")).map((element) => ({
      src: element.getAttribute("src") || "",
      currentSrc: element.currentSrc || "",
    }));
    return {
      title: content('meta[property="og:title"]') || document.title,
      thumbnailUrl: content('meta[property="og:image"]'),
      uploader: content('meta[property="og:site_name"]'),
      videos,
      textLength: (document.body?.innerText || "").length,
      text: (document.body?.innerText || "").slice(0, 400),
      hasQrHint: /扫码|前往微信|微信观看/u.test(document.body?.innerText || ""),
    };
  });

  const playable = [...media].filter((entry) => MEDIA_PATTERN.test(entry));
  const verdict = playable.length > 0 ? "playable" : "client-only";

  const report = {
    url,
    finalUrl: page.url(),
    elapsedMs: Date.now() - started,
    verdict,
    title: facts.title,
    uploader: facts.uploader,
    thumbnailUrl: facts.thumbnailUrl,
    videos: facts.videos.filter((entry) => entry.src || entry.currentSrc),
    media: playable.slice(0, 10),
    textLength: facts.textLength,
    hasQrHint: facts.hasQrHint,
    text: facts.text,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`verdict      ${report.verdict}`);
    console.log(`title        ${report.title}`);
    console.log(`uploader     ${report.uploader || "—"}`);
    console.log(`cover        ${report.thumbnailUrl || "—"}`);
    console.log(`media found  ${report.media.length}`);
    console.log(`qr hint      ${report.hasQrHint}`);
    console.log(`elapsed      ${report.elapsedMs} ms`);
    console.log("");
    console.log("The WeChat Channels adapter reports title/author/cover only; this verdict confirms whether");
    console.log("the page exposed a stream address, not whether the panel can download one.");
  }

  process.exitCode = verdict === "client-only" ? 0 : 0;
} catch (error) {
  console.error(`probe failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
