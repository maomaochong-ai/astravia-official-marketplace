import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../../app.config.ts";
import { publishCraftIntent, setCraftWorkspace } from "../editor/session-registry.ts";

/**
 * What the conversation tells the panel while it is still talking.
 *
 * Two facts arrive before a tool ever runs, and both are worth drawing:
 *
 * - `conversation-changed` carries the session `cwd`. The Agent tools live outside
 *   React and write screenshots through `ctx.fs`, which is project-scoped; this is
 *   how they learn the project root without the panel being open.
 * - `tool-call-args` streams the arguments as the model generates them. For this
 *   plugin the argument that matters is `steps`, so the panel can say "3 steps
 *   queued" while the rest of the batch is still being written, instead of going
 *   quiet until the first click lands. The host documents this event for exactly
 *   that purpose.
 *
 * Subscription is best-effort: a host build without `agent.session.read` throws,
 * and the panel then simply loses the early hint — nothing else depends on it.
 */
export function connectConversation(ctx: PluginContext): Disposable {
  const prefix = `${APP.id}_`;

  const readSteps = (args: Record<string, unknown> | undefined): { steps: number; label: string | null } => {
    const list = args?.steps;
    if (!Array.isArray(list)) return { steps: 0, label: null };
    const first = list.find((step) => step && typeof step === "object") as { label?: unknown } | undefined;
    const label = typeof first?.label === "string" && first.label.trim() !== "" ? first.label : null;
    return { steps: list.length, label };
  };

  try {
    return ctx.conversation.on((event) => {
      if (event.type === "conversation-changed") {
        setCraftWorkspace(event.conversation.cwd);
        return;
      }
      if (event.type === "tool-call-args" || event.type === "tool-call-start") {
        if (!event.toolName.startsWith(prefix)) return;
        const parsed = readSteps(event.args);
        publishCraftIntent({
          at: Date.now(),
          tool: event.toolName.slice(prefix.length),
          steps: parsed.steps,
          label: parsed.label,
        });
        return;
      }
      if (event.type === "tool-call-end") {
        if (!event.toolName.startsWith(prefix)) return;
        publishCraftIntent(null);
      }
    });
  } catch {
    return { dispose() {} };
  }
}
