import type { CraftProgress, LinkMessage } from "../../domain/link-protocol.ts";

/**
 * The live editor frame, addressable from outside React.
 *
 * Two callers speak to the frame: the tab's own hook (input and save) and the
 * Agent tools, which run in a handler far from the component tree. Rather than
 * lifting every tool into the tab, the mounted hook publishes one handle here and
 * the tools send requests through it. Nothing else may hold a frame reference.
 */
export interface CraftFrameHandle {
  post(message: Record<string, unknown>, transfer?: Transferable[]): boolean;
  baseUrl(): string | null;
}

interface Waiter {
  settle(ok: boolean, message: LinkMessage): void;
  timer: ReturnType<typeof setTimeout>;
}

let handle: CraftFrameHandle | null = null;
const waiters = new Map<string, Waiter>();
let seq = 0;

export function setCraftFrame(next: CraftFrameHandle | null): void {
  handle = next;
  if (next) return;
  // The tab went away: fail every open request instead of leaving a caller hanging.
  for (const [id, waiter] of [...waiters]) {
    waiters.delete(id);
    clearTimeout(waiter.timer);
    waiter.settle(false, { ok: false, error: "tab-closed" });
  }
}

export function craftFrame(): CraftFrameHandle | null {
  return handle;
}

/**
 * The tab is mounted lazily; a tool that opens it first waits for the handle.
 *
 * A handle is not the same thing as a listening page: it exists as soon as the tab's
 * hook mounts, while the frame's `srcdoc` may still be parsing. Delivery is therefore
 * `askCraftFrame`'s problem, not this function's.
 */
export async function waitForCraftFrame(timeoutMs = 5000): Promise<CraftFrameHandle | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (handle) return handle;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return handle;
}

/**
 * Requests that can be re-sent without consequence. A failed `post` only means the
 * page was not listening yet (the iframe had not been inserted, or its inline script
 * had not run), so for a read it is worth trying again. Gestures are deliberately
 * absent: sending a click twice is a different request.
 */
const REPEATABLE = new Set(["craft:inspect", "craft:stage", "craft:unstage", "craft:probe", "craft:capture"]);

/** How long a repeatable request waits before trying delivery again. */
const RETRY_STEP_MS = 50;

/** Ask the page a question and wait for its `craft:reply`. */
export function askCraftFrame(
  type: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 8000,
): Promise<LinkMessage> {
  const id = `${type}-${++seq}`;
  const repeatable = REPEATABLE.has(type);
  return new Promise<LinkMessage>((resolve, reject) => {
    let done = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => finish("frame-timeout"), timeoutMs);

    function finish(error?: string, message?: LinkMessage): void {
      if (done) return;
      done = true;
      waiters.delete(id);
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
      if (error) reject(new Error(error));
      else resolve(message as LinkMessage);
    }

    waiters.set(id, {
      timer,
      settle(ok, message) {
        if (ok) finish(undefined, message);
        else finish(message.error || "frame-failed");
      },
    });

    const deadline = Date.now() + timeoutMs;
    const attempt = (): void => {
      if (done) return;
      const frame = handle;
      if (!frame) {
        finish("tab-not-open");
        return;
      }
      if (frame.post({ ...payload, type, id })) return;
      if (!repeatable || Date.now() + RETRY_STEP_MS >= deadline) {
        finish("frame-gone");
        return;
      }
      retryTimer = setTimeout(attempt, RETRY_STEP_MS);
    };
    attempt();
  });
}

/** Called by the tab's message listener for every `craft:reply`. */
export function settleCraftReply(message: LinkMessage): void {
  if (!message.id) return;
  const waiter = waiters.get(message.id);
  if (!waiter) return;
  waiters.delete(message.id);
  waiter.settle(message.ok !== false, message);
}

/**
 * The Agent tools run outside React, the tab renders inside it: a batch reports
 * each step through here so the status line can say "2/5 · 点击渐变工具" while it
 * runs, instead of the panel going quiet between two tool calls.
 */
const progressListeners = new Set<(progress: CraftProgress) => void>();

export function subscribeCraftProgress(listener: (progress: CraftProgress) => void): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export function publishCraftProgress(progress: CraftProgress): void {
  for (const listener of progressListeners) listener(progress);
}
