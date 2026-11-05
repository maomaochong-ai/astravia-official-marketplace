/**
 * The postMessage dialect spoken by src/bridge/host-bridge.js inside the editor
 * frame. Shapes are narrowed here so the UI never branches on raw `unknown`.
 *
 * ADR: docs/adr/photocraft/0002-bytes-move-through-the-host.md
 */

/** WebGPU → WebGL2 → software. Upstream understands the last two as URL flags. */
export type Downgrade = "auto" | "webgl" | "cpu";

export interface LinkMessage {
  type?: string;
  id?: string;
  name?: string;
  mime?: string;
  bytes?: ArrayBuffer;
  backend?: string;
  message?: string;
  secure?: boolean;
  ok?: boolean;
  ready?: boolean;
  staged?: string | null;
  /** How long a stage has been waiting, so a stale one is visible instead of assumed fresh. */
  stagedAgeMs?: number | null;
  /** `craft:drop`: how many files the page was handed. */
  dropped?: number;
  error?: string;
  href?: string;
  canvas?: { width: number; height: number } | null;
  // `craft:boot` heartbeat: upstream's own loading line, whether the bridge has already
  // called the boot slow, and how long it has been running.
  loader?: string;
  slow?: boolean;
  waitedMs?: number;
  // Gesture replies. The bridge says what it dispatched, never what the app did
  // with it — `at` is the fraction it used and `typed` the number of key events.
  at?: { x: number; y: number } | null;
  typed?: number;
  key?: string | null;
  // Batch replies (`craft:act`). One entry per step, in the order they ran, plus
  // the frames the batch asked to keep; `elapsedMs` is the wall clock the bridge
  // spent, which is what the status line reports as the automation running.
  steps?: ActStepResult[];
  captures?: LinkCapture[];
  elapsedMs?: number;
  width?: number;
  height?: number;
  /** `craft:probe`: a text map of the canvas plus its average colour, so a tool can
   * hand the model something to reason about without carrying pixels. */
  probe?: CraftProbe;
}

/** What a batch did — not what the app made of it. */
export interface ActStepResult {
  index: number;
  op: string;
  label?: string;
  ok: boolean;
  error?: string;
  outcome?: unknown;
}

export interface LinkCapture {
  index: number;
  name: string;
  width: number;
  height: number;
  bytes: ArrayBuffer;
}

/**
 * One region of the canvas, described for a text-only reader: `cells` is a coarse
 * letter map (hue letter, lowercase when dark) and `mean` is the average colour —
 * the before/after a "make the background blue" change can be measured against.
 */
export interface CraftProbe {
  region: { x: number; y: number; w: number; h: number };
  cols: number;
  rows: number;
  cells: string;
  mean: string;
  meanRgb: [number, number, number];
  contrast: number;
  width: number;
  height: number;
}

/** `craft:progress`: the bridge narrating a batch while it runs. */
export interface CraftProgress {
  id?: string;
  index: number;
  total: number;
  label: string;
}

export function isProgressMessage(data: unknown): data is CraftProgress {
  if (typeof data !== "object" || data === null) return false;
  const value = data as CraftProgress;
  return typeof value.index === "number" && typeof value.total === "number" && typeof value.label === "string";
}

export function isLinkMessage(data: unknown): data is LinkMessage {
  return typeof data === "object" && data !== null;
}

/** One rung down the rendering ladder; `null` when software already failed. */
export function nextDowngrade(current: Downgrade): Downgrade | null {
  if (current === "auto") return "webgl";
  if (current === "webgl") return "cpu";
  return null;
}

/**
 * Only a boot failure is ours to answer. A stray script error reported by the
 * bridge must not cost the user a rendering rung.
 */
export function isBootFailure(message: string): boolean {
  return /failed to start|boot-timeout/i.test(message);
}
