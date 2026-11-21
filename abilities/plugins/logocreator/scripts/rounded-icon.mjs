/**
 * Build a rounded (squircle) plugin icon with transparent corners.
 *
 * Why: the composer's add-list paints the ability icon bitmap as-is. A full-bleed
 * square reads as a rectangle beside every other plugin, which ships a
 * pre-rounded app icon. The host's own card surface may round it again, and a
 * second, smaller rounding is invisible — a missing one is not.
 *
 * Shape: the iOS app-icon radius ratio (0.2237 of the side), the same value the
 * upstream exporter uses. The mask is built at 4x and downsampled, so the corner
 * edge is smooth rather than aliased.
 *
 *   node scripts/rounded-icon.mjs <source.jpg> <out.png>
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SIZE = 512;
const RADIUS_RATIO = 0.2237;

const SOURCE = process.argv[2];
const OUT = process.argv[3];
if (!SOURCE || !OUT) throw new Error("usage: rounded-icon.mjs <source> <out.png>");

const SCALE = 4;
const big = SIZE * SCALE;
const rr = Math.round(SIZE * RADIUS_RATIO) * SCALE;
const half = big / 2;
const inset = half - rr;

// ffmpeg `geq` expression: rounded-rect signed distance, soft over one scaler px.
// `alphamerge` reads luma, so the shape goes in RGB and alpha stays opaque.
const distance = `hypot(max(abs(X-${half})-${inset},0),max(abs(Y-${half})-${inset},0))`;
const shape = `clip((${rr}-${distance})/1,0,1)`;

const dir = mkdtempSync(join(tmpdir(), "rounded-icon-"));
try {
	const scaled = join(dir, "scaled.png");
	execFileSync("ffmpeg", [
		"-y", "-loglevel", "error", "-i", SOURCE,
		"-vf", `scale=${big}:${big}:flags=lanczos`,
		"-c:v", "png", "-pix_fmt", "rgb24", scaled,
	]);

	const mask = join(dir, "mask.png");
	execFileSync("ffmpeg", [
		"-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=black:s=${big}x${big}`,
		"-vf", `geq=r='255*${shape}':g='255*${shape}':b='255*${shape}':a=255`,
		"-frames:v", "1", mask,
	]);

	execFileSync("ffmpeg", [
		"-y", "-loglevel", "error",
		"-i", scaled, "-i", mask,
		"-filter_complex", `[0:v][1:v]alphamerge,scale=${SIZE}:${SIZE}:flags=lanczos`,
		"-c:v", "png", "-pix_fmt", "rgba", OUT,
	]);

	// Fail loudly rather than ship a square icon: corner must be transparent and
	// the centre must not be.
	const alphaAt = (x, y) =>
		execFileSync(
			"ffmpeg",
			["-loglevel", "error", "-i", OUT, "-vf", `crop=1:1:${x}:${y},format=rgba`, "-f", "rawvideo", "-frames:v", "1", "-"],
			{ encoding: "buffer" },
		)[3];
	const corner = alphaAt(2, 2);
	const centre = alphaAt(SIZE / 2, SIZE / 2);
	if (corner > 16) throw new Error(`corner is not transparent (alpha ${corner}) — the mask did not apply`);
	if (centre < 200) throw new Error(`centre is not opaque (alpha ${centre}) — the mask is inverted`);
	console.log(`rounded icon -> ${OUT} · corner alpha ${corner} · centre alpha ${centre} · radius ${rr / SCALE}px`);
} finally {
	rmSync(dir, { recursive: true, force: true });
}
