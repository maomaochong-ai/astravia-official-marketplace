import type { PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../../../app.config.ts";
import { base64ToBytes, bytesToBase64 } from "../../../shared/formatters/base64.ts";
import type { CraftProbe } from "../../../domain/link-protocol.ts";
import { craftWorkspace } from "../session-registry.ts";

/**
 * What the Agent expected, and whether the canvas agreed.
 *
 * `change` answers "did anything happen"; this answers "did the thing I meant happen".
 * They are different questions with the same thresholds on purpose: if `act` called a
 * frame changed and `expect` then called the same frame unchanged, the model would be
 * reading two verdicts off one fact.
 *
 * A baseline is a *reading*, not a picture. The plugin has no PNG decoder, and a byte
 * comparison of two PNGs fails on encoding alone; what `probe` can measure — the letter
 * map, the mean colour, the grid it was sampled on — is what a baseline stores. When the
 * question needs real pixels, the model reads the `shot` file with its own eyes.
 *
 * ADR: docs/adr/<slug>/craft-0026-act-says-what-it-expects.md
 */

/** 0–441 (the RGB cube diagonal); below this the mean colour did not really move. */
export const CHANGE_DISTANCE = 6;

/** Share of letter-map cells that must differ before a look counts as a new picture. */
export const CHANGE_DRIFT = 0.02;

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The `expect` object a caller may attach to `act` or `probe`. */
export interface Expectation {
  /** Fractional rectangle the expectation is about; the whole frame when absent. */
  region?: Region;
  /** Expected average colour, 0–255 per channel. */
  meanRgb?: [number, number, number];
  /** How far the mean may sit from `meanRgb` (or from the baseline). Defaults to 6. */
  distance?: number;
  /** Compare against a stored reading instead of a literal colour. */
  against?: "baseline";
  /** Baseline name; `current` when absent. */
  name?: string;
  /** What was expected, in the user's words. Echoed back; never judged. */
  text?: string;
}

export interface ExpectationResult {
  ok: boolean;
  /** What was actually seen, so a failure is a number and not a shrug. */
  observed: { meanRgb: [number, number, number] | null; distance: number | null; drift: number | null } | null;
  failed: "mean" | "baseline-missing" | "no-look" | "grid-mismatch" | null;
  /** The caller's own sentence, so the person reading the result knows what was asked. */
  text: string | null;
}

/** 0–441-ish: how far one reading's average colour sits from another's. */
export function meanDistance(a: readonly number[], b: readonly number[]): number {
  return Math.round(Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0)));
}

/**
 * Share of cells whose letter changed (0–1). Two maps sampled on different grids are
 * not comparable, so that case reports 1: "as different as it gets", never 0.
 */
export function cellDrift(before: Pick<CraftProbe, "cells"> | null | undefined, after: Pick<CraftProbe, "cells"> | null | undefined): number {
  const a = before?.cells ?? "";
  const b = after?.cells ?? "";
  if (a.length === 0 || a.length !== b.length) return 1;
  let moved = 0;
  let cells = 0;
  for (let index = 0; index < a.length; index += 1) {
    // Newlines separate rows: they are not cells, and counting them would dilute the
    // share by 17/593 on the default grid — enough to matter next to a 2% threshold.
    if (a.charCodeAt(index) === 10) continue;
    cells += 1;
    if (a.charCodeAt(index) !== b.charCodeAt(index)) moved += 1;
  }
  return cells === 0 ? 1 : moved / cells;
}

/**
 * "This look did not move." Either signal alone is enough to count as movement: a swatch
 * changes cells without moving the mean, a fade moves the mean with an identical map.
 */
export function isQuiet(before: CraftProbe, after: CraftProbe, distance = CHANGE_DISTANCE): boolean {
  return meanDistance(before.meanRgb, after.meanRgb) <= distance && cellDrift(before, after) <= CHANGE_DRIFT;
}

/** Two fractional rectangles describe the same view (floats arrive as JSON decimals). */
function sameRect(a: Region, b: Region): boolean {
  const near = (x: number, y: number) => Math.abs((x ?? 0) - (y ?? 0)) <= 1e-6;
  return near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h);
}

/** A stored reading of one view, under `.craft/<app>/baseline/<name>.json`. */
export interface BaselineRecord {
  name: string;
  region: Region;
  cols: number;
  rows: number;
  cells: string;
  mean: string;
  meanRgb: [number, number, number];
  contrast: number;
  at: number;
  cwd: string;
}

export const BASELINE_DIR = `.craft/${APP.id}/baseline`;

/** A name is a file name: anything a file cannot hold becomes `-`. */
function slugOf(name: string): string {
  const cleaned = name.trim().replace(/[^\w.-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || "current";
}

function baselinePath(cwd: string, name: string): string {
  return `${cwd}/${BASELINE_DIR}/${slugOf(name)}.json`;
}

/** Write the reading just taken as the baseline this name will be compared against. */
export async function writeBaseline(
  ctx: PluginContext,
  probe: CraftProbe,
  name = "current",
): Promise<string | null> {
  const cwd = craftWorkspace();
  if (!cwd) return null;
  const dir = `${cwd}/${BASELINE_DIR}`;
  try {
    await ctx.fs.createDirectory(dir);
  } catch {
    // Already there is the ordinary case; a real failure surfaces on the write.
  }
  const record: BaselineRecord = {
    name,
    region: probe.region,
    cols: probe.cols,
    rows: probe.rows,
    cells: probe.cells,
    mean: probe.mean,
    meanRgb: probe.meanRgb,
    contrast: probe.contrast,
    at: Date.now(),
    cwd,
  };
  const path = baselinePath(cwd, name);
  try {
    await ctx.fs.writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return path;
  } catch {
    return null;
  }
}

/** The stored reading for this name, or null when there is none in this project. */
export async function readBaseline(
  ctx: PluginContext,
  name = "current",
): Promise<BaselineRecord | null> {
  const cwd = craftWorkspace();
  if (!cwd) return null;
  try {
    const read = await ctx.fs.readBinaryFile(baselinePath(cwd, name));
    const text = new TextDecoder().decode(base64ToBytes(read.data));
    const parsed = JSON.parse(text) as Partial<BaselineRecord>;
    if (typeof parsed.cells !== "string" || !Array.isArray(parsed.meanRgb)) return null;
    // A baseline from another project describes another canvas.
    if (typeof parsed.cwd === "string" && parsed.cwd !== cwd) return null;
    return {
      name: typeof parsed.name === "string" ? parsed.name : name,
      region: parsed.region ?? { x: 0, y: 0, w: 1, h: 1 },
      cols: typeof parsed.cols === "number" ? parsed.cols : 32,
      rows: typeof parsed.rows === "number" ? parsed.rows : 18,
      cells: parsed.cells,
      mean: typeof parsed.mean === "string" ? parsed.mean : "",
      meanRgb: parsed.meanRgb as [number, number, number],
      contrast: typeof parsed.contrast === "number" ? parsed.contrast : 0,
      at: typeof parsed.at === "number" ? parsed.at : 0,
      cwd: typeof parsed.cwd === "string" ? parsed.cwd : cwd,
    };
  } catch {
    return null;
  }
}

/**
 * Judge one reading against what the caller expected.
 *
 * `failed: "baseline-missing"` is deliberately a failure: a comparison against a
 * baseline nobody wrote would otherwise pass by default, which is the one direction an
 * assertion must never err in.
 */
export async function evaluateExpectation(
  ctx: PluginContext,
  expect: Expectation | null | undefined,
  probe: CraftProbe | null,
): Promise<ExpectationResult | null> {
  if (!expect) return null;
  const text = typeof expect.text === "string" ? expect.text : null;
  if (!probe) return { ok: false, observed: null, failed: "no-look", text };

  const allowed = typeof expect.distance === "number" ? expect.distance : CHANGE_DISTANCE;

  if (expect.against === "baseline") {
    const baseline = await readBaseline(ctx, expect.name ?? "current");
    if (!baseline) {
      return { ok: false, observed: { meanRgb: probe.meanRgb, distance: null, drift: null }, failed: "baseline-missing", text };
    }
    // Geometry first: a baseline of the left half says nothing about the right half even
    // when both were sampled on the same grid.
    if (!sameRect(baseline.region, probe.region) || baseline.cols !== probe.cols || baseline.rows !== probe.rows) {
      return {
        ok: false,
        observed: { meanRgb: probe.meanRgb, distance: meanDistance(baseline.meanRgb, probe.meanRgb), drift: null },
        failed: "grid-mismatch",
        text,
      };
    }
    const distance = meanDistance(baseline.meanRgb, probe.meanRgb);
    const drift = cellDrift(baseline, probe);
    return {
      ok: distance <= allowed && drift <= CHANGE_DRIFT,
      observed: { meanRgb: probe.meanRgb, distance, drift },
      failed: distance <= allowed && drift <= CHANGE_DRIFT ? null : "mean",
      text,
    };
  }

  if (Array.isArray(expect.meanRgb) && expect.meanRgb.length === 3) {
    const distance = meanDistance(expect.meanRgb, probe.meanRgb);
    return {
      ok: distance <= allowed,
      observed: { meanRgb: probe.meanRgb, distance, drift: null },
      failed: distance <= allowed ? null : "mean",
      text,
    };
  }

  // An `expect` nobody can judge is a mistake worth reporting, not a pass.
  return { ok: false, observed: { meanRgb: probe.meanRgb, distance: null, drift: null }, failed: "mean", text };
}
