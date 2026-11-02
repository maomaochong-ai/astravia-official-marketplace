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
  error?: string;
  href?: string;
  canvas?: { width: number; height: number } | null;
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
