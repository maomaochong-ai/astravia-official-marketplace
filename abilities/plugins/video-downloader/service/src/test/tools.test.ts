import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ffmpegReleaseFor } from "../tools/ffmpeg-release.js";
import { FfmpegInstaller } from "../tools/ffmpeg-installer.js";
import { inspectProvisioned } from "../tools/tool-capability.js";
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
describe("inspectProvisioned", () => {
  it("trusts a provisioned binary the installer already verified", async () => {
    const directory = await makeTempDirectory();
    const provisioned = join(directory, "yt-dlp");
    // Fails if it is ever spawned: the reported version can then only come from the pin.
    await writeFile(provisioned, "#!/bin/sh\nexit 1\n", { mode: 0o755 });

    const capability = await inspectProvisioned({
      provisioned,
      command: "video-downloader-tool-that-is-not-on-path",
      versionArgs: ["--version"],
      provisionedVersion: "9.9.9",
    });

    expect(capability).toEqual({ available: true, path: provisioned, version: "9.9.9", source: "bundled" });
  });

  it("reports an installed binary as available when its version is unknown", async () => {
    const directory = await makeTempDirectory();
    const provisioned = join(directory, "ffmpeg");
    await writeFile(provisioned, "#!/bin/sh\nexit 1\n", { mode: 0o755 });

    const capability = await inspectProvisioned({
      provisioned,
      command: "video-downloader-tool-that-is-not-on-path",
      versionArgs: ["-version"],
      provisionedVersion: null,
    });

    expect(capability).toEqual({ available: true, path: provisioned, version: null, source: "bundled" });
  });

  it("still falls back to PATH and reports a missing tool as unavailable", async () => {
    const directory = await makeTempDirectory();

    const capability = await inspectProvisioned({
      provisioned: join(directory, "yt-dlp"),
      command: "video-downloader-tool-that-is-not-on-path",
      versionArgs: ["--version"],
      provisionedVersion: "9.9.9",
    });

    expect(capability.available).toBe(false);
  });
});
