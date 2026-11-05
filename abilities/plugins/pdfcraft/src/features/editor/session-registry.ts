import type { CraftNote, CraftProgress, LinkMessage } from "../../domain/link-protocol.ts";

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
 * Where this tab's project lives.
 *
 * A screenshot has to be written somewhere the host allows (`ctx.fs` is
 * project-scoped), and the tools run outside React with no access to the panel's
 * own `cwd`. So the value is published from two sides — the mounted hook knows it
 * from the activity tab, the conversation knows it from `conversation-changed` —
 * and whichever lands first wins. Null simply means "no shot this time".
 */
let workspaceCwd: string | null = null;

export function setCraftWorkspace(cwd: string | null): void {
  if (typeof cwd === "string" && cwd.trim() !== "") workspaceCwd = cwd;
}

export function craftWorkspace(): string | null {
  return workspaceCwd;
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
const REPEATABLE = new Set([
  "craft:inspect",
  "craft:stage",
  "craft:unstage",
  "craft:probe",
  "craft:capture",
  "craft:activity",
]);

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

/**
 * What the page has done lately, held here rather than in the tab.
 *
 * Three readers need the same short history: the tab draws it, the prompt
 * attachment tells the model about it, and a tool reports it back. Keeping it in one
 * module-level ring means a tool call made while the tab is unmounted still sees the
 * last thing that happened, instead of an empty list that reads like "nothing yet".
 */
const NOTE_MAX = 24;
let notes: CraftNote[] = [];
const noteListeners = new Set<(notes: CraftNote[]) => void>();

export function craftNotes(): CraftNote[] {
  return notes.slice();
}

export function resetCraftNotes(): void {
  notes = [];
  for (const listener of noteListeners) listener([]);
}

/** Merge one entry from `craft:note`, or a whole list from `craft:activity`. */
export function publishCraftNote(entry: CraftNote): void {
  notes = [...notes, entry].slice(-NOTE_MAX);
  for (const listener of noteListeners) listener(notes);
}

export function subscribeCraftNotes(listener: (notes: CraftNote[]) => void): () => void {
  noteListeners.add(listener);
  listener(notes);
  return () => {
    noteListeners.delete(listener);
  };
}

/**
 * What the Agent is about to do, before it does it.
 *
 * `craft:progress` narrates a batch that is already running. This is one step
 * earlier: the model is still generating the arguments, `tool-call-args` has named
 * the tool and the step count, and the panel can say "3 steps queued" instead of
 * sitting still for the length of a generation. Cleared when the call ends, so a
 * finished batch never leaves a stale promise on screen.
 */
export interface CraftIntent {
  at: number;
  /** Tool id with the app prefix stripped, e.g. `act`. */
  tool: string;
  /** How many steps the arguments hold so far (0 while they stream). */
  steps: number;
  /** First step label the model already wrote, in the user's language. */
  label: string | null;
}

let intent: CraftIntent | null = null;
const intentListeners = new Set<(intent: CraftIntent | null) => void>();

export function craftIntent(): CraftIntent | null {
  return intent;
}

export function publishCraftIntent(next: CraftIntent | null): void {
  intent = next;
  for (const listener of intentListeners) listener(next);
}

export function subscribeCraftIntent(listener: (intent: CraftIntent | null) => void): () => void {
  intentListeners.add(listener);
  listener(intent);
  return () => {
    intentListeners.delete(listener);
  };
}
