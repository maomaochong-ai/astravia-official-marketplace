/**
 * Pinned ffmpeg builds.
 *
 * Upstream (`eugeneware/ffmpeg-static`, tag `b6.1.1`) publishes no checksum file, so the
 * digests below were measured once from the release assets and are pinned here: a replaced
 * asset makes the install fail instead of silently producing a different binary. The macOS
 * digests come from the GitHub assets directly; the others were measured from the byte-identical
 * npmmirror copy, whose macOS asset hashes match GitHub exactly.
 *
 * The gzip variants are used because they are ~60% smaller than the raw executables.
 */
export interface FfmpegRelease {
  /** Tried in order; every source must serve the same pinned bytes. */
  sources: string[];
  sha256: string;
  /** Exact byte length of the downloaded archive. */
  bytes: number;
}

const TAG = "b6.1.1";
const BASE = `https://github.com/eugeneware/ffmpeg-static/releases/download/${TAG}`;
/** Byte-identical copy of the same release, used when GitHub is slow or unreachable. */
const MIRROR = `https://registry.npmmirror.com/-/binary/ffmpeg-static/${TAG}`;
function asset(name: string, sha256: string, bytes: number): FfmpegRelease {
  return { sources: [`${BASE}/${name}.gz`, `${MIRROR}/${name}.gz`], sha256, bytes };
}

const RELEASES: Record<string, FfmpegRelease> = {
  "darwin-arm64": asset("ffmpeg-darwin-arm64", "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa", 19246198),
  "darwin-x64": asset("ffmpeg-darwin-x64", "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106", 25296431),
  "linux-arm64": asset("ffmpeg-linux-arm64", "754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0", 25568691),
  "linux-x64": asset("ffmpeg-linux-x64", "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa", 29354986),
  "win32-x64": asset("ffmpeg-win32-x64", "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77", 29581307),
  // Windows on ARM runs x64 binaries under emulation, and upstream builds no native arm64 binary.
  "win32-arm64": asset("ffmpeg-win32-x64", "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77", 29581307),
};

export function ffmpegReleaseFor(platform: NodeJS.Platform, arch: string): FfmpegRelease | null {
  return RELEASES[`${platform}-${arch}`] ?? null;
}
