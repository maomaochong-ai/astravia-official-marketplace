import type { CraftNote } from "../../domain/link-protocol.ts";
import { isCraftNote } from "../../domain/link-protocol.ts";
import { askCraftFrame } from "../../features/editor/session-registry.ts";

/**
 * The small pieces every tool needs, kept out of the tool files so a tool reads as one
 * thing: a name, a schema, and what it does with the frame.
 */

/** A tool result reaches the model as text; this is the one place that turns a payload into it. */
export function text(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * The page's own log of what it just did, or an empty list when the frame cannot answer.
 * Never throws: a missing history is a smaller problem than a failed status.
 */
export async function readActivity(limit = 8): Promise<CraftNote[]> {
  try {
    const reply = await askCraftFrame("craft:activity", { limit }, 5000);
    return Array.isArray(reply.notes) ? reply.notes.filter(isCraftNote).slice(-limit) : [];
  } catch {
    return [];
  }
}
