#!/usr/bin/env node
/**
 * Check one URL against the engine the plugin actually ships.
 *
 * Run this by hand when a user reports "this link does not parse". It answers three questions in
 * one shot: what the pinned engine resolves, how it fails when it does, and whether the URL belongs
 * to a site the coverage table already marks as unsupported.
 *
 *   node scripts/probe-url.mjs "https://www.iqiyi.com/v_xxxx.html"
 *   node scripts/probe-url.mjs "<url>" --proxy http://127.0.0.1:7897
 *   node scripts/probe-url.mjs "<url>" --json
 *
 * It talks to no plugin runtime: it spawns yt-dlp directly, so a local diagnosis does not depend on
 * the panel, the service or a running Desktop session. Nothing is downloaded; `--dump-single-json`
 * only resolves metadata.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_YTDLP = join(
  homedir(),
  ".astravia/plugin-services/video-downloader/video-downloader/data/bin/yt-dlp",
);

/** Sites whose pinned extractor is known to be dead; mirrors `service/src/media/site-capabilities.ts`. */
const KNOWN_UNSUPPORTED = new Map([
  ["iqiyi.com", "extractor no longer finds a tvid and its tmts API answers 502"],
  ["threads.net", "no extractor in the pinned build"],
  ["kuaishou.com", "no extractor in the pinned build"],
  ["haokan.baidu.com", "no extractor in the pinned build"],
  ["mgtv.com", "no extractor in the pinned build"],
  ["kuwo.cn", "upstream extractor broken"],
]);

function parseArgs(argv) {
  const options = { url: "", ytdlp: process.env.ASTRAVIA_YTDLP || DEFAULT_YTDLP, proxy: "", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--ytdlp") options.ytdlp = argv[(index += 1)] ?? options.ytdlp;
    else if (arg === "--proxy") options.proxy = argv[(index += 1)] ?? "";
    else if (!options.url) options.url = arg;
  }
  return options;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function knownSite(host) {
  for (const [suffix, reason] of KNOWN_UNSUPPORTED) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return { suffix, reason };
  }
  return null;
}

function run(executable, args) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => resolve({ code: -1, stdout, stderr: `${stderr}${error.message}` }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

function firstError(stderr) {
  const line = stderr
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => /ERROR|Unsupported URL|Unable to|Sign in|not available/i.test(entry))
    .pop();
  return line ?? stderr.trim().split("\n").slice(-1)[0] ?? "";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.url) {
    console.error("usage: node scripts/probe-url.mjs <url> [--proxy <url>] [--ytdlp <path>] [--json]");
    process.exitCode = 2;
    return;
  }
  if (!existsSync(options.ytdlp)) {
    console.error(`yt-dlp not found at ${options.ytdlp}; pass --ytdlp <path> or install the plugin once`);
    process.exitCode = 2;
    return;
  }

  const host = hostOf(options.url);
  const site = knownSite(host);
  // Matches the service: a configured proxy that this URL bypasses still gets an explicit empty
  // --proxy, otherwise the engine inherits the OS proxy and a domestic platform drops the request.
  const args = ["--dump-single-json", "--no-playlist", "--no-progress", "--socket-timeout", "25"];
  args.push("--proxy", options.proxy || "");
  args.push(options.url);

  const startedAt = Date.now();
  const result = await run(options.ytdlp, args);
  const elapsedMs = Date.now() - startedAt;

  const report = { url: options.url, host, elapsedMs, engine: { ok: false, failure: "", formats: 0, title: "" } };
  if (result.code === 0 && result.stdout.trim()) {
    try {
      const info = JSON.parse(result.stdout);
      report.engine = {
        ok: true,
        failure: "",
        formats: Array.isArray(info.formats) ? info.formats.length : 0,
        title: typeof info.title === "string" ? info.title : "",
      };
    } catch (error) {
      report.engine.failure = `unreadable engine output: ${String(error.message || error)}`;
    }
  } else {
    report.engine.failure = firstError(result.stderr);
  }

  report.verdict = report.engine.ok ? "engine" : site ? "adapter-only" : "unresolved";
  report.note = site
    ? `${site.suffix} is marked unsupported in the coverage table: ${site.reason}`
    : report.engine.ok
      ? ""
      : "the engine produced no metadata and the coverage table has no entry for this host";

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`verdict   ${report.verdict}`);
  console.log(`host      ${report.host || "(unparseable)"}`);
  console.log(`elapsed   ${report.elapsedMs} ms`);
  if (report.engine.ok) {
    console.log(`title     ${report.engine.title}`);
    console.log(`formats   ${report.engine.formats}`);
  } else {
    console.log(`failure   ${report.engine.failure}`);
  }
  if (report.note) console.log(`note      ${report.note}`);
}

await main();
