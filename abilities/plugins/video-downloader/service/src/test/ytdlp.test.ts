import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_FILE_HEADER,
  cookieFileContent,
  cookieDomainsFor,
  cookieHeaderToNetscape,
  cookieFilePath,
  isNetscapeCookieFile,
  removeCookieFile,
  writeCookieFile,
} from "../ytdlp/cookies.js";
import {
  codeOfYtdlpFailure,
  describeYtdlpFailure,
  firstActionableYtdlpLine,
  firstYtdlpErrorLine,
} from "../ytdlp/diagnostics.js";
import { jsRuntimeArgs, proxyArgs } from "../ytdlp/engine-args.js";
import { flattenYtdlpEntries, normalizeYtdlpInfo } from "../ytdlp/normalize.js";
import { YTDLP_VERSION, ytdlpBinaryName, ytdlpReleaseFor, ytdlpReleasePath } from "../ytdlp/ytdlp-release.js";
import { YtdlpInstaller } from "../ytdlp/ytdlp-installer.js";

const HEADER = "name=value; uid=abc123";


describe("cookies", () => {
  it("recognises a Netscape jar by its header or by seven tab-separated columns", () => {
    expect(isNetscapeCookieFile(COOKIE_FILE_HEADER)).toBe(true);
    expect(isNetscapeCookieFile("# HTTP Cookie File")).toBe(true);
    expect(isNetscapeCookieFile(".douyin.com\tTRUE\t/\tFALSE\t0\tttwid\tv")).toBe(true);
    expect(isNetscapeCookieFile(HEADER)).toBe(false);
  });

  it("attaches a host cookie to the host and its parent domain", () => {
    expect(cookieDomainsFor("www.douyin.com")).toEqual([".www.douyin.com", ".douyin.com"]);
    expect(cookieDomainsFor("b23.tv")).toEqual([".b23.tv"]);
    expect(cookieDomainsFor("")).toEqual([]);
  });

  it("writes one Netscape line per domain and ignores Set-Cookie attributes", () => {
    const content = cookieHeaderToNetscape(`${HEADER}; Path=/; HttpOnly; Secure`, "www.example.com");
    const lines = content.trimEnd().split("\n");
    expect(lines[0]).toBe(COOKIE_FILE_HEADER);
    // Two domains x two cookies, and no `Path`/`HttpOnly` pseudo-cookies.
    expect(lines).toHaveLength(1 + 4);
    expect(lines[1]?.startsWith(".www.example.com\tTRUE\t/\tFALSE\t")).toBe(true);
    expect(content).toContain("\tname\tvalue");
    expect(content).not.toContain("Path");
  });

  it("drops a leading `Cookie:` label but keeps the pairs behind it", () => {
    const content = cookieHeaderToNetscape("Cookie: a=1; b=2", "x.test");
    expect(content).toContain("\ta\t1");
    expect(content).toContain("\tb\t2");
    expect(content).not.toContain("Cookie:");
  });

  it("passes an exported jar through untouched and refuses an empty value", () => {
    const jar = `${COOKIE_FILE_HEADER}\n.douyin.com\tTRUE\t/\tFALSE\t0\tttwid\tabc\n`;
    expect(cookieFileContent(jar, "https://www.douyin.com/video/1")).toBe(jar);
    expect(cookieFileContent("   ", "https://www.douyin.com/video/1")).toBeNull();
    expect(cookieFileContent(HEADER, "not a url")).toBeNull();
    expect(cookieFileContent(";;;", "https://www.douyin.com/video/1")).toBeNull();
  });

  it("materialises the jar 0600 inside a 0700 directory and removes it again", async () => {
    const root = await mkdtemp(join(tmpdir(), "vd-cookies-"));
    try {
      const path = await writeCookieFile(root, HEADER, "https://v.douyin.com/abc/", "task-1");
      expect(path).toBe(cookieFilePath(root, "task-1"));
      expect((await stat(path ?? "")).mode & 0o777).toBe(0o600);
      expect((await stat(join(root, "cookies"))).mode & 0o777).toBe(0o700);
      expect(await readFile(path ?? "", "utf8")).toContain("\tuid\tabc123");

      await removeCookieFile(path);
      await expect(stat(path ?? "")).rejects.toThrow();
      // Removing nothing is not an error.
      await expect(removeCookieFile(null)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("yt-dlp diagnostics", () => {
  it("prefers the ERROR line and strips its prefix", () => {
    const stderr = "[Douyin] 123: Downloading webpage\nWARNING: something\nERROR: [Douyin] 123: Fresh cookies (not necessarily logged in) are needed\nTraceback";
    expect(firstYtdlpErrorLine(stderr)).toBe("[Douyin] 123: Fresh cookies (not necessarily logged in) are needed");
  });

  it("falls back to the first line that is neither a warning nor an extractor log", () => {
    expect(firstYtdlpErrorLine("WARNING: x\n[info] y\nboom\n")).toBe("boom");
    expect(firstYtdlpErrorLine("")).toBeNull();
  });

  it("classifies a cookie hint before the 403 that accompanies it", () => {
    expect(codeOfYtdlpFailure("Fresh cookies (not necessarily logged in) are needed")).toBe("auth_required");
    expect(codeOfYtdlpFailure("HTTP Error 403: Forbidden")).toBe("site_blocked");
    expect(codeOfYtdlpFailure("Read timed out")).toBe("network_timeout");
    expect(codeOfYtdlpFailure("getaddrinfo ENOTFOUND www.example.com")).toBe("network_blocked");
    expect(codeOfYtdlpFailure("Unsupported URL: https://example.com")).toBe("site_unsupported");
  });

  it("never reports an empty cause", () => {
    expect(describeYtdlpFailure("  ")).toBe("yt-dlp 未能解析该链接");
    expect(describeYtdlpFailure("x".repeat(400))).toHaveLength(240);
  });

  it("surfaces a warning that explains an empty result", () => {
    // `--no-warnings` used to hide exactly this line, leaving only "No video formats found!".
    const stderr = [
      "[youtube] Extracting URL: https://www.youtube.com/watch?v=x",
      "WARNING: [youtube] No supported JavaScript runtime could be found. Some formats may be missing.",
    ].join("\n");
    expect(firstActionableYtdlpLine(stderr)).toBe(
      "[youtube] No supported JavaScript runtime could be found. Some formats may be missing.",
    );
    // An ERROR still outranks any warning, and incidental noise never becomes the message.
    expect(firstActionableYtdlpLine("WARNING: nsig extraction failed\nERROR: [x] Failed to parse JSON")).toBe(
      "[x] Failed to parse JSON",
    );
    expect(firstActionableYtdlpLine("WARNING: [generic] Falling back to generic extractor")).toBeNull();
  });
});

describe("yt-dlp engine arguments", () => {
  it("advertises a JS runtime so signature solving works", () => {
    expect(jsRuntimeArgs("/opt/astravia/node")).toEqual(["--js-runtimes", "node:/opt/astravia"]);
    // An embedded host is not node, so resolution is left to yt-dlp's own PATH lookup.
    expect(jsRuntimeArgs("/usr/bin/electron")).toEqual(["--js-runtimes", "node"]);
  });

  it("passes the proxy only when one is configured", () => {
    expect(proxyArgs("")).toEqual([]);
    expect(proxyArgs("   ")).toEqual([]);
    expect(proxyArgs("socks5://127.0.0.1:1080")).toEqual(["--proxy", "socks5://127.0.0.1:1080"]);
  });
});

describe("yt-dlp normalisation", () => {
  const info = {
    id: "1",
    title: "Clip",
    extractor_key: "Douyin",
    webpage_url: "https://www.douyin.com/video/1",
    formats: [
      { format_id: "sb0", ext: "mhtml", vcodec: "none", acodec: "none" },
      { format_id: "h264-360", ext: "mp4", vcodec: "h264", acodec: "aac", height: 360, filesize: 900 },
      { format_id: "h265-1080", ext: "mp4", vcodec: "h265", acodec: "none", height: 1080, fps: 60, filesize: 4_000 },
      { format_id: "audio", ext: "m4a", vcodec: "none", acodec: "aac", abr: 128, filesize: 500 },
    ],
  };

  it("turns a video-only stream into a merge selector and counts two transfers", () => {
    const item = normalizeYtdlpInfo(info, 0);
    const merged = item?.formats.find((format) => format.quality === "1080P");
    expect(merged?.id).toBe("h265-1080+bestaudio/best");
    expect(merged?.needsFfmpeg).toBe(true);
    expect(merged?.partCount).toBe(2);
    const progressive = item?.formats.find((format) => format.quality === "360P");
    expect(progressive?.id).toBe("h264-360");
    expect(progressive?.partCount).toBe(1);
  });

  it("carries cover art, runtime and uploader through to the panel", () => {
    const item = normalizeYtdlpInfo(
      { ...info, thumbnail: " https://img.example/cover.jpg ", duration: 93.6, uploader: "作者" },
      0,
    );
    expect(item?.thumbnailUrl).toBe("https://img.example/cover.jpg");
    expect(item?.durationSeconds).toBe(94);
    expect(item?.uploader).toBe("作者");
    // Sites that expose only a channel keep the name; neither means an empty string, not null.
    expect(normalizeYtdlpInfo({ ...info, channel: "频道" }, 0)?.uploader).toBe("频道");
    expect(normalizeYtdlpInfo(info, 0)?.uploader).toBe("");
    expect(normalizeYtdlpInfo(info, 0)?.thumbnailUrl).toBe("");
    expect(normalizeYtdlpInfo(info, 0)?.durationSeconds).toBe(0);
  });

  it("ranks the highest rendition first, keeps audio last, and drops storyboards", () => {
    const item = normalizeYtdlpInfo(info, 0);
    expect(item?.formats.map((format) => format.quality)).toEqual(["1080P", "360P", "音频 128k"]);
    expect(item?.recommendedFormatId).toBe("h265-1080+bestaudio/best");
    expect(item?.site).toBe("Douyin");
    expect(item?.sourceUrl).toBe("https://www.douyin.com/video/1");
    expect(item?.formats.some((format) => format.ext === "mhtml")).toBe(false);
  });

  it("refuses an entry without a URL or without playable formats", () => {
    expect(normalizeYtdlpInfo({ ...info, webpage_url: undefined, original_url: undefined, url: undefined }, 0)).toBeNull();
    expect(normalizeYtdlpInfo({ ...info, formats: [] }, 0)).toBeNull();
  });

  it("flattens a playlist and caps it", () => {
    const entries = Array.from({ length: 60 }, (_, index) => ({ ...info, id: String(index) }));
    expect(flattenYtdlpEntries({ ...info, entries })).toHaveLength(50);
    expect(flattenYtdlpEntries(info)).toEqual([info]);
  });
});

describe("yt-dlp release pinning", () => {
  it("pins an exact version instead of following latest", () => {
    expect(YTDLP_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}$/u);
    const pinned = ytdlpReleaseFor("darwin", "arm64");
    expect(pinned?.sources[0]).toContain(`/download/${YTDLP_VERSION}/`);
    // Mirrors are tried in order and every one must point at the same asset name.
    expect(pinned?.sources.length).toBeGreaterThan(1);
    for (const source of pinned?.sources ?? []) expect(source.endsWith("/yt-dlp_macos")).toBe(true);
  });

  it("uses a native Windows ARM64 asset rather than the x64 one", () => {
    expect(ytdlpReleaseFor("win32", "arm64")?.asset).toBe("yt-dlp_arm64.exe");
    expect(ytdlpReleaseFor("win32", "x64")?.asset).toBe("yt-dlp.exe");
    expect(ytdlpBinaryName("win32")).toBe("yt-dlp.exe");
    expect(ytdlpBinaryName("darwin")).toBe("yt-dlp");
  });

  it("reports no build for an unsupported pair", () => {
    expect(ytdlpReleaseFor("linux", "ia32")).toBeNull();
    expect(ytdlpReleasePath("/data")).toBe(join("/data", "bin", "yt-dlp"));
  });

  it("records a byte count and a full sha256 for every supported platform", () => {
    for (const [platform, arch] of [
      ["darwin", "x64"],
      ["darwin", "arm64"],
      ["linux", "x64"],
      ["linux", "arm64"],
      ["win32", "x64"],
      ["win32", "arm64"],
    ] as const) {
      const release = ytdlpReleaseFor(platform, arch);
      expect(release?.sha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(release?.bytes).toBeGreaterThan(1_000_000);
    }
  });
});

describe("YtdlpInstaller", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const payload = Buffer.from("yt-dlp test payload ".repeat(64));
  const digest = createHash("sha256").update(payload).digest("hex");
  const release = {
    version: YTDLP_VERSION,
    asset: "yt-dlp_macos",
    sources: ["https://first.test/yt-dlp_macos", "https://second.test/yt-dlp_macos"],
    sha256: digest,
    bytes: payload.byteLength,
  };

  it("reports an unsupported platform instead of failing at download time", async () => {
    const root = await mkdtemp(join(tmpdir(), "vd-ytdlp-"));
    try {
      const installer = new YtdlpInstaller(root, null);
      expect(installer.snapshot().supported).toBe(false);
      await expect(installer.install()).resolves.toMatchObject({ phase: "failed" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resumes a truncated transfer with a Range request and verifies the digest", async () => {
    const root = await mkdtemp(join(tmpdir(), "vd-ytdlp-"));
    const ranges: Array<string | null> = [];
    let call = 0;
    vi.stubGlobal("fetch", async (_url: string, init?: { headers?: Record<string, string> }) => {
      call += 1;
      const range = init?.headers?.range ?? null;
      ranges.push(range);
      const from = range ? Number(range.replace(/\D+/gu, "")) : 0;
      const slice = payload.subarray(from);
      // The first response is cut short the way the release host does it.
      const served = call === 1 ? slice.subarray(0, 200) : slice;
      return new Response(served, { status: range ? 206 : 200 });
    });

    try {
      const installer = new YtdlpInstaller(root, release);
      const state = await installer.install();
      expect(state.phase).toBe("ready");
      expect(state.receivedBytes).toBe(release.bytes);
      expect(await readFile(installer.targetPath)).toEqual(payload);
      expect((await stat(installer.targetPath)).mode & 0o777).toBe(0o755);
      expect(ranges).toEqual([null, "bytes=200-"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("starts over when the server ignores the Range header", async () => {
    const root = await mkdtemp(join(tmpdir(), "vd-ytdlp-"));
    let call = 0;
    vi.stubGlobal("fetch", async () => {
      call += 1;
      return new Response(call === 1 ? payload.subarray(0, 100) : payload, { status: 200 });
    });

    try {
      const installer = new YtdlpInstaller(root, release);
      expect((await installer.install()).phase).toBe("ready");
      expect(await readFile(installer.targetPath)).toEqual(payload);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails with the received byte count when the transfer never completes", async () => {
    const root = await mkdtemp(join(tmpdir(), "vd-ytdlp-"));
    vi.stubGlobal("fetch", async () => new Response(payload.subarray(0, 100), { status: 200 }));

    try {
      const installer = new YtdlpInstaller(root, release, 0);
      const state = await installer.install();
      expect(state.phase).toBe("failed");
      expect(state.error).toContain(`100/${release.bytes}`);
      // The partial file survives so the next attempt resumes instead of restarting from zero.
      expect(await readFile(`${installer.targetPath}.part`)).toHaveLength(100);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("rotates to the next mirror when an attempt fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "vd-ytdlp-"));
    const hosts: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: { headers?: Record<string, string> }) => {
      hosts.push(new URL(url).host);
      if (hosts.length === 1) throw new Error("connect timeout");
      const range = init?.headers?.range;
      const from = range ? Number(range.replace(/\D+/gu, "")) : 0;
      return new Response(payload.subarray(from), { status: from > 0 ? 206 : 200 });
    });

    try {
      const installer = new YtdlpInstaller(root, release, 0);
      expect((await installer.install()).phase).toBe("ready");
      expect(hosts).toEqual(["first.test", "second.test"]);
      expect(await readFile(installer.targetPath)).toEqual(payload);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps a partial file from a previous run instead of discarding it", async () => {
    const root = await mkdtemp(join(tmpdir(), "vd-ytdlp-"));
    vi.stubGlobal("fetch", async () => {
      throw new Error("socket hang up");
    });

    try {
      const installer = new YtdlpInstaller(root, release, 0);
      await mkdir(join(root, "bin"), { recursive: true });
      await writeFile(`${installer.targetPath}.part`, payload.subarray(0, 100));
      expect((await installer.install()).phase).toBe("failed");
      // Resuming from these bytes is the whole point of not deleting them.
      expect(await readFile(`${installer.targetPath}.part`)).toEqual(payload.subarray(0, 100));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reuses an already verified binary and replaces a truncated one", async () => {
    const root = await mkdtemp(join(tmpdir(), "vd-ytdlp-"));
    vi.stubGlobal("fetch", async () => new Response(payload, { status: 200 }));

    try {
      const first = new YtdlpInstaller(root, release);
      expect((await first.install()).phase).toBe("ready");

      // A second instance trusts the bytes on disk and never touches the network.
      vi.stubGlobal("fetch", async () => {
        throw new Error("should not download again");
      });
      expect((await new YtdlpInstaller(root, release).install()).phase).toBe("ready");

      // A truncated leftover is not trusted: the size check rejects it and the file is replaced.
      await writeFile(first.targetPath, payload.subarray(0, 10));
      vi.stubGlobal("fetch", async () => new Response(payload, { status: 200 }));
      expect((await new YtdlpInstaller(root, release).install()).phase).toBe("ready");
      expect(await readFile(first.targetPath)).toEqual(payload);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
