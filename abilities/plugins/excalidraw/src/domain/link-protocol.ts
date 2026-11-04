/**
 * The postMessage dialect spoken by src/bridge/host-bridge.js inside the editor
 * frame. Shapes are narrowed here so the UI never branches on raw `unknown`.
 *
 * ADR: docs/adr/excalidraw/0002-bytes-move-through-the-host.md
 */

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
  error?: string;
  href?: string;
  canvas?: { width: number; height: number } | null;
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
  /** `craft:scene` replies. `scene` is what the editor held after the call; `applied`
   * says what the write did; `exported` describes the bytes carried in `bytes`. */
  scene?: CraftScene;
  applied?: { mode: string; added: number; total: number };
  exported?: { name: string; mime: string; bytes: number };
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

/** One element as the editor holds it, with the volatile fields dropped. */
export interface CraftSceneElement {
  id?: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

export interface CraftScene {
  count: number;
  truncated: boolean;
  appState: { theme: string; zoom: number | null; viewBackgroundColor: string; gridSize: number | null };
  elements: CraftSceneElement[];
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

/**
 * A boot failure leaves the frame empty, so it ends the session; a stray script error
 * reported by the bridge is a notice and the editor keeps running.
 */
export function isBootFailure(message: string): boolean {
  return /failed to start|boot-timeout/i.test(message);
}
