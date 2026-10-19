import { join } from "node:path";
import { toolFileName } from "../tools/tool-paths.js";

/**
 * Pinned yt-dlp release.
 *
 * The version is never resolved from `latest`: a moving tag would silently change the bytes the
 * service executes. `sha256` values come from the release's own asset digests, and the download
 * is verified against them before the binary is put on disk (`ytdlp-installer.ts`).
 */
export const YTDLP_VERSION = "2026.08.19";

const BASE = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}`;

export interface YtdlpRelease {
  version: string;
  asset: string;
  url: string;
  sha256: string;
  bytes: number;
}

interface AssetRecord {
  asset: string;
  sha256: string;
  bytes: number;
}

/** The standalone builds published for this release, one entry per platform key. */
const ASSETS: Record<string, AssetRecord> = {
  "darwin-x64": { asset: "yt-dlp_macos", sha256: "0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202", bytes: 37_146_048 },
  "darwin-arm64": { asset: "yt-dlp_macos", sha256: "0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202", bytes: 37_146_048 },
  "linux-x64": { asset: "yt-dlp_linux", sha256: "58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a", bytes: 40_446_224 },
  "linux-arm64": { asset: "yt-dlp_linux_aarch64", sha256: "b16e4dab368a816cd05d477d698a605a6ae87ccee1c8ffd38fa21d7254141fcc", bytes: 40_167_448 },
  "win32-x64": { asset: "yt-dlp.exe", sha256: "66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a", bytes: 17_840_399 },
  "win32-arm64": { asset: "yt-dlp_arm64.exe", sha256: "05b438997bafc3affdfda9d041353c9d73e04dc842207254b655b0887c4445b0", bytes: 21_159_286 },
};

export function ytdlpBinaryName(platform: NodeJS.Platform = process.platform): string {
  return toolFileName("yt-dlp", platform);
}

export function ytdlpReleasePath(dataRoot: string): string {
  return join(dataRoot, "bin", ytdlpBinaryName());
}

export function ytdlpReleaseFor(platform: string = process.platform, arch: string = process.arch): YtdlpRelease | null {
  const record = ASSETS[`${platform}-${arch}`];
  if (!record) return null;
  return {
    version: YTDLP_VERSION,
    asset: record.asset,
    url: `${BASE}/${record.asset}`,
    sha256: record.sha256,
    bytes: record.bytes,
  };
}
