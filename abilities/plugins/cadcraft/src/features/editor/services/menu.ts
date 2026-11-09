import { askCraftFrame } from "../session-registry.ts";
import { describeDelta, readCanvas } from "./open-document.ts";
import type { CanvasDelta } from "./open-document.ts";

/**
 * Reaching a function by name instead of by pixel.
 *
 * The canvas is one wasm surface, so nothing here can look up a menu item. What the page
 * *can* do is what a person with the keyboard does: `Alt` plus the menu's own mnemonic
 * opens it, the next letters walk down, `Enter` commits. That is how `open_document`'s
 * last rung already works (see craft-0017), and this generalises it to every command the
 * app exposes — which is the difference between "the agent clicks somewhere" and "the
 * agent uses a function".
 *
 * The order is deliberate and the same as everywhere else in this plugin: the platform
 * shortcut the app itself documents first (one keystroke, no timing), the menu path
 * second, and a measured canvas delta after each so a miss is reported, not assumed.
 *
 * ADR: docs/adr/<slug>/craft-0017-the-selection-is-offered-through-the-apps-own-open.md
 */

export interface MenuRequest {
  /** Path through the menu tree, e.g. `["File", "Export", "Save for Web"]` or `"File > Export"`. */
  path?: string[] | string;
  /** A chord the app documents, e.g. `ctrl+shift+s`. Tried before the path. */
  shortcut?: string;
  /** How long to let the app draw before measuring. Defaults to 260 ms. */
  settleMs?: number;
}

export interface MenuAttempt {
  step: string;
  ok: boolean;
  error?: string;
}

export interface MenuResult {
  invoked: boolean;
  attempts: MenuAttempt[];
  step?: string;
  change: CanvasDelta | null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The letter a keyboard-driven menu uses for a row: its first alphanumeric character,
 * lowercased. `Save for Web…` → `s`; `… Options` → `o`; a row with no letter at all cannot
 * be reached this way and is reported rather than guessed.
 */
export function mnemonicOf(segment: string): string | null {
  const cleaned = segment.replace(/…|\.\.\./g, "").replace(/[&_]/g, "").trim();
  const first = [...cleaned].find((character) => /[\p{L}\p{N}]/u.test(character));
  return first ? first.toLowerCase() : null;
}

/** `"File > Export > Save for Web"` and `["File","Export","Save for Web"]` mean the same. */
export function normalizePath(path: string[] | string | undefined): string[] {
  if (!path) return [];
  const parts = Array.isArray(path) ? path : path.split(">");
  return parts.map((part) => part.trim()).filter(Boolean);
}

function reason(error: unknown): string {
  return String((error as Error)?.message ?? error);
}

/**
 * Walk one menu path with the keyboard.
 *
 * `Alt`+letter is a real press and a real release (egui watches the modifier transition),
 * so the first step is a chord rather than a held key. Each following letter is a plain
 * press inside the open menu; `Enter` commits the row.
 */
async function walkPath(path: string[], settleMs: number): Promise<void> {
  const [top, ...rest] = path;
  const topKey = mnemonicOf(top);
  if (!topKey) throw new Error(`no-mnemonic:${top}`);
  const opened = await askCraftFrame("craft:key", { key: `alt+${topKey}` }, 15000);
  if (opened.ok === false) throw new Error(opened.error || "menu-refused");
  await sleep(settleMs);

  for (const segment of rest) {
    const key = mnemonicOf(segment);
    if (!key) throw new Error(`no-mnemonic:${segment}`);
    const pressed = await askCraftFrame("craft:key", { key }, 15000);
    if (pressed.ok === false) throw new Error(pressed.error || "menu-refused");
    await sleep(settleMs);
  }

  // A leaf runs on its letter; a dialog row takes the letter and then Enter. Sending both
  // is what a person does, and an extra Enter on a row that already ran is harmless.
  const committed = await askCraftFrame("craft:key", { key: "Enter" }, 15000);
  if (committed.ok === false) throw new Error(committed.error || "menu-refused");
  await sleep(settleMs);
}

/**
 * Try the shortcut, then the path, and report what the canvas did after each.
 *
 * A miss is `invoked: false` with every attempt listed — never a thrown error and never a
 * silent success. The caller decides whether to fall back to a gesture.
 */
export async function invokeMenu(request: MenuRequest): Promise<MenuResult> {
  const path = normalizePath(request.path);
  const settleMs = Math.min(2000, Math.max(60, Math.round(request.settleMs ?? 260)));
  const attempts: MenuAttempt[] = [];

  const rungs: Array<{ step: string; run: () => Promise<void> }> = [];
  if (request.shortcut) {
    const shortcut = request.shortcut.trim();
    rungs.push({
      step: `key:${shortcut}`,
      run: async () => {
        const reply = await askCraftFrame("craft:key", { key: shortcut }, 15000);
        if (reply.ok === false) throw new Error(reply.error || "key-refused");
        await sleep(settleMs);
      },
    });
  }
  if (path.length > 0) {
    rungs.push({ step: `menu:${path.join(" > ")}`, run: () => walkPath(path, settleMs) });
  }
  if (rungs.length === 0) return { invoked: false, attempts, change: null };

  const baseline = await readCanvas();
  if (!baseline) {
    return { invoked: false, attempts: [{ step: "inspect", ok: false, error: "canvas-unreadable" }], change: null };
  }

  // A menu left open by someone else would swallow the first chord.
  try {
    await askCraftFrame("craft:key", { key: "Escape" }, 5000);
  } catch {
    /* no frame, no menu */
  }

  let last: CanvasDelta | null = null;
  for (const rung of rungs) {
    try {
      await rung.run();
    } catch (error) {
      attempts.push({ step: rung.step, ok: false, error: reason(error) });
      continue;
    }
    const after = await readCanvas();
    const delta = describeDelta(baseline, after);
    last = delta;
    attempts.push({ step: rung.step, ok: delta?.changed === true });
    if (delta?.changed) return { invoked: true, attempts, step: rung.step, change: delta };
  }

  return { invoked: false, attempts, change: last };
}
