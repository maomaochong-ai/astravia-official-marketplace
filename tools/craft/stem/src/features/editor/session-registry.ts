import type { LinkMessage } from "../../domain/link-protocol.ts";

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

/** The tab is mounted lazily; a tool that opens it first waits for the handle. */
export async function waitForCraftFrame(timeoutMs = 5000): Promise<CraftFrameHandle | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (handle) return handle;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return handle;
}

/** Ask the page a question and wait for its `craft:reply`. */
export function askCraftFrame(
  type: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 8000,
): Promise<LinkMessage> {
  const frame = handle;
  if (!frame) return Promise.reject(new Error("tab-not-open"));

  const id = `${type}-${++seq}`;
  return new Promise<LinkMessage>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(id);
      reject(new Error("frame-timeout"));
    }, timeoutMs);
    waiters.set(id, {
      timer,
      settle(ok, message) {
        clearTimeout(timer);
        if (ok) resolve(message);
        else reject(new Error(message.error || "frame-failed"));
      },
    });
    if (!frame.post({ ...payload, type, id })) {
      waiters.delete(id);
      clearTimeout(timer);
      reject(new Error("frame-gone"));
    }
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
