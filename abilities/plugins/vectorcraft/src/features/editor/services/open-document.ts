/**
 * Getting a file the user already owns into the running editor.
 *
 * The page is upstream's own build, so the only way in is an input the app itself
 * exposes: its File › Open dialog, or its drop handler. Nothing here reaches into the
 * app's state, and nothing claims a file was opened until the canvas says so.
 *
 * Three rungs, cheapest and most reliable first:
 *
 *  1. `drop` — upstream reads `raw.dropped_files` and hands each file to `file_open`
 *     (`crates/ui-egui/src/app/frame.rs`, `file_open.rs`). A synthetic drop needs no
 *     menu, no key binding and no focus, so it is the rung most likely to work in a
 *     web build.
 *  2. the platform's open chord — egui reads `Modifiers::COMMAND`, which is ⌘ on
 *     macOS and Ctrl elsewhere. Sending only `ctrl+o` on a Mac is the bug this rung
 *     fixes.
 *  3. `alt` + the menu's mnemonic (`F`, then `O`) — upstream's menu bar opens a top
 *     menu on Alt+letter and runs the matching row on the next letter
 *     (`crates/ui-egui/src/menus/menu_keys.rs`). Not every app has that bar, which is
 *     why it is last.
 *
 * Each rung is followed by a canvas reading, and the ladder stops at the first one
 * that measurably changed the page. A rung that throws (frame gone, bridge silent) is
 * recorded and the ladder moves on; a ladder that reaches the end reports
 * `opened: false` with every attempt, and leaves the bytes staged so the user's own
 * File › Open still opens the right file (the bridge holds a stage for two minutes).
 */
import type { CraftProbe } from "../../../domain/link-protocol.ts";
import { askCraftFrame } from "../session-registry.ts";
import { CHANGE_DISTANCE, CHANGE_DRIFT, cellDrift, meanDistance } from "./expectation.ts";

export interface OpenRequest {
  bytes: ArrayBuffer;
  name: string;
  mime: string;
}

export interface OpenAttempt {
  step: string;
  ok: boolean;
  error?: string;
}

export interface OpenResult {
  /** True only when a rung moved the canvas. */
  opened: boolean;
  /** Every rung that was tried, in order. */
  attempts: OpenAttempt[];
  /** Name still staged inside the frame, so the app's own Open can pick it up. */
  staged: string | null;
  step?: string;
}

/** A canvas reading compared before and after a step, so "opened" is measured. */
export interface CanvasDelta {
  changed: boolean;
  distance: number;
  /**
   * Share of cells that changed letter between the two readings (0–1); the bridge's own
   * `drift` only when the maps are not both available.
   */
  cellsMoved: number | null;
  /** Hex strings as the probe reports them (`#rrggbb`); `distance` carries the numbers. */
  meanBefore: string;
  meanAfter: string;
  rgbDelta: number[];
}

export interface ProbeOptions {
  region?: { x: number; y: number; w: number; h: number };
  columns?: number;
  rows?: number;
}

function reason(error: unknown): string {
  return String((error as Error)?.message ?? error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The page's own text description of the canvas, or null when it cannot answer. */
export async function readCanvas(options: ProbeOptions = {}): Promise<CraftProbe | null> {
  try {
    const reply = await askCraftFrame(
      "craft:probe",
      { region: options.region, columns: options.columns ?? 32, rows: options.rows ?? 18 },
      8000,
    );
    return reply.probe ?? null;
  } catch {
    return null;
  }
}

/** 0–441 (the RGB cube diagonal); ~0 means the canvas did not change at all. */
export function describeDelta(
  before: CraftProbe | null | undefined,
  after: CraftProbe | null | undefined,
): CanvasDelta | null {
  if (!before || !after) return null;
  const [r0, g0, b0] = before.meanRgb;
  const [r1, g1, b1] = after.meanRgb;
  const distance = meanDistance(before.meanRgb, after.meanRgb);
  // Both maps are in hand, so the drift is measured here rather than read from the
  // bridge's cache: a `wait` loop compares two looks that may not be its last two.
  const moved = cellDrift(before, after);
  return {
    meanBefore: before.mean,
    meanAfter: after.mean,
    rgbDelta: [r1 - r0, g1 - g0, b1 - b0],
    distance,
    cellsMoved: moved,
    // Either signal is enough: a small swatch moves cells without moving the mean,
    // and a full-screen fade moves the mean with an almost identical letter map.
    changed: distance > CHANGE_DISTANCE || moved > CHANGE_DRIFT,
  };
}

/** Left alone, a stage would answer an open it was never meant for; the bridge ages it out. */
export async function releaseStage(): Promise<void> {
  try {
    await askCraftFrame("craft:unstage", {}, 5000);
  } catch {
    /* the frame is gone, and a stage dies with it */
  }
}

/** ⌘O on a Mac, Ctrl+O everywhere else: egui maps both onto `Modifiers::COMMAND`. */
function openChords(): string[] {
  const platform =
    typeof navigator === "object" && navigator
      ? `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`
      : "";
  const mac = /mac/i.test(platform);
  return mac ? ["meta+o", "ctrl+o"] : ["ctrl+o", "meta+o"];
}

/** Give up on a rung's effect after this long; the app draws asynchronously. */
const DROP_WAIT_MS = 1600;
const CHORD_WAIT_MS = 1600;
const MENU_WAIT_MS = 1800;

interface Rung {
  step: string;
  wait: number;
  run: () => Promise<void>;
}

function rungs(): Rung[] {
  const out: Rung[] = [
    {
      step: "drop",
      wait: DROP_WAIT_MS,
      run: async () => {
        const reply = await askCraftFrame("craft:drop", {}, 15000);
        if (reply.ok === false) throw new Error(reply.error || "drop-refused");
      },
    },
  ];
  for (const chord of openChords()) {
    out.push({
      step: `key:${chord}`,
      wait: CHORD_WAIT_MS,
      run: async () => {
        const reply = await askCraftFrame("craft:key", { key: chord }, 20000);
        if (reply.ok === false) throw new Error(reply.error || "key-refused");
      },
    });
  }
  out.push({
    step: "menu:alt+f,o",
    wait: MENU_WAIT_MS,
    run: async () => {
      const bar = await askCraftFrame("craft:key", { key: "alt+f" }, 20000);
      if (bar.ok === false) throw new Error(bar.error || "key-refused");
      await sleep(250);
      const row = await askCraftFrame("craft:key", { key: "o" }, 20000);
      if (row.ok === false) throw new Error(row.error || "key-refused");
    },
  });
  return out;
}

export async function openDocument(request: OpenRequest): Promise<OpenResult> {
  const attempts: OpenAttempt[] = [];

  // A reading before anything is staged: the ladder's whole judgement rests on it.
  const baseline = await readCanvas();
  if (!baseline) {
    return { opened: false, attempts: [{ step: "inspect", ok: false, error: "canvas-unreadable" }], staged: null };
  }

  let staged: string | null = null;
  try {
    const reply = await askCraftFrame(
      "craft:stage",
      { name: request.name, mime: request.mime, bytes: request.bytes },
      20000,
    );
    if (reply.ok === false) throw new Error(reply.error || "stage-refused");
    staged = reply.staged ?? request.name;
  } catch (error) {
    return { opened: false, attempts: [{ step: "stage", ok: false, error: reason(error) }], staged: null };
  }

  for (const rung of rungs()) {
    let after: CraftProbe | null = null;
    try {
      await rung.run();
      await sleep(rung.wait);
      after = await readCanvas();
    } catch (error) {
      attempts.push({ step: rung.step, ok: false, error: reason(error) });
      continue;
    }
    const moved = describeDelta(baseline, after);
    attempts.push({ step: rung.step, ok: moved?.changed === true });
    if (moved?.changed) {
      // The bytes are inside the app now; a leftover stage could hijack a later Open.
      await releaseStage();
      return { opened: true, attempts, staged: null, step: rung.step };
    }
  }

  return { opened: false, attempts, staged };
}
