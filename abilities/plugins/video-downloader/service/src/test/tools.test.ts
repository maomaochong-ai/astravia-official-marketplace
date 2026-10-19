import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { describeLuxFailure, summarizeLuxFailure } from "../lux/diagnostics.js";
import { ffmpegReleaseFor } from "../tools/ffmpeg-release.js";
import { FfmpegInstaller } from "../tools/ffmpeg-installer.js";
import { withToolPath } from "../tools/tool-paths.js";

const temporaryDirectories: string[] = [];

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "video-downloader-tools-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

/** Trimmed copy of what lux writes when the YouTube extractor cannot reach the site. */
const YOUTUBE_FAILURE = `Downloading https://www.youtube.com/watch?v=aqz-KE-bpKQ error: Get "https://youtube.com/embed/aqz-KE-bpKQ?hl=en": dial tcp 31.13.92.37:443: connect: operation timed out

goroutine 1 [running]:
github.com/iawia002/lux/extractors/youtube.(*extractor).Extract(0x1400012a000, {0x1400013e000, 0x2b}, 0x1400012c180)
\t/opt/hostedtoolcache/go/1.22.2/x64/src/github.com/iawia002/lux/extractors/youtube/youtube.go:353 +0x2d4
main.main.func1(0x1400012c180)
\t/Users/runner/work/lux/lux/main.go:120 +0x1c
runtime.goexit()
\t/opt/hostedtoolcache/go/1.22.2/x64/src/runtime/asm_arm64.s:1222 +0x1
`;

/**
 * Verbatim shape of a real failure: lux writes `Downloading … error:` on one line, the cause
 * on the next, then a Go stack trace — all on stdout, with nothing on stderr.
 */
const REAL_YOUTUBE_FAILURE = `Downloading https://www.youtube.com/watch?v=aqz-KE-bpKQ error:
Get "https://www.youtube.com": dial tcp 31.13.92.37:443: connect: operation timed out
github.com/iawia002/lux/extractors/youtube.(*extractor).Extract
\tgithub.com/iawia002/lux/extractors/youtube/youtube.go:48
github.com/iawia002/lux/extractors.Extract
\tgithub.com/iawia002/lux/extractors/extractors.go:54
main.main
\tgithub.com/iawia002/lux/main.go:13
runtime.main
\truntime/proc.go:290
runtime.goexit
\truntime/asm_arm64.s:1447
`;

describe("summarizeLuxFailure", () => {
  it("keeps the real reason and drops Go stack frames", () => {
    const failure = summarizeLuxFailure(YOUTUBE_FAILURE, "");
    expect(failure?.code).toBe("network_timeout");
    expect(failure?.detail).toContain("operation timed out");
    expect(failure?.detail).not.toContain("runtime.goexit");
    expect(failure?.detail).not.toContain("asm_arm64.s");
    expect(describeLuxFailure(failure!)).toContain("超时");
  });

  it("reads the real cause when lux writes it on the line after `error:`", () => {
    const failure = summarizeLuxFailure("", REAL_YOUTUBE_FAILURE);
    expect(failure?.code).toBe("network_timeout");
    expect(failure?.detail).toBe(
      'Get "https://www.youtube.com": dial tcp 31.13.92.37:443: connect: operation timed out',
    );
  });

  it("classifies auth and unsupported-site failures", () => {
    expect(summarizeLuxFailure('Downloading https://x.test/v error: status 403 Forbidden', "")?.code).toBe("auth_required");
    expect(summarizeLuxFailure("Downloading https://x.test/v error: no extractor for this URL", "")?.code).toBe(
      "site_unsupported",
    );
  });

  it("returns null when nothing was written", () => {
    expect(summarizeLuxFailure("", "")).toBeNull();
  });
});

describe("ffmpegReleaseFor", () => {
  const platforms = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "win32-x64", "win32-arm64"];

  it("pins a verified build for every supported platform", () => {
    for (const key of platforms) {
      const [platform, arch] = key.split("-") as [NodeJS.Platform, string];
      const release = ffmpegReleaseFor(platform, arch);
      expect(release, key).not.toBeNull();
      expect(release!.sources[0]!.startsWith("https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/")).toBe(true);
      expect(release!.sources[1]).toMatch(/^https:\/\/registry\.npmmirror\.com\//u);
      expect(release!.sha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(release!.bytes).toBeGreaterThan(1_000_000);
    }
  });

  it("reports unsupported platforms as null", () => {
    expect(ffmpegReleaseFor("linux", "ia32")).toBeNull();
  });
});

describe("FfmpegInstaller", () => {
  it("targets the tool directory and reports unsupported platforms without downloading", async () => {
    const dataRoot = await makeTempDirectory();
    const installer = new FfmpegInstaller(dataRoot, "linux", "ia32");
    expect(installer.targetPath).toBe(join(dataRoot, "bin", "ffmpeg"));

    const state = await installer.install();
    expect(state.supported).toBe(false);
    expect(state.phase).toBe("failed");
  });

  it("uses the Windows executable name", async () => {
    const dataRoot = await makeTempDirectory();
    const installer = new FfmpegInstaller(dataRoot, "win32", "x64");
    expect(installer.targetPath).toBe(join(dataRoot, "bin", "ffmpeg.exe"));
    await stat(dataRoot);
  });
});

describe("withToolPath", () => {
  it("prepends the provisioned tool directory to PATH", () => {
    const env = withToolPath("/data/bin", { PATH: "/usr/bin", HOME: "/home/u" });
    expect(env.PATH?.startsWith(`/data/bin${process.platform === "win32" ? ";" : ":"}`)).toBe(true);
    expect(env.HOME).toBe("/home/u");
  });
});
