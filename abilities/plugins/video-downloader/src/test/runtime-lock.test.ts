import { describe, expect, it } from "vitest";
import manifest from "../../plugin.json";
import runtimeLock from "../../runtime-lock.json";

// The 1.2.1 release shipped a lock file pointing at `video-downloader-service-1.2.0.zip`
// while the uploaded asset was `-1.2.1.zip`; every activation died with HTTP 404 and the
// panel only said "Service is not ready". These assertions make that mismatch impossible
// to ship again: the download URL is derived from the pinned runtime version.

const PLATFORMS = ["win32-x64", "win32-arm64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"] as const;

const service = manifest.providers.services[0];
const runtimeVersion = service.runtime.version;
const allowedHosts = manifest.network.allowedHosts as string[];

interface LockedAsset {
  destination: string;
  url: string;
  sha256: string;
}

const lockedAssets = (platform: string): LockedAsset[] =>
  (runtimeLock.platforms as unknown as Record<string, LockedAsset[]>)[platform] ?? [];

describe("runtime lock", () => {
  it("pins the same runtime version as the manifest", () => {
    expect(runtimeLock.version).toBe(runtimeVersion);
  });

  it("derives the service bundle URL from the pinned version", () => {
    const expected = new RegExp(
      `/releases/download/video-downloader-${runtimeVersion}/video-downloader-service-${runtimeVersion}\\.zip$`,
    );
    for (const platform of PLATFORMS) {
      const asset = lockedAssets(platform).find((entry) => entry.destination === "service");
      expect(asset, `${platform} has no service asset`).toBeDefined();
      expect(asset?.url).toMatch(expected);
    }
  });

  it("downloads exactly the artifacts the manifest declares, with their checksums", () => {
    for (const platform of PLATFORMS) {
      const declared = service.runtime.platforms[platform].artifacts;
      const locked = lockedAssets(platform);
      expect(locked.map((entry) => entry.destination).sort()).toEqual(
        declared.map((entry) => entry.destination).sort(),
      );
      for (const artifact of declared) {
        expect(locked.find((entry) => entry.destination === artifact.destination)?.sha256).toBe(artifact.sha256);
      }
    }
  });

  it("only downloads from hosts the manifest is allowed to reach", () => {
    for (const platform of PLATFORMS) {
      for (const asset of lockedAssets(platform)) {
        expect(allowedHosts).toContain(new URL(asset.url).hostname);
      }
    }
  });
});
